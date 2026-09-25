import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import axios from "axios";
import { useAccount } from "../contexts/AccountContext";
import { useAlert } from "../contexts/AlertContext";
import { useSSE } from "../hooks/useSSE";
import { API_BASE_URL, useAuth } from "../contexts/AuthContext";

// 30 amplitudes pré-definidas simulando a curva harmônica de voz do WhatsApp
const WAVEFORM_HEIGHTS = [
  25, 45, 70, 35, 80, 100, 65, 45, 90, 95, 70, 50, 85, 90, 60, 45,
  80, 95, 55, 35, 75, 85, 60, 40, 75, 90, 50, 35, 65, 40
];

function AudioMessagePlayer({ src }: { src: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [retryCount, setRetryCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setHasError(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    if (!src) {
      setLoading(false);
      setHasError(true);
      return;
    }

    if (src.startsWith("blob:") || src.startsWith("data:")) {
      setBlobUrl(src);
      setLoading(false);
      return;
    }

    const token = localStorage.getItem("token") || "";
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch(src, { headers })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const blob = await response.blob();
        if (!active) return;
        const audioBlob = new Blob([blob], { type: "audio/ogg" });
        const objectUrl = URL.createObjectURL(audioBlob);
        setBlobUrl(objectUrl);
        setLoading(false);
      })
      .catch((err) => {
        console.warn("[AudioMessagePlayer] Erro ao carregar blob, usando link direto:", err?.message);
        if (!active) return;
        setBlobUrl(src);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [src, retryCount]);

  useEffect(() => {
    if (!blobUrl) return;

    const audio = new Audio();
    audio.src = blobUrl;
    audio.preload = "auto";
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      if (!isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onDurationChange = () => {
      if (!isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const onError = () => {
      console.warn("[AudioMessagePlayer] Erro no elemento de áudio");
      setHasError(true);
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("canplay", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("canplay", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audioRef.current = null;
    };
  }, [blobUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.error("[AudioMessagePlayer] Falha ao iniciar reprodução:", err);
        setHasError(true);
      });
    }
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!waveformRef.current || !duration || duration <= 0) return;
    const rect = waveformRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = pct * duration;
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const toggleSpeed = () => {
    if (!audioRef.current) return;
    const rates = [1, 1.5, 2];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    audioRef.current.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const fmtTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs) || secs < 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  if (hasError) {
    return (
      <div style={{
        padding: "10px 14px",
        borderRadius: "12px",
        background: "rgba(239, 68, 68, 0.12)",
        border: "1px solid rgba(239, 68, 68, 0.25)",
        color: "#f87171",
        fontSize: "0.82rem",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        minWidth: "250px"
      }}>
        <span style={{ fontSize: "1.1rem" }}>⚠️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>Áudio temporariamente indisponível.</div>
          <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
            <button
              type="button"
              onClick={() => setRetryCount(c => c + 1)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--primary, #10b981)",
                fontSize: "0.75rem",
                cursor: "pointer",
                padding: 0,
                textDecoration: "underline",
                fontWeight: 600
              }}
            >
              🔄 Recarregar
            </button>
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--text-muted, #94a3b8)", fontSize: "0.75rem", textDecoration: "underline" }}
            >
              Abrir link direto
            </a>
          </div>
        </div>
      </div>
    );
  }

  const progressRatio = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "4px 2px",
      width: "100%",
      minWidth: "260px",
      maxWidth: "330px"
    }}>
      {/* Botão Play / Pause Estilo WhatsApp */}
      <button
        type="button"
        onClick={togglePlay}
        disabled={loading}
        style={{
          width: "42px",
          height: "42px",
          borderRadius: "50%",
          background: isPlaying
            ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
            : "linear-gradient(135deg, #059669 0%, #047857 100%)",
          boxShadow: isPlaying
            ? "0 4px 14px rgba(16, 185, 129, 0.45)"
            : "0 2px 8px rgba(0, 0, 0, 0.3)",
          border: "none",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: loading ? "wait" : "pointer",
          flexShrink: 0,
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
          outline: "none"
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        title={isPlaying ? "Pausar" : "Ouvir áudio"}
      >
        {loading ? (
          <div style={{
            width: "15px",
            height: "15px",
            border: "2px solid rgba(255, 255, 255, 0.3)",
            borderTopColor: "#fff",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite"
          }} />
        ) : isPlaying ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1.5" />
            <rect x="14" y="4" width="4" height="16" rx="1.5" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: "2px" }}>
            <path d="M8 5.14v13.72a1 1 0 001.55.83l11-6.86a1 1 0 000-1.66l-11-6.86A1 1 0 008 5.14z" />
          </svg>
        )}
      </button>

      {/* Conteúdo Central: Onda Sonora Interativa + Metadados */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 }}>
        {/* Waveform Scrubber */}
        <div
          ref={waveformRef}
          onClick={handleWaveformClick}
          style={{
            height: "28px",
            display: "flex",
            alignItems: "center",
            gap: "2.5px",
            cursor: duration > 0 ? "pointer" : "default",
            padding: "2px 0",
            position: "relative"
          }}
          title="Clique para navegar no áudio"
        >
          {WAVEFORM_HEIGHTS.map((h, i) => {
            const barRatio = i / WAVEFORM_HEIGHTS.length;
            const isFilled = barRatio <= progressRatio;
            return (
              <span
                key={i}
                style={{
                  flex: 1,
                  height: `${h}%`,
                  minHeight: "4px",
                  borderRadius: "2px",
                  background: isFilled ? "var(--primary, #10b981)" : "rgba(255, 255, 255, 0.22)",
                  transition: "background 0.1s ease",
                }}
              />
            );
          })}
        </div>

        {/* Linha Inferior: Duração + Velocidade + Download */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.72rem", color: "var(--text-muted, #94a3b8)", fontWeight: 500 }}>
            <span>🎙️</span>
            <span>
              {isPlaying || currentTime > 0
                ? fmtTime(currentTime)
                : (duration > 0 ? fmtTime(duration) : (loading ? "Carregando..." : "0:00"))}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Seletor de Velocidade 1x/1.5x/2x */}
            <button
              type="button"
              onClick={toggleSpeed}
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: playbackRate > 1 ? "var(--primary, #10b981)" : "var(--text-secondary, #cbd5e1)",
                fontSize: "0.68rem",
                fontWeight: 700,
                borderRadius: "10px",
                padding: "2px 6px",
                cursor: "pointer",
                transition: "all 0.15s ease",
                lineHeight: "1.2"
              }}
              title="Velocidade de reprodução"
            >
              {playbackRate}x
            </button>

            {/* Ícone de Download em SVG limpo */}
            <a
              href={blobUrl || src}
              download="mensagem_voz.ogg"
              style={{
                color: "var(--text-muted, #94a3b8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "20px",
                height: "20px",
                borderRadius: "4px",
                transition: "color 0.15s ease",
                textDecoration: "none"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--primary, #10b981)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted, #94a3b8)")}
              title="Baixar áudio (.ogg)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function normalizePhone(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length === 12) {
    return digits.slice(0, 4) + "9" + digits.slice(4);
  }
  return digits;
}

// Renderizador visual da formatação do WhatsApp (*negrito*, _itálico_, ~tachado~, `código`, links e quebras de linha)
function renderWhatsAppFormatted(text: string): React.ReactNode {
  if (!text) return null;

  const lines = text.split("\n");
  return lines.map((line, lineIdx) => {
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let keyIdx = 0;

    // Expressão regular que captura *negrito*, _itálico_, ~tachado~, `código`, links http(s)
    const regex = /(\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~|`([^`\n]+)`|(https?:\/\/[^\s]+))/;

    while (remaining) {
      const match = remaining.match(regex);
      if (!match || match.index === undefined) {
        parts.push(remaining);
        break;
      }

      if (match.index > 0) {
        parts.push(remaining.substring(0, match.index));
      }

      const matchedStr = match[0];
      if (matchedStr.startsWith("*") && matchedStr.endsWith("*") && match[2]) {
        parts.push(<strong key={keyIdx++}>{match[2]}</strong>);
      } else if (matchedStr.startsWith("_") && matchedStr.endsWith("_") && match[3]) {
        parts.push(<em key={keyIdx++}>{match[3]}</em>);
      } else if (matchedStr.startsWith("~") && matchedStr.endsWith("~") && match[4]) {
        parts.push(<del key={keyIdx++}>{match[4]}</del>);
      } else if (matchedStr.startsWith("`") && matchedStr.endsWith("`") && match[5]) {
        parts.push(
          <code key={keyIdx++} style={{ background: "rgba(255,255,255,0.12)", padding: "1px 4px", borderRadius: "3px", fontSize: "0.85em", fontFamily: "monospace" }}>
            {match[5]}
          </code>
        );
      } else if (matchedStr.startsWith("http://") || matchedStr.startsWith("https://")) {
        parts.push(
          <a key={keyIdx++} href={matchedStr} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary, #10b981)", textDecoration: "underline" }}>
            {matchedStr}
          </a>
        );
      } else {
        parts.push(matchedStr);
      }

      remaining = remaining.substring(match.index + matchedStr.length);
    }

    return (
      <React.Fragment key={lineIdx}>
        {parts}
        {lineIdx < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}

function getSlaInfo(updatedAt: string | Date, direction: string, isHandledLead?: boolean): { label: string; color: string; bg: string; border: string; level: 'good' | 'warning' | 'urgent'; minutes: number } | null {
  if (direction !== "INCOMING" || isHandledLead) return null;
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));
  
  if (minutes < 5) {
    return {
      label: `⏳ ${minutes === 0 ? "Agora" : `${minutes}m`}`,
      color: "#34d399",
      bg: "rgba(16, 185, 129, 0.18)",
      border: "1px solid rgba(16, 185, 129, 0.45)",
      level: 'good',
      minutes
    };
  }
  if (minutes < 15) {
    return {
      label: `⚠️ ${minutes}m aguardando`,
      color: "#fde047",
      bg: "rgba(245, 158, 11, 0.2)",
      border: "1px solid rgba(245, 158, 11, 0.45)",
      level: 'warning',
      minutes
    };
  }
  const hours = Math.floor(minutes / 60);
  const text = hours > 0 ? `${hours}h${minutes % 60}m` : `${minutes}m`;
  return {
    label: `🚨 ${text} aguardando`,
    color: "#fca5a5",
    bg: "rgba(239, 68, 68, 0.24)",
    border: "1px solid rgba(239, 68, 68, 0.55)",
    level: 'urgent',
    minutes
  };
}

function getQrIcon(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("pix") || lower.includes("pagamento") || lower.includes("preço") || lower.includes("valor")) return "💳";
  if (lower.includes("oferta") || lower.includes("promo") || lower.includes("desconto") || lower.includes("splash")) return "🏷️";
  if (lower.includes("endereço") || lower.includes("horário") || lower.includes("local") || lower.includes("onde")) return "📍";
  if (lower.includes("olá") || lower.includes("boa") || lower.includes("boas-vindas") || lower.includes("bem-vindo")) return "👋";
  if (lower.includes("momento") || lower.includes("aguard") || lower.includes("minut")) return "⏳";
  if (lower.includes("catalogo") || lower.includes("catálogo") || lower.includes("menu")) return "📖";
  return "⚡";
}

function formatDateDivider(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
}

export interface QuickReply {
  id: string;
  title: string;
  text: string;
  message?: string;
  accountId?: string;
}

export const DEFAULT_QUICK_REPLIES: QuickReply[] = [
  {
    id: "oferta",
    title: "🎁 Oferta Body Splash",
    text: `Obrigada pelo retorno! 💚 💦\n\nFestival de Body Splash 21 a 30/09 | 1 lançamento por dia\n200 ml — à vista ou cartão:\n\n🔥 R$ 75 por R$ 40\n🔥 R$ 72 por R$ 38\n\n🎁 *Incentivos:*\n• R$ 299 ➔ Body Splash 100 ml\n• R$ 400 ➔ Colônia 100 ml\n• R$ 800 ➔ 2 Colônias + Body Splash 200 ml\n\nJá revelados: *Laranja* e *Brisa Verde*.\nAmanhã: *Ternura* 🤫\n\nQuer pedir? Responda *SIM* e encaminhamos você para o atendimento da loja!`
  },
  {
    id: "pix",
    title: "💳 Chave PIX",
    text: `Perfeito! Segue a nossa chave PIX para pagamento:\n\n🔑 Chave: (84) 99999-9999\nTitular: Magda Perfumaria e Cosméticos\n\nAssim que fizer o envio do comprovante, separamos o seu pedido imediatamente! ✨`
  },
  {
    id: "horario",
    title: "📍 Endereço & Horários",
    text: `📍 Nossa loja fica localizada no Centro.\n⏰ Horário de atendimento:\nSegunda a Sexta: 08:30 às 18:00\nSábado: 08:30 às 13:00\n\nVenha nos visitar ou peça para entregarmos aí para você!`
  },
  {
    id: "momento",
    title: "⏳ Pedir um Momento",
    text: `Olá! Já recebi sua mensagem e estou verificando o seu pedido com a nossa equipe. Em minutinhos te dou o retorno completo, tá bem? Obrigado pela paciência! 💚`
  },
  {
    id: "saudacao",
    title: "👋 Boas-vindas",
    text: `Olá! Tudo bem? Que bom falar com você! Como posso te ajudar hoje? 😊`
  }
];

export type FunnelStage = 'NEW' | 'NEGOTIATING' | 'WAITING_PAYMENT' | 'WON' | 'LOST';

export const FUNNEL_STAGES: Record<FunnelStage, { label: string; color: string; bg: string; border: string }> = {
  NEW: { label: "📥 Novo Lead", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.12)", border: "1px solid rgba(56, 189, 248, 0.3)" },
  NEGOTIATING: { label: "💬 Em Negociação", color: "#a855f7", bg: "rgba(168, 85, 247, 0.12)", border: "1px solid rgba(168, 85, 247, 0.3)" },
  WAITING_PAYMENT: { label: "💳 Aguardando PIX", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.3)" },
  WON: { label: "🎉 Venda Concluída", color: "#10b981", bg: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.35)" },
  LOST: { label: "💤 Sem Retorno", color: "#94a3b8", bg: "rgba(148, 163, 184, 0.1)", border: "1px solid rgba(148, 163, 184, 0.2)" }
};

export interface LeadCrmData {
  stage: FunnelStage;
  tags: string[];
  notes: string;
}

interface Template {
  id: string;
  metaId: string | null;
  name: string;
  language: string;
  category: string;
  status: string;
  components: any;
}

export default function ChatPage() {
  const { selectedAccount } = useAccount();
  const { showAlert } = useAlert();
  const { token: authToken } = useAuth();

  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string>("");
  const selectedPhoneRef = useRef(selectedPhone);

  useEffect(() => {
    selectedPhoneRef.current = selectedPhone;
  }, [selectedPhone]);

  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [convFilter, setConvFilter] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [period, setPeriod] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const dateFilterRef = useRef({ startDate: "", endDate: "" });
  const [replyBody, setReplyBody] = useState("");
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [isConversationsLoading, setIsConversationsLoading] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [showQuickReplyModal, setShowQuickReplyModal] = useState(false);
  const [editingQrId, setEditingQrId] = useState<string | null>(null);
  const [qrTitleInput, setQrTitleInput] = useState("");
  const [qrTextInput, setQrTextInput] = useState("");

  // Mini-CRM states
  const [showCrmDrawer, setShowCrmDrawer] = useState(false);
  const [crmData, setCrmData] = useState<LeadCrmData>({ stage: 'NEW', tags: [], notes: '' });
  const [newTagInput, setNewTagInput] = useState("");

  // Cache O(1) de atendidos locais (carregado 1 única vez ao selecionar conta)
  const [localHandledMap, setLocalHandledMap] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!selectedAccount) {
      setLocalHandledMap(new Set());
      return;
    }
    try {
      const raw = localStorage.getItem(`send_handled_chats_${selectedAccount.id}`);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          setLocalHandledMap(new Set(list.map((p: string) => normalizePhone(p))));
          return;
        }
      }
    } catch {}
    setLocalHandledMap(new Set());
  }, [selectedAccount?.id]);

  // Set O(1) memoizado unificando status do banco de dados e cache local
  const handledPhoneSet = useMemo(() => {
    const set = new Set<string>(localHandledMap);
    for (let i = 0; i < conversations.length; i++) {
      if (conversations[i].isHandled) {
        set.add(normalizePhone(conversations[i].phone));
      }
    }
    return set;
  }, [conversations, localHandledMap]);

  // Verificação O(1) instantânea (0ms)
  const isConversationHandled = useCallback((phone: string, conv?: any): boolean => {
    if (conv && conv.isHandled) return true;
    return handledPhoneSet.has(normalizePhone(phone));
  }, [handledPhoneSet]);

  const toggleHandled = useCallback(async (phone: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!selectedAccount || !phone) return;

    const normTarget = normalizePhone(phone);
    const currentConv = conversations.find(c => normalizePhone(c.phone) === normTarget);
    const currentHandled = isConversationHandled(phone, currentConv);
    const newHandled = !currentHandled;

    // Atualização otimista imediata na UI
    setConversations(prev =>
      prev.map(c => normalizePhone(c.phone) === normTarget ? { ...c, isHandled: newHandled } : c)
    );

    // Mantém cache local do navegador sincronizado
    setLocalHandledMap(prev => {
      const next = new Set(prev);
      if (newHandled) next.add(normTarget);
      else next.delete(normTarget);
      return next;
    });

    const localKey = `send_handled_chats_${selectedAccount.id}`;
    try {
      const raw = localStorage.getItem(localKey);
      const list: string[] = raw ? JSON.parse(raw) : [];
      let updatedList: string[];
      if (newHandled) {
        updatedList = Array.from(new Set([...list, phone, normTarget]));
      } else {
        updatedList = list.filter(p => normalizePhone(p) !== normTarget && p !== phone);
      }
      localStorage.setItem(localKey, JSON.stringify(updatedList));
    } catch (e) {
      console.warn("Falha ao salvar no cache local:", e);
    }

    try {
      await axios.patch(`${API_BASE_URL}/accounts/${selectedAccount.id}/conversations/${phone}/handled`, {
        isHandled: newHandled
      });

      // Se no CRM constava como LOST e reabriu, reverter para NEGOTIATING
      if (!newHandled) {
        const crmKey = `send_crm_${selectedAccount.id}_${phone}`;
        try {
          const raw = localStorage.getItem(crmKey);
          if (raw) {
            const crm = JSON.parse(raw);
            if (crm.stage === 'LOST') {
              crm.stage = 'NEGOTIATING';
              localStorage.setItem(crmKey, JSON.stringify(crm));
              if (selectedPhone === phone) {
                setCrmData(crm);
              }
            }
          }
        } catch (err) {
          console.warn("Erro ao reverter estágio do CRM:", err);
        }
      }

      showAlert(
        newHandled
          ? "Conversa concluída / arquivada com sucesso!"
          : "Atendimento reaberto! Lead voltou para a fila de espera.",
        newHandled ? "success" : "info"
      );
    } catch (err: any) {
      // Reverte estado local se a API falhar
      setConversations(prev =>
        prev.map(c => normalizePhone(c.phone) === normTarget ? { ...c, isHandled: currentHandled } : c)
      );
      showAlert(err.response?.data?.error || "Erro ao atualizar status da conversa.", "error");
    }
  }, [selectedAccount, conversations, selectedPhone, showAlert, isConversationHandled]);

  const [isSendingReply, setIsSendingReply] = useState(false);
  const [showChatTemplateModal, setShowChatTemplateModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Carregar e persistir Respostas Rápidas centralizadas no Banco de Dados
  const fetchQuickReplies = useCallback(async (accountId: string) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/accounts/${accountId}/quick-replies`);
      setQuickReplies(res.data);
    } catch (err) {
      console.error("Erro ao carregar respostas rápidas:", err);
    }
  }, []);

  useEffect(() => {
    if (!selectedAccount) {
      setQuickReplies([]);
      return;
    }
    fetchQuickReplies(selectedAccount.id);
  }, [selectedAccount?.id, fetchQuickReplies]);

  const handleSaveQuickReply = async () => {
    if (!selectedAccount) return;
    const title = qrTitleInput.trim();
    const text = qrTextInput.trim();

    if (!title || !text) {
      showAlert("Preencha o título e o texto da resposta rápida.", "error");
      return;
    }

    try {
      if (editingQrId) {
        const res = await axios.put(`${API_BASE_URL}/accounts/${selectedAccount.id}/quick-replies/${editingQrId}`, {
          title,
          message: text,
        });
        setQuickReplies(prev => prev.map(q => q.id === editingQrId ? res.data : q));
        showAlert("Resposta rápida atualizada com sucesso! ✅", "success");
      } else {
        const res = await axios.post(`${API_BASE_URL}/accounts/${selectedAccount.id}/quick-replies`, {
          title,
          message: text,
        });
        setQuickReplies(prev => [...prev, res.data]);
        showAlert("Nova resposta rápida criada com sucesso! 🚀", "success");
      }
      setEditingQrId(null);
      setQrTitleInput("");
      setQrTextInput("");
    } catch (err: any) {
      showAlert(err.response?.data?.error || "Erro ao salvar resposta rápida.", "error");
    }
  };

  const handleDeleteQuickReply = async (id: string) => {
    if (!selectedAccount) return;
    try {
      await axios.delete(`${API_BASE_URL}/accounts/${selectedAccount.id}/quick-replies/${id}`);
      setQuickReplies(prev => prev.filter(q => q.id !== id));
      if (editingQrId === id) {
        setEditingQrId(null);
        setQrTitleInput("");
        setQrTextInput("");
      }
      showAlert("Resposta rápida excluída.", "info");
    } catch (err: any) {
      showAlert(err.response?.data?.error || "Erro ao excluir resposta rápida.", "error");
    }
  };

  const handleResetQuickReplies = async () => {
    if (!selectedAccount) return;
    if (!window.confirm("Deseja restaurar as respostas rápidas originais (Body Splash, PIX, Endereço, etc) no banco de dados?")) {
      return;
    }
    try {
      const res = await axios.post(`${API_BASE_URL}/accounts/${selectedAccount.id}/quick-replies/reset-defaults`);
      setQuickReplies(res.data);
      showAlert("Respostas padrões restauradas com sucesso!", "success");
    } catch (err: any) {
      showAlert(err.response?.data?.error || "Erro ao restaurar respostas padrões.", "error");
    }
  };

  // Carregar e persistir dados do Mini-CRM do Lead selecionado
  useEffect(() => {
    if (!selectedAccount || !selectedPhone) {
      setCrmData({ stage: 'NEW', tags: [], notes: '' });
      return;
    }
    const key = `send_crm_${selectedAccount.id}_${selectedPhone}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        setCrmData(JSON.parse(stored));
      } else {
        setCrmData({ stage: 'NEW', tags: [], notes: '' });
      }
    } catch {
      setCrmData({ stage: 'NEW', tags: [], notes: '' });
    }
  }, [selectedAccount?.id, selectedPhone]);

  const updateCrm = (updater: (prev: LeadCrmData) => LeadCrmData) => {
    if (!selectedAccount || !selectedPhone) return;
    setCrmData(prev => {
      const next = updater(prev);
      const key = `send_crm_${selectedAccount.id}_${selectedPhone}`;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch (e) {
        console.warn("Falha ao salvar dados de CRM no localStorage:", e);
      }

      // Sincroniza estado de arquivamento/atendimento centralizado no backend com o estágio do CRM
      const normPhone = normalizePhone(selectedPhone);
      if (next.stage === 'LOST' || next.stage === 'WON') {
        setConversations(prevConv =>
          prevConv.map(c => normalizePhone(c.phone) === normPhone ? { ...c, isHandled: true } : c)
        );
        axios.patch(`${API_BASE_URL}/accounts/${selectedAccount.id}/conversations/${selectedPhone}/handled`, { isHandled: true }).catch(() => {});
      } else if (prev.stage === 'LOST' || prev.stage === 'WON') {
        // Lead reaberto para negociação ativa
        setConversations(prevConv =>
          prevConv.map(c => normalizePhone(c.phone) === normPhone ? { ...c, isHandled: false } : c)
        );
        axios.patch(`${API_BASE_URL}/accounts/${selectedAccount.id}/conversations/${selectedPhone}/handled`, { isHandled: false }).catch(() => {});
      }

      return next;
    });
  };

  const insertFormat = (wrapChar: string) => {
    const ta = replyTextareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = replyBody.substring(start, end);
    let newText = "";
    let newCursor = start;

    if (wrapChar === "• ") {
      newText = replyBody.substring(0, start) + "• " + selected + replyBody.substring(end);
      newCursor = start + 2 + selected.length;
    } else {
      const sample = selected || "texto";
      const wrapped = `${wrapChar}${sample}${wrapChar}`;
      newText = replyBody.substring(0, start) + wrapped + replyBody.substring(end);
      newCursor = selected ? end + wrapChar.length * 2 : start + wrapChar.length + sample.length;
    }

    setReplyBody(newText);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = newCursor;
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
    }, 0);
  };

  // Template states for quick sending
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateName, setSelectedTemplateName] = useState("");
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);

  const detectBodyVariables = (text: string) => {
    const matches = text.match(/\{\{(\d+)\}\}/g);
    if (!matches) return [];
    const uniqueIds = Array.from(new Set(matches.map(m => {
      const numMatch = m.match(/\d+/);
      return numMatch ? parseInt(numMatch[0]) : 1;
    }))).sort((a, b) => a - b);
    return uniqueIds;
  };

  const fetchTemplates = async (accountId: string) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/accounts/${accountId}/templates`);
      setTemplates(res.data);
    } catch (err) {
      console.error("Erro ao buscar templates:", err);
    }
  };

  const fetchConversations = async (accountId: string, silent = false) => {
    if (!silent) setIsConversationsLoading(true);
    try {
      const { startDate: sd, endDate: ed } = dateFilterRef.current;
      const qs = sd && ed ? `?startDate=${sd}&endDate=${ed}` : "";
      const res = await axios.get(`${API_BASE_URL}/accounts/${accountId}/conversations${qs}`);
      
      // Lê cache local para cobrir qualquer delay de sincronização
      let localHandledSet = new Set<string>();
      try {
        const raw = localStorage.getItem(`send_handled_chats_${accountId}`);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            list.forEach((p: string) => localHandledSet.add(normalizePhone(p)));
          }
        }
      } catch {}

      const merged = (res.data || []).map((c: any) => {
        if (c.isHandled) return c;
        if (localHandledSet.has(normalizePhone(c.phone))) {
          return { ...c, isHandled: true };
        }
        return c;
      });

      setConversations(merged);
    } catch (err) {
      console.error("Erro ao buscar conversas:", err);
    } finally {
      if (!silent) setIsConversationsLoading(false);
    }
  };

  // Auto-sincronização transparente do histórico de atendimentos locais com o Banco de Dados centralizado
  useEffect(() => {
    if (!selectedAccount) return;
    const accountId = selectedAccount.id;
    const key = `send_handled_chats_${accountId}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const storedPhones: string[] = JSON.parse(raw);
        if (Array.isArray(storedPhones) && storedPhones.length > 0) {
          const phoneSet = new Set(storedPhones.map(p => normalizePhone(p)));

          // Aplica no estado imediatamente para a fila não mostrar chats já respondidos/limpos
          setConversations(prev =>
            prev.map(c => phoneSet.has(normalizePhone(c.phone)) ? { ...c, isHandled: true } : c)
          );

          // Persiste no banco de dados centralizado via API
          axios.post(`${API_BASE_URL}/accounts/${accountId}/conversations/mark-all-handled`, {
            phones: storedPhones,
            isHandled: true
          }).then(() => {
            console.log(`[ChatPage] ${storedPhones.length} conversas sincronizadas com o banco com sucesso!`);
          }).catch(err => {
            console.warn("[ChatPage] Falha na auto-sincronização de conversas atendidas com o banco:", err);
          });
        }
      }
    } catch (e) {
      console.warn("[ChatPage] Erro ao sincronizar atendimentos locais:", e);
    }
  }, [selectedAccount?.id]);

  // Refaz a busca (e mantém o ref em dia para o polling) quando o período muda
  useEffect(() => {
    dateFilterRef.current = { startDate, endDate };
    if (selectedAccount) fetchConversations(selectedAccount.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  // Exporta os contatos filtrados (período + status ativo) para CSV
  const exportCsv = async () => {
    if (!selectedAccount) return;
    setIsExporting(true);
    try {
      const { startDate: sd, endDate: ed } = dateFilterRef.current;
      const params = new URLSearchParams({ filter: convFilter });
      if (sd && ed) { params.set("startDate", sd); params.set("endDate", ed); }
      const res = await axios.get(
        `${API_BASE_URL}/accounts/${selectedAccount.id}/conversations/export?${params.toString()}`,
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showAlert("Erro ao exportar CSV.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  // Converte uma Date para YYYY-MM-DD local
  const fmtDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };

  // Aplica um atalho de período (calcula as datas; o efeito de [startDate,endDate] refaz a busca)
  const applyPeriod = (p: string) => {
    setPeriod(p);
    if (p === "custom") return;
    if (p === "") { setStartDate(""); setEndDate(""); return; }
    const start = new Date();
    const end = new Date();
    if (p === "yesterday") { start.setDate(start.getDate() - 1); end.setDate(end.getDate() - 1); }
    else if (p === "3days") { start.setDate(start.getDate() - 2); }
    else if (p === "7days") { start.setDate(start.getDate() - 6); }
    setStartDate(fmtDate(start));
    setEndDate(fmtDate(end));
  };

  // Move um contato para a Lista Negra (some da lista e é ignorado em disparos)
  const blacklistContact = async (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedAccount) return;
    if (!window.confirm("Deseja mover este contato para a Lista Negra? Ele não aparecerá mais nos chats e será ignorado em futuros disparos.")) return;
    try {
      await axios.patch(`${API_BASE_URL}/accounts/${selectedAccount.id}/conversations/${phone}/blacklist`, { blacklisted: true });
      setConversations((prev) => prev.filter((c) => c.phone !== phone));
      if (selectedPhone === phone) setSelectedPhone("");
      showAlert("Contato movido para a Lista Negra.", "success");
    } catch (err: any) {
      showAlert(err.response?.data?.error || "Erro ao bloquear contato.", "error");
    }
  };

  const fetchChatMessages = async (accountId: string, phone: string, silent = false) => {
    if (!silent) setIsChatLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/accounts/${accountId}/conversations/${phone}/messages`);
      setChatMessages(res.data);
    } catch (err) {
      console.error("Erro ao buscar mensagens do chat:", err);
    } finally {
      if (!silent) setIsChatLoading(false);
    }
  };

  // Filtro de status das mensagens do chat
  const FILTERS: { key: string; label: string }[] = [
    { key: "ALL", label: "Todas" },
    { key: "INCOMING", label: "📥 Recebidas" },
    { key: "SENT", label: "✓ Enviadas" },
    { key: "DELIVERED", label: "✓✓ Entregues" },
    { key: "READ", label: "✓✓ Lidas" },
    { key: "FAILED", label: "⚠️ Falhas" },
  ];

  const filteredMessages = chatMessages.filter((msg) => {
    if (statusFilter === "ALL") return true;
    if (statusFilter === "INCOMING") return msg.direction === "INCOMING";
    return msg.direction !== "INCOMING" && msg.status === statusFilter;
  });

  // Filtro da lista de conversas (chats), baseado nos agregados do histórico
  const CONV_FILTERS: { key: string; label: string; title: string; highlight?: boolean }[] = [
    { key: "ALL", label: "Todas", title: "Todas as conversas" },
    { key: "UNANSWERED", label: "🔥 Aguardando", title: "Clientes que responderam ao disparo e aguardam resposta", highlight: true },
    { key: "ANSWERED", label: "✅ Atendidas", title: "Conversas que você já respondeu ou marcou como concluídas" },
    { key: "HANDLED", label: "📁 Concluídas", title: "Conversas marcadas como concluídas ou Sem Retorno" },
    { key: "REPLIED", label: "💬 Respondidas", title: "Histórico geral de todos os clientes que responderam" },
    { key: "READ", label: "✓✓ Lidas", title: "Cliente leu a mensagem (mas pode não ter respondido)" },
    { key: "DELIVERED", label: "✓✓ Entregues", title: "Mensagem chegou no aparelho do cliente" },
    { key: "UNDELIVERED", label: "✉️ Não entregues", title: "Apenas enviadas — nunca chegaram ao cliente" },
    { key: "FAILED", label: "⚠️ Com falha", title: "Chats com pelo menos uma mensagem que falhou" },
  ];

  const matchesConvFilter = useCallback((c: any, filterOverride?: string) => {
    const filter = filterOverride || convFilter;
    const handled = isConversationHandled(c.phone, c);

    switch (filter) {
      case "UNANSWERED": 
        // Não lidas / aguardando: cliente mandou mensagem e NÃO foi arquivado / atendido / sem retorno
        return c.direction === "INCOMING" && !handled;

      case "ANSWERED": 
        // Já atendidas: respondidas por mensagem ou marcadas manualmente como concluídas
        return (!!c.hasIncoming && c.direction === "OUTGOING") || (c.direction === "INCOMING" && handled);

      case "HANDLED":
        // Concluídas / Arquivadas / Sem Retorno
        return handled;

      case "REPLIED": return !!c.hasIncoming;
      case "READ": return !!c.hasRead;
      case "DELIVERED": return !!c.hasDelivered || !!c.hasRead || !!c.hasIncoming;
      case "UNDELIVERED": return !c.hasDelivered && !c.hasRead && !c.hasIncoming && !c.hasFailed;
      case "FAILED": return !!c.hasFailed;
      default: return true;
    }
  }, [convFilter, isConversationHandled]);

  const filteredConversations = useMemo(() => {
    let list = conversations.filter(c => matchesConvFilter(c));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const qDigits = q.replace(/\D/g, "");
      list = list.filter((c) => {
        const nameMatch = c.profileName && c.profileName.toLowerCase().includes(q);
        const phoneMatch = c.phone.includes(q) || (qDigits.length >= 3 && c.phone.includes(qDigits));
        const msgMatch = c.lastMessage && c.lastMessage.toLowerCase().includes(q);
        return Boolean(nameMatch || phoneMatch || msgMatch);
      });
    }

    // Para a fila de Não Lidas / Aguardando, priorizar os clientes que esperam há mais tempo (FIFO)
    if (convFilter === "UNANSWERED") {
      return [...list].sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
    }

    return list;
  }, [conversations, matchesConvFilter, searchQuery, convFilter]);

  // Cálculo O(N) em única passada de todos os contadores dos filtros (elimina 38.000 iterações por render)
  const convFilterCounts = useMemo(() => {
    let unanswered = 0;
    let answered = 0;
    let handled = 0;
    let replied = 0;
    let read = 0;
    let delivered = 0;
    let undelivered = 0;
    let failed = 0;

    for (let i = 0; i < conversations.length; i++) {
      const c = conversations[i];
      const isH = Boolean(c.isHandled || handledPhoneSet.has(normalizePhone(c.phone)));

      if (c.direction === "INCOMING" && !isH) unanswered++;
      if ((c.hasIncoming && c.direction === "OUTGOING") || (c.direction === "INCOMING" && isH)) answered++;
      if (isH) handled++;
      if (c.hasIncoming) replied++;
      if (c.hasRead) read++;
      if (c.hasDelivered || c.hasRead || c.hasIncoming) delivered++;
      if (!c.hasDelivered && !c.hasRead && !c.hasIncoming && !c.hasFailed) undelivered++;
      if (c.hasFailed) failed++;
    }

    return {
      ALL: conversations.length,
      UNANSWERED: unanswered,
      ANSWERED: answered,
      HANDLED: handled,
      REPLIED: replied,
      READ: read,
      DELIVERED: delivered,
      UNDELIVERED: undelivered,
      FAILED: failed,
    };
  }, [conversations, handledPhoneSet]);

  // Renderização progressiva (evita criar 86.000 nós no DOM de uma vez, 60 FPS fluído)
  const [visibleCount, setVisibleCount] = useState(60);

  useEffect(() => {
    setVisibleCount(60);
  }, [convFilter, searchQuery]);

  const displayedConversations = useMemo(() => {
    return filteredConversations.slice(0, visibleCount);
  }, [filteredConversations, visibleCount]);

  const handleConversationsScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 300) {
      setVisibleCount(prev => (prev < filteredConversations.length ? Math.min(prev + 50, filteredConversations.length) : prev));
    }
  }, [filteredConversations.length]);

  const markAllFilteredAsHandled = useCallback(async () => {
    if (!selectedAccount || filteredConversations.length === 0) return;
    const count = filteredConversations.length;
    if (!window.confirm(`Deseja marcar todas as ${count} conversas desta lista como atendidas/concluídas?`)) {
      return;
    }

    const phonesToMark = filteredConversations.map(c => c.phone);
    const phoneSet = new Set(phonesToMark.map(p => normalizePhone(p)));

    // Atualização otimista imediata na UI
    setConversations(prev =>
      prev.map(c => phoneSet.has(normalizePhone(c.phone)) ? { ...c, isHandled: true } : c)
    );

    setLocalHandledMap(prev => {
      const next = new Set(prev);
      phonesToMark.forEach(p => next.add(normalizePhone(p)));
      return next;
    });

    // Mantém cache local sincronizado
    const localKey = `send_handled_chats_${selectedAccount.id}`;
    try {
      const raw = localStorage.getItem(localKey);
      const list: string[] = raw ? JSON.parse(raw) : [];
      const updatedList = Array.from(new Set([...list, ...phonesToMark, ...Array.from(phoneSet)]));
      localStorage.setItem(localKey, JSON.stringify(updatedList));
    } catch (e) {
      console.warn("Falha ao salvar no cache local:", e);
    }

    try {
      await axios.post(`${API_BASE_URL}/accounts/${selectedAccount.id}/conversations/mark-all-handled`, {
        phones: phonesToMark,
        isHandled: true
      });
      showAlert(`${count} conversas foram marcadas como atendidas!`, "success");
    } catch (err: any) {
      showAlert(err.response?.data?.error || "Erro ao marcar conversas no servidor.", "error");
      fetchConversations(selectedAccount.id, true);
    }
  }, [selectedAccount, filteredConversations, showAlert]);

  const sendReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedAccount || !selectedPhone || !replyBody.trim()) return;

    setIsSendingReply(true);
    // Preservar quebras de linha e converter negrito de Markdown (**texto**) para padrão WhatsApp (*texto*)
    let bodyText = replyBody.trim();
    bodyText = bodyText.replace(/\*\*([^*\n]+)\*\*/g, "*$1*");

    try {
      const res = await axios.post(`${API_BASE_URL}/accounts/${selectedAccount.id}/messages/reply`, {
        to: selectedPhone,
        body: bodyText,
      });

      setChatMessages((prev) => [...prev, res.data]);
      setReplyBody("");
      if (replyTextareaRef.current) {
        replyTextareaRef.current.style.height = "auto";
      }
      
      setConversations((prevConv) => {
        const index = prevConv.findIndex((c) => c.phone === selectedPhone);
        if (index !== -1) {
          const updated = [...prevConv];
          updated[index] = {
            ...updated[index],
            lastMessage: bodyText,
            updatedAt: new Date().toISOString(),
            status: "SENT",
            direction: "OUTGOING",
            isHandled: true,
          };
          return updated;
        }
        return prevConv;
      });

      // Atualiza cache local de atendidos
      if (selectedAccount) {
        const localKey = `send_handled_chats_${selectedAccount.id}`;
        try {
          const raw = localStorage.getItem(localKey);
          const list: string[] = raw ? JSON.parse(raw) : [];
          localStorage.setItem(localKey, JSON.stringify(Array.from(new Set([...list, selectedPhone, normalizePhone(selectedPhone)]))));
        } catch {}
      }
    } catch (err: any) {
      const details = err.response?.data?.error || "Erro desconhecido";
      showAlert(`Falha ao enviar resposta: ${details}`, "error");
    } finally {
      setIsSendingReply(false);
    }
  };

  useEffect(() => {
    if (selectedAccount) {
      fetchTemplates(selectedAccount.id);
      fetchConversations(selectedAccount.id);
      setSelectedPhone("");
      setChatMessages([]);
    } else {
      setTemplates([]);
      setConversations([]);
      setSelectedPhone("");
      setChatMessages([]);
    }
  }, [selectedAccount]);

  // Auto-scroll para a última mensagem quando as mensagens carregam ou chegam novas
  useEffect(() => {
    if (!isChatLoading && chatMessages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isChatLoading]);

  // Sincronização inteligente com revalidação imediata no foco da janela (refetchOnWindowFocus)
  useEffect(() => {
    if (!selectedAccount) return;

    const runSync = () => {
      fetchConversations(selectedAccount.id, true);
    };

    const convInterval = setInterval(() => {
      if (!document.hidden) runSync();
    }, 60000);

    const handleFocus = () => {
      runSync();
    };
    const handleVisibility = () => {
      if (!document.hidden) runSync();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(convInterval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [selectedAccount]);

  useEffect(() => {
    if (!selectedAccount || !selectedPhone) return;

    const runChatSync = () => {
      fetchChatMessages(selectedAccount.id, selectedPhoneRef.current, true);
    };

    const chatInterval = setInterval(() => {
      if (!document.hidden && selectedPhoneRef.current) runChatSync();
    }, 30000);

    const handleFocus = () => {
      if (selectedPhoneRef.current) runChatSync();
    };
    const handleVisibility = () => {
      if (!document.hidden && selectedPhoneRef.current) runChatSync();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(chatInterval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [selectedAccount, selectedPhone]);

  // Se inscreve no SSE de eventos para atualizar conversas, chat e contadores em tempo real
  useSSE((data: any) => {
    if (!selectedAccount) return;

    // 1. Mudança de status de atendimento de conversa individual via broadcast
    if (data.type === "conversationStatusChanged") {
      const targetPhone = normalizePhone(data.to);
      setConversations(prev =>
        prev.map(c => normalizePhone(c.phone) === targetPhone ? { ...c, isHandled: data.isHandled } : c)
      );
      if (selectedAccount) {
        const localKey = `send_handled_chats_${selectedAccount.id}`;
        try {
          const raw = localStorage.getItem(localKey);
          const list: string[] = raw ? JSON.parse(raw) : [];
          let updatedList: string[];
          if (data.isHandled) {
            updatedList = Array.from(new Set([...list, targetPhone]));
          } else {
            updatedList = list.filter(p => normalizePhone(p) !== targetPhone);
          }
          localStorage.setItem(localKey, JSON.stringify(updatedList));
        } catch {}
      }
      return;
    }

    // 2. Mudança de status de atendimento em lote via broadcast
    if (data.type === "batchConversationsHandled" && Array.isArray(data.phones)) {
      const phoneSet = new Set<string>(data.phones.map((p: string) => normalizePhone(p)));
      setConversations(prev =>
        prev.map(c => phoneSet.has(normalizePhone(c.phone)) ? { ...c, isHandled: data.isHandled } : c)
      );
      if (selectedAccount) {
        const localKey = `send_handled_chats_${selectedAccount.id}`;
        try {
          const raw = localStorage.getItem(localKey);
          const list: string[] = raw ? JSON.parse(raw) : [];
          let updatedList: string[];
          if (data.isHandled) {
            updatedList = Array.from(new Set<string>([...list, ...Array.from(phoneSet)]));
          } else {
            updatedList = list.filter(p => !phoneSet.has(normalizePhone(p)));
          }
          localStorage.setItem(localKey, JSON.stringify(updatedList));
        } catch {}
      }
      return;
    }

    // 3. Atualização de mensagem (enviada, entregue, lida, falha ou nova mensagem recebida)
    if (data.type === "messageUpdated") {
      const activePhone = selectedPhoneRef.current;
      const incomingPhone = normalizePhone(data.to);

      // Sincroniza cache local caso seja uma nova mensagem recebida ou resposta
      if (selectedAccount) {
        const localKey = `send_handled_chats_${selectedAccount.id}`;
        try {
          const raw = localStorage.getItem(localKey);
          if (data.direction === "INCOMING") {
            if (raw) {
              const list: string[] = JSON.parse(raw);
              const filtered = list.filter(p => normalizePhone(p) !== incomingPhone);
              localStorage.setItem(localKey, JSON.stringify(filtered));
            }
          } else if (data.isHandled) {
            const list: string[] = raw ? JSON.parse(raw) : [];
            localStorage.setItem(localKey, JSON.stringify(Array.from(new Set([...list, incomingPhone]))));
          }
        } catch {}
      }

      // A. Atualizar histórico se o chat com esse telefone estiver aberto no operador
      if (activePhone && normalizePhone(activePhone) === incomingPhone) {
        setChatMessages((prevMsgs) => {
          const idx = prevMsgs.findIndex((m) =>
            (data.wamid && m.wamid === data.wamid) || m.id === data.messageId
          );
          if (idx !== -1) {
            const updated = [...prevMsgs];
            updated[idx] = {
              ...updated[idx],
              status: data.status,
              wamid: data.wamid || updated[idx].wamid,
              mediaUrl: data.mediaUrl !== undefined ? data.mediaUrl : updated[idx].mediaUrl,
              errorMessage: data.errorMessage !== undefined ? data.errorMessage : updated[idx].errorMessage,
            };
            return updated;
          }

          // Se não estiver na lista, adiciona (mensagens recebidas/enviadas)
          return [...prevMsgs, {
            id: data.messageId,
            wamid: data.wamid,
            to: data.to,
            status: data.status,
            direction: data.direction,
            messageType: data.messageType,
            body: data.body,
            mediaUrl: data.mediaUrl,
            createdAt: data.updatedAt || new Date().toISOString(),
          }];
        });
      }

      // B. Atualizar lista de conversas ativas
      setConversations((prevConv) => {
        const idx = prevConv.findIndex((c) => normalizePhone(c.phone) === incomingPhone);
        const msgPreview = data.body || "Mídia";

        // Nova mensagem recebida (INCOMING) automaticamente reabre atendimento (isHandled = false)
        const newIsHandled = data.direction === "INCOMING"
          ? false
          : (data.isHandled !== undefined ? data.isHandled : undefined);

        const flagPatch = (c: any) => ({
          hasIncoming: c?.hasIncoming || data.direction === "INCOMING",
          hasFailed: c?.hasFailed || data.status === "FAILED",
          hasDelivered: c?.hasDelivered || data.status === "DELIVERED",
          hasRead: c?.hasRead || data.status === "READ",
        });

        if (idx !== -1) {
          const updated = [...prevConv];
          updated[idx] = {
            ...updated[idx],
            lastMessage: msgPreview,
            updatedAt: data.updatedAt || new Date().toISOString(),
            status: data.status,
            direction: data.direction,
            ...flagPatch(updated[idx]),
            ...(data.profileName ? { profileName: data.profileName } : {}),
            ...(newIsHandled !== undefined ? { isHandled: newIsHandled } : {}),
          };
          const item = updated.splice(idx, 1)[0];
          updated.unshift(item);
          return updated;
        } else {
          return [{
            phone: incomingPhone,
            profileName: data.profileName || null,
            lastMessage: msgPreview,
            updatedAt: data.updatedAt || new Date().toISOString(),
            status: data.status,
            direction: data.direction,
            messageType: data.messageType,
            isHandled: newIsHandled !== undefined ? newIsHandled : false,
            ...flagPatch(null),
          }, ...prevConv];
        }
      });
    }
  }, () => {
    // Quando o SSE reconectar, recarrega conversas e chat ativo do servidor
    if (selectedAccount) {
      fetchConversations(selectedAccount.id, true);
      if (selectedPhoneRef.current) {
        fetchChatMessages(selectedAccount.id, selectedPhoneRef.current, true);
      }
    }
  });

  return (
    <div className="fade-in chat-page-root" style={{ display: "flex", flexDirection: "column", gap: "6px", height: "100%", maxHeight: "100%", minHeight: 0, flex: 1, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, padding: "0 2px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h1 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, letterSpacing: "-0.01em", display: "flex", alignItems: "center", gap: "6px" }}>
            <span>💬</span> Caixa de Entrada
          </h1>
          <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", background: "rgba(255,255,255,0.06)", padding: "1px 7px", borderRadius: "10px", fontWeight: 500 }}>
            Live Chat
          </span>
        </div>
      </div>

      {!selectedAccount ? (
        <div className="glass" style={{ borderRadius: "var(--radius-xl)" }}>
          <div className="empty-state">
            <span className="empty-state__icon">💬</span>
            <span className="empty-state__title">Nenhuma conta selecionada</span>
            <span className="empty-state__desc">Configure ou ative uma conta Meta API para abrir a Caixa de Entrada.</span>
          </div>
        </div>
      ) : (
        <div className="glass chat-glass-container" style={{ display: "flex", flex: 1, minHeight: 0, borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--border-color)" }}>
          
          {/* 1. Lista de Conversas (Esquerda) */}
          <div className={`chat-panel-list${selectedPhone ? " mobile-hidden" : ""}`}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "0.88rem", fontWeight: "600" }}>Conversas</span>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: "8px" }}>
                  {conversations.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => fetchConversations(selectedAccount.id)}
                style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "0.95rem" }}
                title="Atualizar lista"
              >
                🔄
              </button>
            </div>

            {/* 1.1 Campo de Busca Instantânea Inteligente */}
            <div className="chat-search-bar" style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-color)", flexShrink: 0 }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <span style={{ position: "absolute", left: "10px", fontSize: "0.8rem", color: "var(--text-muted)", pointerEvents: "none" }}>🔍</span>
                <input
                  type="text"
                  placeholder="Buscar nome, número ou mensagem..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-control chat-search-input"
                  style={{
                    paddingLeft: "30px",
                    paddingRight: searchQuery ? "26px" : "8px",
                    fontSize: "0.78rem",
                    height: "32px",
                    borderRadius: "var(--radius-sm)"
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    style={{
                      position: "absolute",
                      right: "8px",
                      background: "none",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      padding: "2px"
                    }}
                    title="Limpar busca"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Filtro por período + exportação de leads */}
            <div style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <select
                  value={period}
                  onChange={(e) => applyPeriod(e.target.value)}
                  className="field-input"
                  style={{ fontSize: "0.74rem", padding: "4px 6px", cursor: "pointer", height: "28px", flex: 1, minWidth: 0 }}
                  title="Filtrar conversas por período"
                >
                  <option value="">Todos os períodos</option>
                  <option value="today">Hoje</option>
                  <option value="yesterday">Ontem</option>
                  <option value="3days">Últimos 3 dias</option>
                  <option value="7days">Últimos 7 dias</option>
                  <option value="custom">Personalizado...</option>
                </select>
                <button
                  type="button"
                  onClick={exportCsv}
                  disabled={isExporting}
                  style={{ fontSize: "0.72rem", padding: "3px 8px", height: "28px", background: "rgba(0,194,107,0.12)", border: "1px solid rgba(0,194,107,0.35)", borderRadius: "6px", color: "var(--primary)", cursor: isExporting ? "not-allowed" : "pointer", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "3px", whiteSpace: "nowrap" }}
                  title="Exportar os contatos filtrados para CSV"
                >
                  {isExporting ? "..." : "⬇️ CSV"}
                </button>
                {convFilter === "UNANSWERED" && filteredConversations.length > 0 && (
                  <button
                    type="button"
                    onClick={markAllFilteredAsHandled}
                    style={{
                      fontSize: "0.72rem",
                      padding: "3px 8px",
                      height: "28px",
                      background: "rgba(16, 185, 129, 0.15)",
                      border: "1px solid rgba(16, 185, 129, 0.4)",
                      borderRadius: "6px",
                      color: "#10b981",
                      cursor: "pointer",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px",
                      whiteSpace: "nowrap"
                    }}
                    title="Marcar todas as conversas desta fila como atendidas/concluídas"
                  >
                    ✓✓ Limpar ({filteredConversations.length})
                  </button>
                )}
              </div>
              {period === "custom" && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="date"
                    value={startDate}
                    max={endDate || undefined}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="field-input"
                    style={{ fontSize: "0.72rem", padding: "3px 6px", flex: 1, minWidth: 0, height: "26px" }}
                    title="Data inicial"
                  />
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>até</span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="field-input"
                    style={{ fontSize: "0.72rem", padding: "3px 6px", flex: 1, minWidth: 0, height: "26px" }}
                    title="Data final"
                  />
                </div>
              )}
            </div>

            {/* Filtros de conversas (chats) */}
            <div style={{ display: "flex", gap: "4px", padding: "6px 10px", borderBottom: "1px solid var(--border-color)", overflowX: "auto", flexWrap: "nowrap", flexShrink: 0 }}>
              {CONV_FILTERS.map(f => {
                const isActive = convFilter === f.key;
                const count = convFilterCounts[f.key as keyof typeof convFilterCounts] ?? 0;
                return (
                  <button
                    key={f.key}
                    type="button"
                    title={f.title}
                    onClick={() => setConvFilter(f.key)}
                    style={{
                      padding: "3px 8px",
                      borderRadius: "14px",
                      fontSize: "0.68rem",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      cursor: "pointer",
                      border: isActive
                        ? "1px solid var(--primary)"
                        : f.highlight && count > 0
                          ? "1px solid rgba(16, 185, 129, 0.55)"
                          : "1px solid var(--border-color)",
                      background: isActive
                        ? "rgba(0,194,107,0.22)"
                        : f.highlight && count > 0
                          ? "rgba(16, 185, 129, 0.12)"
                          : "transparent",
                      color: isActive
                        ? "var(--primary)"
                        : f.highlight && count > 0
                          ? "#10b981"
                          : "var(--text-muted)",
                      transition: "all 0.15s",
                      flexShrink: 0,
                    }}
                  >
                    {f.label} ({count})
                  </button>
                );
              })}
            </div>

            <div 
              onScroll={handleConversationsScroll}
              style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", minHeight: 0 }}
            >
              {isConversationsLoading ? (
                <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div className="skeleton" style={{ width: "100%", height: "60px", borderRadius: "8px" }}></div>
                  <div className="skeleton" style={{ width: "100%", height: "60px", borderRadius: "8px" }}></div>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-state__icon">{conversations.length === 0 ? "💬" : "🔍"}</span>
                  <span className="empty-state__desc">
                    {conversations.length === 0
                      ? "Nenhuma conversa ativa encontrada."
                      : "Nenhum chat corresponde ao filtro selecionado."}
                  </span>
                </div>
              ) : (
                <>
                  {displayedConversations.map((c) => {
                    const isActive = selectedPhone === c.phone;
                    const isHandledLead = isConversationHandled(c.phone, c);
                    const initials = c.profileName
                      ? c.profileName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
                      : "📱";
                    return (
                      <div
                        key={c.phone}
                        onClick={() => {
                          setSelectedPhone(c.phone);
                          setStatusFilter("ALL");
                          fetchChatMessages(selectedAccount.id, c.phone);
                        }}
                        className={`conv-item${isActive ? " active" : ""}`}
                      >
                        <div className="conv-actions">
                          <button
                            type="button"
                            className={`conv-action-btn ${isHandledLead ? "conv-action-btn--active" : "conv-action-btn--success"}`}
                            title={isHandledLead ? "Reabrir conversa (voltar para a fila de aguardando)" : "Marcar como Atendido / Concluído (retira da fila)"}
                            onClick={(e) => toggleHandled(c.phone, e)}
                          >
                            {isHandledLead ? "↩️" : "✅"}
                          </button>
                          <button
                            type="button"
                            className="conv-action-btn"
                            title="Mover para a Lista Negra"
                            onClick={(e) => blacklistContact(c.phone, e)}
                          >
                            🚫
                          </button>
                        </div>
                        <div className="conv-avatar">{initials}</div>
                        <div className="conv-item__body">
                          <div className="conv-item__top">
                            <span className="conv-item__name">
                              {c.profileName || c.phone}
                            </span>
                            <span className="conv-item__time">
                              {new Date(c.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="conv-item__preview" style={{
                            fontWeight: c.direction === "INCOMING" && !isHandledLead ? 600 : "normal",
                            color: c.direction === "INCOMING" && !isHandledLead ? "var(--text-primary)" : "var(--text-secondary)",
                          }}>
                            {c.direction === "OUTGOING" ? "Você: " : ""}{c.lastMessage}
                          </div>
                          {/* Badge unificado de status e SLA */}
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                            {(() => {
                              if (isHandledLead) {
                                return (
                                  <span style={{
                                    fontSize: "0.66rem",
                                    fontWeight: 600,
                                    color: "#34d399",
                                    background: "rgba(16, 185, 129, 0.16)",
                                    border: "1px solid rgba(16, 185, 129, 0.35)",
                                    padding: "1px 7px",
                                    borderRadius: "10px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "3px"
                                  }}>
                                    ✅ Concluído
                                  </span>
                                );
                              }

                            // Se for mensagem recebida (aguardando), usa o SLA de alto contraste como badge principal
                            if (c.direction === "INCOMING") {
                              const sla = getSlaInfo(c.updatedAt, c.direction, false);
                              return (
                                <span style={{
                                  fontSize: "0.66rem",
                                  fontWeight: 600,
                                  color: sla ? sla.color : "#34d399",
                                  background: sla ? sla.bg : "rgba(16, 185, 129, 0.18)",
                                  border: sla ? sla.border : "1px solid rgba(16, 185, 129, 0.45)",
                                  padding: "1px 7px",
                                  borderRadius: "10px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px"
                                }}>
                                  {sla ? sla.label : "🔥 Aguardando"}
                                </span>
                              );
                            }

                            const badge = c.hasIncoming && c.direction === "OUTGOING"
                              ? { text: "✓✓ Respondido", color: "var(--text-muted)", bg: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.08)" }
                              : c.hasFailed && !c.hasDelivered && !c.hasRead
                                ? { text: "⚠️ Falha", color: "#fca5a5", bg: "rgba(239, 68, 68, 0.2)", border: "1px solid rgba(239, 68, 68, 0.4)" }
                                : c.hasRead
                                  ? { text: "✓✓ Lida", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.12)", border: "1px solid rgba(56, 189, 248, 0.3)" }
                                  : c.hasDelivered
                                    ? { text: "✓✓ Entregue", color: "var(--text-secondary)", bg: "rgba(255, 255, 255, 0.06)", border: "none" }
                                    : c.direction === "OUTGOING"
                                      ? { text: "✓ Enviada", color: "var(--text-muted)", bg: "rgba(255, 255, 255, 0.04)", border: "none" }
                                      : null;
                            if (!badge) return null;
                            return (
                              <span style={{
                                fontSize: "0.66rem",
                                fontWeight: 600,
                                color: badge.color,
                                background: badge.bg,
                                border: badge.border || "none",
                                padding: "1px 7px",
                                borderRadius: "10px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px"
                              }}>
                                {badge.text}
                              </span>
                            );
                          })()}

                          {/* Badge de Estágio do Funil (se atribuído no CRM) */}
                          {(() => {
                            if (!selectedAccount) return null;
                            try {
                              const raw = localStorage.getItem(`send_crm_${selectedAccount.id}_${c.phone}`);
                              if (!raw) return null;
                              const crm = JSON.parse(raw);
                              if (!crm.stage || crm.stage === 'NEW') return null;
                              const stage = FUNNEL_STAGES[crm.stage as FunnelStage];
                              if (!stage) return null;
                              return (
                                <span style={{
                                  fontSize: "0.65rem",
                                  fontWeight: 600,
                                  color: stage.color,
                                  background: stage.bg,
                                  border: stage.border,
                                  padding: "2px 7px",
                                  borderRadius: "10px",
                                  display: "inline-flex",
                                  alignItems: "center"
                                }}>
                                  {stage.label}
                                </span>
                              );
                            } catch {
                              return null;
                            }
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {visibleCount < filteredConversations.length && (
                  <div style={{ padding: "12px", textAlign: "center", fontSize: "0.74rem", color: "var(--text-muted)" }}>
                    Exibindo {displayedConversations.length} de {filteredConversations.length} conversas • Role para carregar mais
                  </div>
                )}
              </>
            )}
            </div>
          </div>

          {/* 2. Área do Histórico de Chat (Direita) */}
          <div className={`chat-panel-msg${!selectedPhone ? " mobile-hidden" : ""}`}>
            {!selectedPhone ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className="empty-state">
                  <span className="empty-state__icon">💬</span>
                  <span className="empty-state__title">Nenhuma conversa aberta</span>
                  <span className="empty-state__desc">Selecione uma conversa ao lado para visualizar o atendimento.</span>
                </div>
              </div>
            ) : (
              <>
                {/* Header da conversa */}
                <div className="chat-header-bar" style={{ padding: "8px 14px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap", flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setSelectedPhone("")}
                    className="btn btn-secondary"
                    style={{ padding: "4px 8px", fontSize: "0.76rem", flexShrink: 0, display: "none" }}
                    id="chat-back-btn"
                  >
                    ← Voltar
                  </button>
                  <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: "160px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: "700", fontSize: "0.95rem" }}>
                        {conversations.find(c => c.phone === selectedPhone)?.profileName
                          ? `👤 ${conversations.find(c => c.phone === selectedPhone)?.profileName}`
                          : `📱 ${selectedPhone}`}
                      </span>

                      {/* Pill do Estágio do Funil (com seletor rápido) */}
                      <select
                        value={crmData.stage}
                        onChange={(e) => updateCrm(prev => ({ ...prev, stage: e.target.value as FunnelStage }))}
                        className="funnel-stage-select"
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "12px",
                          cursor: "pointer",
                          color: FUNNEL_STAGES[crmData.stage]?.color || "var(--text-primary)",
                          background: FUNNEL_STAGES[crmData.stage]?.bg || "transparent",
                          border: FUNNEL_STAGES[crmData.stage]?.border || "1px solid var(--border-color)",
                          outline: "none"
                        }}
                        title="Alterar etapa do funil do lead"
                      >
                        {(Object.keys(FUNNEL_STAGES) as FunnelStage[]).map(st => (
                          <option key={st} value={st} className="funnel-stage-option">
                            {FUNNEL_STAGES[st].label}
                          </option>
                        ))}
                      </select>

                      {/* SLA do Lead Ativo (se estiver aguardando resposta) */}
                      {(() => {
                        const currentConv = conversations.find(c => c.phone === selectedPhone);
                        if (!currentConv) return null;
                        const isSelHandled = isConversationHandled(selectedPhone, currentConv);
                        const sla = getSlaInfo(currentConv.updatedAt, currentConv.direction, isSelHandled);
                        if (!sla) return null;
                        return (
                          <span style={{
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            padding: "1px 7px",
                            borderRadius: "10px",
                            color: sla.color,
                            background: sla.bg,
                            border: sla.border
                          }}>
                            {sla.label}
                          </span>
                        );
                      })()}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "1px" }}>
                      <span>{selectedPhone}</span>
                      <a
                        href={`https://wa.me/${selectedPhone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--primary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "3px" }}
                        title="Abrir no WhatsApp Web"
                      >
                        <span>↗️</span> wa.me
                      </a>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {/* Botão de Concluir / Reabrir Atendimento */}
                    <button
                      type="button"
                      onClick={() => toggleHandled(selectedPhone)}
                      className="btn"
                      style={{
                        padding: "5px 10px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        borderRadius: "6px",
                        background: isConversationHandled(selectedPhone) ? "rgba(56, 189, 248, 0.12)" : "rgba(16, 185, 129, 0.14)",
                        border: isConversationHandled(selectedPhone) ? "1px solid rgba(56, 189, 248, 0.35)" : "1px solid rgba(16, 185, 129, 0.35)",
                        color: isConversationHandled(selectedPhone) ? "#38bdf8" : "#10b981",
                        cursor: "pointer",
                        transition: "all 0.18s ease"
                      }}
                      title={isConversationHandled(selectedPhone) ? "Reabrir atendimento (retorna para a fila de aguardando)" : "Marcar como Atendido / Concluído (retira da fila de espera)"}
                    >
                      <span>{isConversationHandled(selectedPhone) ? "↩️ Reabrir" : "✅ Atendido"}</span>
                    </button>

                    {/* Botão de Abrir/Fechar Mini-CRM */}
                    <button
                      type="button"
                      onClick={() => setShowCrmDrawer(!showCrmDrawer)}
                      className="chat-crm-toggle-btn"
                      style={{
                        padding: "5px 10px",
                        fontSize: "0.75rem",
                        background: showCrmDrawer ? "rgba(16, 185, 129, 0.2)" : undefined,
                        borderColor: showCrmDrawer ? "var(--primary)" : undefined,
                        color: showCrmDrawer ? "var(--primary)" : undefined
                      }}
                      title="Abrir painel lateral com histórico, tags e anotações deste lead"
                    >
                      <span>👤</span> Ficha
                    </button>

                    <button
                      type="button"
                      onClick={() => fetchChatMessages(selectedAccount.id, selectedPhone)}
                      className="btn btn-secondary"
                      style={{ padding: "5px 10px", fontSize: "0.75rem" }}
                    >
                      🔄
                    </button>
                  </div>
                </div>

                {/* Barra de filtros por status */}
                <div className="chat-templates-bar" style={{ display: "flex", gap: "4px", padding: "4px 14px", borderBottom: "1px solid var(--border-color)", overflowX: "auto", flexWrap: "nowrap", flexShrink: 0 }}>
                  {FILTERS.map(f => {
                    const isActive = statusFilter === f.key;
                    const count = f.key === "ALL"
                      ? chatMessages.length
                      : f.key === "INCOMING"
                        ? chatMessages.filter(m => m.direction === "INCOMING").length
                        : chatMessages.filter(m => m.direction !== "INCOMING" && m.status === f.key).length;
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setStatusFilter(f.key)}
                        style={{
                          padding: "2px 8px",
                          borderRadius: "12px",
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          cursor: "pointer",
                          border: isActive ? "1px solid var(--primary)" : "1px solid var(--border-color)",
                          background: isActive ? "rgba(0,194,107,0.15)" : "transparent",
                          color: isActive ? "var(--primary)" : "var(--text-muted)",
                          transition: "all 0.15s",
                        }}
                      >
                        {f.label} {count > 0 ? `(${count})` : ""}
                      </button>
                    );
                  })}
                </div>

                {/* Mensagens do chat */}
                <div style={{ flex: 1, minHeight: 0, padding: "12px 16px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {isChatLoading ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%", height: "100%", justifyContent: "center", alignItems: "center", color: "var(--text-muted)" }}>
                      <div className="skeleton" style={{ width: "60%", height: "40px", borderRadius: "12px", alignSelf: "flex-start" }} />
                      <div className="skeleton" style={{ width: "40%", height: "40px", borderRadius: "12px", alignSelf: "flex-end" }} />
                    </div>
                  ) : filteredMessages.length === 0 ? (
                    <div className="empty-state" style={{ flex: 1, justifyContent: "center" }}>
                      <span className="empty-state__icon">🔍</span>
                      <span className="empty-state__desc">
                        {chatMessages.length === 0
                          ? "Nenhuma mensagem nesta conversa ainda."
                          : "Nenhuma mensagem corresponde ao filtro selecionado."}
                      </span>
                    </div>
                  ) : (
                    <>
                      {filteredMessages.map((msg, index) => {
                        const isIncoming = msg.direction === "INCOMING";
                        const prevMsg = index > 0 ? filteredMessages[index - 1] : null;
                        const msgDate = new Date(msg.createdAt).toDateString();
                        const prevDate = prevMsg ? new Date(prevMsg.createdAt).toDateString() : null;
                        const showDateDivider = msgDate !== prevDate;

                        return (
                          <div key={msg.id || index} style={{ display: "flex", flexDirection: "column", width: "100%" }}>
                            {showDateDivider && (
                              <div style={{ display: "flex", justifyContent: "center", margin: "10px 0 6px 0" }}>
                                <span style={{
                                  fontSize: "0.72rem",
                                  fontWeight: 600,
                                  background: "rgba(17, 24, 39, 0.88)",
                                  backdropFilter: "blur(8px)",
                                  color: "var(--text-muted)",
                                  padding: "3px 12px",
                                  borderRadius: "12px",
                                  border: "1px solid rgba(255, 255, 255, 0.08)",
                                  boxShadow: "0 1px 4px rgba(0, 0, 0, 0.25)"
                                }}>
                                  {formatDateDivider(msg.createdAt)}
                                </span>
                              </div>
                            )}

                            <div
                              className={`msg-bubble-wrap msg-bubble-wrap--${isIncoming ? "in" : "out"}`}
                            >
                            <div className={`msg-bubble msg-bubble--${isIncoming ? "in" : "out"}`}>
                              {/* Mídia do cabeçalho do template (OUTGOING) */}
                              {(() => {
                                const mediaUrl = msg.mediaUrl || msg.variables?.mediaUrl;
                                const tmpl = templates.find(t => t.name === msg.templateName);
                                const headerComp = tmpl && Array.isArray(tmpl.components)
                                  ? tmpl.components.find((c: any) => c.type === "HEADER")
                                  : null;
                                const fmt = (headerComp?.format || msg.messageType || "").toUpperCase();

                                // Mídia OUTGOING direta ou de template
                                if (mediaUrl && msg.direction !== "INCOMING") {
                                  if (fmt === "IMAGE") return (
                                    <img src={mediaUrl} alt="Imagem" style={{ maxWidth: "100%", borderRadius: "8px", marginBottom: "6px", display: "block" }} />
                                  );
                                  if (fmt === "VIDEO") return (
                                    <video src={mediaUrl} controls style={{ maxWidth: "100%", borderRadius: "8px", marginBottom: "6px", display: "block" }} />
                                  );
                                  if (fmt === "AUDIO" || fmt === "VOICE") return (
                                    <AudioMessagePlayer src={mediaUrl} />
                                  );
                                  if (fmt === "DOCUMENT") return (
                                    <a href={mediaUrl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--primary)", marginBottom: "6px" }}>
                                      📄 {mediaUrl.split("/").pop() || "Documento"}
                                    </a>
                                  );
                                }

                                // Mídia recebida (INCOMING) - se for ID da Meta, buscar via proxy autenticado com token na query
                                if (mediaUrl && msg.direction === "INCOMING" && selectedAccount) {
                                  const isExternal = mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://") || mediaUrl.startsWith("data:") || mediaUrl.startsWith("blob:");
                                  const currentToken = authToken || localStorage.getItem("token") || "";
                                  const tokenParam = currentToken ? `?token=${encodeURIComponent(currentToken)}` : "";
                                  const proxyUrl = isExternal
                                    ? mediaUrl
                                    : `${API_BASE_URL}/accounts/${selectedAccount.id}/media/${mediaUrl}${tokenParam}`;

                                  if (fmt === "IMAGE") return (
                                    <img src={proxyUrl} alt="Imagem recebida" style={{ maxWidth: "100%", borderRadius: "8px", marginBottom: "6px", display: "block" }} />
                                  );
                                  if (fmt === "VIDEO") return (
                                    <video src={proxyUrl} controls style={{ maxWidth: "100%", borderRadius: "8px", marginBottom: "6px", display: "block" }} />
                                  );
                                  if (fmt === "AUDIO" || fmt === "VOICE") return (
                                    <AudioMessagePlayer src={proxyUrl} />
                                  );
                                  if (fmt === "DOCUMENT") return (
                                    <a href={proxyUrl} target="_blank" rel="noreferrer" download style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--primary)", marginBottom: "6px" }}>
                                      📄 Documento recebido
                                    </a>
                                  );
                                  return (
                                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "6px" }}>
                                      📎 Arquivo recebido
                                    </div>
                                  );
                                }
                                return null;
                              })()}

                              {/* Texto da mensagem */}
                              {(() => {
                                const isAudioMsg = (msg.messageType || "").toUpperCase() === "AUDIO" || (msg.messageType || "").toUpperCase() === "VOICE";
                                if (isAudioMsg && (!msg.body || msg.body === "🎤 Mensagem de voz" || msg.body === "🎵 Áudio" || msg.body === "Mensagem de voz")) {
                                  return null;
                                }
                                let rawText = msg.body;
                                if (!rawText && msg.templateName) {
                                  const tmpl = templates.find(t => t.name === msg.templateName);
                                  if (!tmpl) return `📋 Template: ${msg.templateName}`;
                                  const bodyComp = Array.isArray(tmpl.components)
                                    ? tmpl.components.find((c: any) => c.type === "BODY")
                                    : null;
                                  if (!bodyComp || !bodyComp.text) return `📋 Template: ${msg.templateName}`;
                                  let text = bodyComp.text;
                                  const resolvedVars = msg.variables?.variables || [];
                                  if (Array.isArray(resolvedVars)) {
                                    resolvedVars.forEach((val: any, idx: number) => {
                                      text = text.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'), val);
                                    });
                                  }
                                  rawText = text;
                                }
                                if (!rawText) return (!msg.mediaUrl && !msg.variables?.mediaUrl ? "Mídia" : null);
                                return renderWhatsAppFormatted(rawText);
                              })()}
                            </div>
                            <div className="msg-time" style={{ display: "flex", gap: "6px" }}>
                              <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {!isIncoming && (
                                <span style={{
                                  color: msg.status === "READ" ? "var(--success)" :
                                         msg.status === "DELIVERED" ? "#22d3ee" :
                                         msg.status === "FAILED" ? "var(--error)" : "var(--text-muted)"
                                }}>
                                  {msg.status === "READ" ? "✓✓ Lido" :
                                   msg.status === "DELIVERED" ? "✓✓ Entregue" :
                                   msg.status === "SENT" ? "✓ Enviado" :
                                   msg.status === "FAILED" ? "⚠️ Falha" : "Enviando..."}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                      })}
                      
                      {/* Âncora para auto-scroll */}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Janela de 24h & Campo de Digitação */}
                {(() => {
                  const getLastIncoming = () => {
                    for (let i = chatMessages.length - 1; i >= 0; i--) {
                      if (chatMessages[i].direction === "INCOMING") return chatMessages[i];
                    }
                    return null;
                  };
                  const lastInc = getLastIncoming();
                  let isWindowActive = false;
                  let timeRemainingStr = "";

                  if (lastInc) {
                    const lastIncTime = new Date(lastInc.createdAt).getTime();
                    const now = new Date().getTime();
                    const diffMs = now - lastIncTime;
                    const diffHrs = diffMs / (1000 * 60 * 60);
                    
                    if (diffHrs < 24) {
                      isWindowActive = true;
                      const remainingMs = (24 * 60 * 60 * 1000) - diffMs;
                      const remHrs = Math.floor(remainingMs / (1000 * 60 * 60));
                      const remMins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
                      timeRemainingStr = `${remHrs}h ${remMins}m`;
                    }
                  }

                  return (
                    <div className="chat-input-container" style={{
                      padding: "8px 14px",
                      borderTop: "1px solid var(--border-color)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "5px",
                      flexShrink: 0,
                      background: "rgba(16, 18, 22, 0.98)",
                      boxShadow: "0 -4px 16px rgba(0, 0, 0, 0.25)",
                      zIndex: 10
                    }}>
                      
                      {lastInc ? (
                        isWindowActive ? (
                          <div style={{
                            background: "rgba(16, 185, 129, 0.08)",
                            border: "1px solid rgba(16, 185, 129, 0.22)",
                            borderRadius: "6px",
                            padding: "3px 8px",
                            fontSize: "0.74rem",
                            color: "var(--success)",
                            fontWeight: "500",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            width: "fit-content"
                          }}>
                            <span className="window-badge" style={{ fontSize: "0.68rem", padding: "1px 6px" }}><span className="dot" />Janela aberta</span>
                            <span style={{ fontSize: "0.72rem" }}>Responda livremente · Expira em <strong>{timeRemainingStr}</strong></span>
                          </div>
                        ) : (
                          <div style={{
                            background: "rgba(245, 158, 11, 0.08)",
                            border: "1px solid rgba(245, 158, 11, 0.22)",
                            borderRadius: "6px",
                            padding: "4px 8px",
                            fontSize: "0.73rem",
                            color: "#f59e0b",
                            fontWeight: "500",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px"
                          }}>
                            <span>⚠️ <strong>Janela Expirada:</strong> Envie um Template para reabrir.</span>
                          </div>
                        )
                      ) : (
                        <div style={{
                          background: "rgba(255, 255, 255, 0.02)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "6px",
                          padding: "4px 8px",
                          fontSize: "0.73rem",
                          color: "var(--text-secondary)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px"
                        }}>
                          <span>ℹ️ O cliente ainda não respondeu ao disparo. Respostas de texto livre disponíveis após interação dele.</span>
                        </div>
                      )}

                      {/* Barra de Respostas Rápidas (1-Clique / Canned Responses) */}
                      {(!lastInc || isWindowActive) && (
                        <div className="quick-replies-toolbar" style={{ padding: "0", gap: "4px" }}>
                          <div className="quick-replies-scroll-area" style={{ gap: "4px" }}>
                            <span className="quick-replies-label" style={{ fontSize: "0.7rem" }}>
                              <span>⚡</span> Rápidas:
                            </span>
                            {quickReplies.map((qr) => (
                              <button
                                key={qr.id}
                                type="button"
                                onClick={() => {
                                  setReplyBody(prev => (prev.trim() ? prev + "\n\n" + qr.text : qr.text));
                                  setTimeout(() => {
                                    if (replyTextareaRef.current) {
                                      replyTextareaRef.current.focus();
                                      replyTextareaRef.current.style.height = "auto";
                                      replyTextareaRef.current.style.height = `${Math.min(replyTextareaRef.current.scrollHeight, 120)}px`;
                                    }
                                  }, 10);
                                }}
                                className="quick-reply-chip"
                                style={{ fontSize: "0.72rem", padding: "3px 9px", display: "inline-flex", alignItems: "center", gap: "5px" }}
                                title={qr.text.slice(0, 120) + (qr.text.length > 120 ? "..." : "")}
                              >
                                <span>{getQrIcon(qr.title)}</span>
                                <span>{qr.title}</span>
                              </button>
                            ))}
                            {quickReplies.length === 0 && (
                              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                                Nenhuma resposta cadastrada.
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingQrId(null);
                              setQrTitleInput("");
                              setQrTextInput("");
                              setShowQuickReplyModal(true);
                            }}
                            className="quick-reply-manage-btn"
                            style={{ fontSize: "0.7rem", padding: "2px 6px" }}
                            title="Gerenciar e criar novas respostas rápidas"
                          >
                            <span>⚙️</span>
                          </button>
                        </div>
                      )}

                      {/* Barra de Formatação estilo WhatsApp e Botão de Prévia */}
                      {(!lastInc || isWindowActive) && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2px", padding: "0 2px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <button
                              type="button"
                              onClick={() => insertFormat("*")}
                              title="Negrito (*texto*)"
                              className="chat-fmt-btn"
                              style={{ fontWeight: "bold", padding: "2px 6px", fontSize: "0.7rem" }}
                            >
                              B
                            </button>
                            <button
                              type="button"
                              onClick={() => insertFormat("_")}
                              title="Itálico (_texto_)"
                              className="chat-fmt-btn"
                              style={{ fontStyle: "italic", padding: "2px 6px", fontSize: "0.7rem" }}
                            >
                              I
                            </button>
                            <button
                              type="button"
                              onClick={() => insertFormat("~")}
                              title="Tachado (~texto~)"
                              className="chat-fmt-btn"
                              style={{ textDecoration: "line-through", padding: "2px 6px", fontSize: "0.7rem" }}
                            >
                              S
                            </button>
                            <button
                              type="button"
                              onClick={() => insertFormat("• ")}
                              title="Marcador de Lista"
                              className="chat-fmt-btn"
                              style={{ padding: "2px 6px", fontSize: "0.7rem" }}
                            >
                              • Lista
                            </button>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            {replyBody.trim() && (
                              <button
                                type="button"
                                onClick={() => setShowPreview(!showPreview)}
                                className="chat-fmt-btn"
                                style={{
                                  background: showPreview ? "rgba(16, 185, 129, 0.2)" : undefined,
                                  borderColor: showPreview ? "var(--primary, #10b981)" : undefined,
                                  color: showPreview ? "var(--primary, #10b981)" : undefined,
                                  fontSize: "0.7rem",
                                  padding: "2px 7px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "3px"
                                }}
                                title="Ver como o cliente receberá no WhatsApp"
                              >
                                <span>📱</span> {showPreview ? "Ocultar" : "Prévia"}
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Balão de Prévia Realística do WhatsApp (quando ativo) */}
                      {showPreview && replyBody.trim() && (
                        <div style={{
                          background: "rgba(15, 23, 42, 0.85)",
                          border: "1px solid rgba(16, 185, 129, 0.3)",
                          borderRadius: "10px",
                          padding: "10px 14px",
                          marginBottom: "8px",
                          backdropFilter: "blur(6px)"
                        }}>
                          <div style={{ fontSize: "0.72rem", color: "var(--primary, #10b981)", fontWeight: 600, marginBottom: "6px", display: "flex", justifyContent: "space-between" }}>
                            <span>📱 Prévia exata no WhatsApp do cliente:</span>
                            <button
                              type="button"
                              onClick={() => setShowPreview(false)}
                              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.75rem" }}
                            >
                              ✕ Fechar prévia
                            </button>
                          </div>
                          <div style={{
                            background: "#005c4b", // Verde do balão enviado no WhatsApp Dark
                            color: "#e9edef",
                            borderRadius: "12px 12px 2px 12px",
                            padding: "8px 12px",
                            fontSize: "0.88rem",
                            lineHeight: "1.45",
                            wordBreak: "break-word",
                            display: "inline-block",
                            maxWidth: "92%",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.35)"
                          }}>
                            {renderWhatsAppFormatted(replyBody)}
                            <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.6)", textAlign: "right", marginTop: "4px" }}>
                              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Campo de digitação de mensagem e botões */}
                      <form onSubmit={sendReply} style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
                        <textarea
                          ref={replyTextareaRef}
                          placeholder={
                            !lastInc || isWindowActive 
                              ? "Digite a sua resposta... (Shift+Enter para pular linha, Enter para enviar)" 
                              : "Janela expirada — envie um template para reabrir..."
                          }
                          value={replyBody}
                          onChange={(e) => {
                            setReplyBody(e.target.value);
                            e.target.style.height = "auto";
                            e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
                          }}
                          onPaste={(e) => {
                            const text = e.clipboardData.getData("text/plain");
                            if (!text) return;
                            e.preventDefault();
                            // Preserva quebras de linha estritamente e normaliza formato de markdown
                            const normalized = text
                              .replace(/\r\n/g, "\n")
                              .replace(/\r/g, "\n")
                              .replace(/\*\*([^*\n]+)\*\*/g, "*$1*");
                            
                            const ta = replyTextareaRef.current;
                            if (!ta) return;
                            const start = ta.selectionStart;
                            const end = ta.selectionEnd;
                            const nextVal = replyBody.substring(0, start) + normalized + replyBody.substring(end);
                            setReplyBody(nextVal);
                            setTimeout(() => {
                              ta.focus();
                              ta.selectionStart = ta.selectionEnd = start + normalized.length;
                              ta.style.height = "auto";
                              ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
                            }, 0);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              sendReply();
                            }
                          }}
                          disabled={lastInc ? !isWindowActive : true}
                          className="chat-textarea form-control"
                          rows={1}
                          style={{
                            flex: 1,
                            padding: "8px 12px",
                            borderRadius: "var(--radius-md)",
                            resize: "none",
                            minHeight: "40px",
                            maxHeight: "110px",
                            lineHeight: "1.4",
                            overflowY: "auto",
                            fontFamily: "inherit",
                            fontSize: "0.86rem"
                          }}
                        />
                        <button
                          type="submit"
                          className="chat-send-btn btn btn-primary"
                          style={{ height: "40px", flexShrink: 0 }}
                          disabled={isSendingReply || !replyBody.trim() || (lastInc ? !isWindowActive : true)}
                        >
                          {isSendingReply ? "Enviando..." : "Enviar ✈️"}
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => setShowChatTemplateModal(true)}
                          className="btn btn-secondary"
                          style={{ padding: "0 14px", borderRadius: "var(--radius-md)", whiteSpace: "nowrap", height: "40px", flexShrink: 0, fontSize: "0.82rem" }}
                          title="Enviar Template de Mensagem"
                        >
                          📝 Reabrir
                        </button>
                      </form>
                    </div>
                  );
                })()}
              </>
            )}
          </div>

          {/* 3. Gaveta Lateral / Mini-CRM do Lead (Retrátil) */}
          {selectedPhone && showCrmDrawer && (
            <div className="chat-panel-crm">
              {/* Topo do Mini-CRM */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "1.1rem" }}>👤</span>
                  <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>Ficha do Lead (CRM)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCrmDrawer(false)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: "1.1rem",
                    padding: "4px"
                  }}
                  title="Fechar Ficha do Lead"
                >
                  ✕
                </button>
              </div>

              {/* Informações do Lead */}
              <div style={{
                background: "rgba(255, 255, 255, 0.03)",
                borderRadius: "10px",
                padding: "12px",
                border: "1px solid var(--border-color)",
                display: "flex",
                flexDirection: "column",
                gap: "4px"
              }}>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                  {conversations.find(c => c.phone === selectedPhone)?.profileName || "Nome não identificado"}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
                  {selectedPhone}
                </div>
                <div style={{ marginTop: "6px", display: "flex", gap: "8px" }}>
                  <a
                    href={`https://wa.me/${selectedPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{
                      fontSize: "0.72rem",
                      padding: "4px 8px",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px"
                    }}
                  >
                    <span>💬</span> WhatsApp Web ↗
                  </a>
                </div>
              </div>

              {/* Etapa do Funil */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Etapa do Funil de Vendas
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {(Object.keys(FUNNEL_STAGES) as FunnelStage[]).map((stageKey) => {
                    const stage = FUNNEL_STAGES[stageKey];
                    const isCurrent = crmData.stage === stageKey;
                    return (
                      <button
                        key={stageKey}
                        type="button"
                        onClick={() => updateCrm(prev => ({ ...prev, stage: stageKey }))}
                        style={{
                          padding: "8px 12px",
                          borderRadius: "8px",
                          fontSize: "0.78rem",
                          fontWeight: isCurrent ? 700 : 500,
                          textAlign: "left",
                          cursor: "pointer",
                          border: isCurrent ? stage.border : "1px solid transparent",
                          background: isCurrent ? stage.bg : "rgba(255,255,255,0.03)",
                          color: isCurrent ? stage.color : "var(--text-secondary)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          transition: "all 0.15s ease"
                        }}
                      >
                        <span>{stage.label}</span>
                        {isCurrent && <span style={{ fontWeight: 800 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tags / Etiquetas */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Etiquetas / Segmentação
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", minHeight: "26px" }}>
                  {crmData.tags.length === 0 ? (
                    <span style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                      Nenhuma tag adicionada
                    </span>
                  ) : (
                    crmData.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: "0.72rem",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          background: "rgba(16, 185, 129, 0.15)",
                          border: "1px solid rgba(16, 185, 129, 0.35)",
                          color: "#10b981",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => updateCrm(prev => ({ ...prev, tags: prev.tags.filter((_, i) => i !== idx) }))}
                          style={{ background: "none", border: "none", color: "#10b981", cursor: "pointer", padding: "0 2px", fontSize: "0.75rem", lineHeight: 1 }}
                          title="Remover tag"
                        >
                          ✕
                        </button>
                      </span>
                    ))
                  )}
                </div>
                <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                  <input
                    type="text"
                    placeholder="Adicionar tag (Enter)..."
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const cleaned = newTagInput.trim().replace(/^#/, "");
                        if (cleaned && !crmData.tags.includes(cleaned)) {
                          updateCrm(prev => ({ ...prev, tags: [...prev.tags, cleaned] }));
                          setNewTagInput("");
                        }
                      }
                    }}
                    className="form-control"
                    style={{ fontSize: "0.75rem", padding: "5px 8px", height: "32px" }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const cleaned = newTagInput.trim().replace(/^#/, "");
                      if (cleaned && !crmData.tags.includes(cleaned)) {
                        updateCrm(prev => ({ ...prev, tags: [...prev.tags, cleaned] }));
                        setNewTagInput("");
                      }
                    }}
                    className="btn btn-secondary"
                    style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Anotações Privadas do Atendimento */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Notas da Negociação
                  </label>
                  <span style={{ fontSize: "0.68rem", color: "#10b981" }}>● Auto-salvamento</span>
                </div>
                <textarea
                  placeholder="Ex: Cliente tem interesse em 3 frascos do Body Splash Ternura. Aguardando envio do comprovante PIX até as 17h..."
                  value={crmData.notes}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateCrm(prev => ({ ...prev, notes: val }));
                  }}
                  className="form-control"
                  style={{
                    fontSize: "0.8rem",
                    padding: "10px",
                    borderRadius: "8px",
                    minHeight: "120px",
                    resize: "vertical",
                    flex: 1,
                    lineHeight: "1.45"
                  }}
                />
                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                  🔒 Estas notas são visíveis apenas para a sua equipe e não são enviadas ao cliente.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de Enviar Template no Chat */}
      {showChatTemplateModal && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }}>
          <div className="glass" style={{ width: "90%", maxWidth: "500px", padding: "30px", borderRadius: "var(--radius-xl)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: "700" }}>Enviar Template de Mensagem</h3>
              <button 
                type="button" 
                onClick={() => {
                  setShowChatTemplateModal(false);
                  setSelectedTemplateName("");
                  setTemplateVariables([]);
                }} 
                style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-secondary)" }}>Selecione o Template</label>
                <select
                  className="form-control"
                  value={selectedTemplateName}
                  onChange={(e) => {
                    const name = e.target.value;
                    setSelectedTemplateName(name);
                    const t = templates.find(temp => temp.name === name);
                    if (t) {
                      const body = Array.isArray(t.components) ? t.components.find(c => c.type === "BODY")?.text || "" : "";
                      const vars = detectBodyVariables(body);
                      setTemplateVariables(vars.map(() => ""));
                    } else {
                      setTemplateVariables([]);
                    }
                  }}
                >
                  <option value="">Selecione...</option>
                  {templates.filter(t => t.status === "APPROVED").map(t => (
                    <option key={t.id} value={t.name}>{t.name} ({t.language})</option>
                  ))}
                </select>
              </div>

              {/* Variáveis do Template */}
              {templateVariables.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-secondary)" }}>Preencha as variáveis</label>
                  {templateVariables.map((v, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Variável {"{{"}{i + 1}{"}}"}</span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder={`Valor para {{${i + 1}}}`}
                        value={v}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTemplateVariables(prev => {
                            const next = [...prev];
                            next[i] = val;
                            return next;
                          });
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                className="btn btn-primary"
                style={{ width: "100%", padding: "12px", marginTop: "10px" }}
                disabled={!selectedTemplateName || (templateVariables.length > 0 && templateVariables.some(v => !v.trim()))}
                onClick={async () => {
                  if (!selectedAccount || !selectedPhone || !selectedTemplateName) return;
                  try {
                    setIsChatLoading(true);
                    await axios.post(`${API_BASE_URL}/accounts/${selectedAccount.id}/messages/send`, {
                      to: selectedPhone,
                      templateName: selectedTemplateName,
                      variables: templateVariables,
                    });
                    
                    setShowChatTemplateModal(false);
                    setSelectedTemplateName("");
                    setTemplateVariables([]);
                    showAlert("Template enviado com sucesso! 🚀", "success");
                    
                    setTimeout(() => fetchChatMessages(selectedAccount.id, selectedPhone, true), 1000);
                  } catch (err: any) {
                    const details = err.response?.data?.error || "Erro desconhecido";
                    showAlert(`Falha ao enviar template: ${details}`, "error");
                  } finally {
                    setIsChatLoading(false);
                  }
                }}
              >
                Enviar Template ✈️
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gerenciamento de Respostas Rápidas */}
      {showQuickReplyModal && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }}>
          <div className="glass" style={{ width: "90%", maxWidth: "600px", maxHeight: "90vh", display: "flex", flexDirection: "column", padding: "24px", borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "1.2rem" }}>⚡</span>
                <h3 style={{ fontSize: "1.15rem", fontWeight: "700", margin: 0 }}>Respostas Rápidas (Canned Responses)</h3>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  setShowQuickReplyModal(false);
                  setEditingQrId(null);
                  setQrTitleInput("");
                  setQrTextInput("");
                }} 
                style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 14px 0" }}>
              Cadastre mensagens padrão (ofertas, dados bancários, dúvidas frequentes) para agilizar o atendimento de alta demanda com apenas 1 clique.
            </p>

            {/* Formulário de Adicionar / Editar */}
            <div style={{ background: "rgba(255,255,255,0.03)", padding: "14px", borderRadius: "10px", border: "1px solid var(--border-color)", marginBottom: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--primary)" }}>
                {editingQrId ? "✏️ Editar Resposta Rápida" : "➕ Nova Resposta Rápida"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Título do Botão (ex: 🎁 Oferta Body Splash):</label>
                <input
                  type="text"
                  placeholder="Ex: 💳 Chave PIX"
                  value={qrTitleInput}
                  onChange={(e) => setQrTitleInput(e.target.value)}
                  className="form-control"
                  style={{ fontSize: "0.82rem", height: "36px" }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Texto da Mensagem (pode usar formatação do WhatsApp *negrito*, etc):</label>
                <textarea
                  placeholder="Digite a mensagem completa..."
                  value={qrTextInput}
                  onChange={(e) => setQrTextInput(e.target.value)}
                  className="form-control"
                  style={{ fontSize: "0.82rem", minHeight: "85px", resize: "vertical" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
                {editingQrId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingQrId(null);
                      setQrTitleInput("");
                      setQrTextInput("");
                    }}
                    className="btn btn-secondary"
                    style={{ fontSize: "0.78rem", padding: "6px 12px" }}
                  >
                    Cancelar Edição
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveQuickReply}
                  className="btn btn-primary"
                  style={{ fontSize: "0.78rem", padding: "6px 14px" }}
                >
                  {editingQrId ? "Salvar Alterações" : "Adicionar Resposta"}
                </button>
              </div>
            </div>

            {/* Lista de Respostas Atuais */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", maxHeight: "240px" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                Respostas Salvas ({quickReplies.length})
              </div>
              {quickReplies.map((qr) => (
                <div
                  key={qr.id}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-color)",
                    background: "rgba(255,255,255,0.02)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "10px"
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--text-primary)" }}>
                      {qr.title}
                    </div>
                    <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: "2px" }}>
                      {qr.text.replace(/\n/g, " ")}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingQrId(qr.id);
                        setQrTitleInput(qr.title);
                        setQrTextInput(qr.text);
                      }}
                      className="btn btn-secondary"
                      style={{ padding: "4px 8px", fontSize: "0.72rem" }}
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteQuickReply(qr.id)}
                      className="btn btn-secondary"
                      style={{ padding: "4px 8px", fontSize: "0.72rem", color: "var(--error)" }}
                      title="Excluir"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Rodapé do Modal */}
            <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                onClick={handleResetQuickReplies}
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "0.75rem", cursor: "pointer", textDecoration: "underline" }}
              >
                🔄 Restaurar modelos de fábrica
              </button>

              <button
                type="button"
                onClick={() => setShowQuickReplyModal(false)}
                className="btn btn-primary"
                style={{ fontSize: "0.8rem", padding: "6px 14px" }}
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
