import React, { useState, useEffect, useRef, useMemo, useCallback, useDeferredValue } from "react";
import axios from "axios";
import { useAccount } from "../contexts/AccountContext";
import { useAlert } from "../contexts/AlertContext";
import { useConfirm } from "../hooks/useConfirm";
import Modal from "../components/Modal";
import { getInitials } from "../utils/formatters";
import { Edit2, Trash2 } from "lucide-react";
import { useSSE } from "../hooks/useSSE";
import { API_BASE_URL, useAuth } from "../contexts/AuthContext";
import { chatCache } from "../utils/chatCache";

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
        padding: "var(--space-2-5) var(--space-3-5)",
        borderRadius: "var(--radius-md)",
        background: "color-mix(in srgb, var(--error) 12%, transparent)",
        border: "1px solid color-mix(in srgb, var(--error) 25%, transparent)",
        color: "var(--error)",
        fontSize: "var(--fs-md)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2-5)",
        minWidth: "250px"
      }}>
        <span style={{ fontSize: "var(--fs-lg)" }}>⚠️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>Áudio temporariamente indisponível.</div>
          <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-1)" }}>
            <button
              type="button"
              onClick={() => setRetryCount(c => c + 1)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--primary)",
                fontSize: "var(--fs-xs)",
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
              style={{ color: "var(--text-muted)", fontSize: "var(--fs-xs)", textDecoration: "underline" }}
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
    // Largura vem do balão (.msg-bubble:has(.audio-player) em index.css); antes o min-width fixo
    // de 260px fazia a onda, o "1x" e o download vazarem do balão em conversas estreitas.
    <div className="audio-player" style={{
      display: "flex",
      alignItems: "center",
      gap: "var(--space-3)",
      padding: "var(--space-1) var(--space-0-5)",
      width: "100%",
      minWidth: 0
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
            ? "linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)"
            : "linear-gradient(135deg, var(--primary-hover) 0%, color-mix(in srgb, var(--primary-hover) 80%, black) 100%)",
          boxShadow: isPlaying
            ? "0 4px 14px color-mix(in srgb, var(--primary) 45%, transparent)"
            : "var(--shadow-md)",
          border: "none",
          color: "var(--on-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: loading ? "wait" : "pointer",
          flexShrink: 0,
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        }}
        className="icon-action--round"
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        title={isPlaying ? "Pausar" : "Ouvir áudio"}
        aria-label={isPlaying ? "Pausar áudio" : "Ouvir áudio"}
      >
        {loading ? (
          <div style={{
            width: "15px",
            height: "15px",
            border: "2px solid color-mix(in srgb, currentColor 30%, transparent)",
            borderTopColor: "currentColor",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite"
          }} />
        ) : isPlaying ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1.5" />
            <rect x="14" y="4" width="4" height="16" rx="1.5" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: "var(--space-0-5)" }}>
            <path d="M8 5.14v13.72a1 1 0 001.55.83l11-6.86a1 1 0 000-1.66l-11-6.86A1 1 0 008 5.14z" />
          </svg>
        )}
      </button>

      {/* Conteúdo Central: Onda Sonora Interativa + Metadados */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-1-5)", minWidth: 0 }}>
        {/* Waveform Scrubber */}
        <div
          ref={waveformRef}
          onClick={handleWaveformClick}
          style={{
            height: "28px",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-0-5)",
            cursor: duration > 0 ? "pointer" : "default",
            padding: "var(--space-0-5) 0",
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
                  borderRadius: "var(--radius-xs)",
                  background: isFilled ? "var(--primary)" : "color-mix(in srgb, var(--text-primary) 22%, transparent)",
                  transition: "background 0.1s ease",
                }}
              />
            );
          })}
        </div>

        {/* Linha Inferior: Duração + Velocidade + Download */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", fontSize: "var(--fs-xs)", color: "var(--text-muted)", fontWeight: 500 }}>
            <span>🎙️</span>
            <span>
              {isPlaying || currentTime > 0
                ? fmtTime(currentTime)
                : (duration > 0 ? fmtTime(duration) : (loading ? "Carregando..." : "0:00"))}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            {/* Seletor de Velocidade 1x/1.5x/2x */}
            <button
              type="button"
              onClick={toggleSpeed}
              style={{
                background: "color-mix(in srgb, var(--text-primary) 8%, transparent)",
                border: "1px solid color-mix(in srgb, var(--text-primary) 12%, transparent)",
                color: playbackRate > 1 ? "var(--primary)" : "var(--text-secondary)",
                fontSize: "var(--fs-2xs)",
                fontWeight: 700,
                borderRadius: "var(--radius-sm)",
                padding: "var(--space-0-5) var(--space-1-5)",
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
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "20px",
                height: "20px",
                borderRadius: "var(--radius-xs)",
                transition: "color 0.15s ease",
                textDecoration: "none"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
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
          <code key={keyIdx++} style={{ background: "color-mix(in srgb, var(--text-primary) 12%, transparent)", padding: "1px var(--space-1)", borderRadius: "var(--radius-xs)", fontSize: "var(--fs-md)", fontFamily: "monospace" }}>
            {match[5]}
          </code>
        );
      } else if (matchedStr.startsWith("http://") || matchedStr.startsWith("https://")) {
        parts.push(
          <a key={keyIdx++} href={matchedStr} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", textDecoration: "underline" }}>
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
      color: "var(--primary)",
      bg: "color-mix(in srgb, var(--primary) 18%, transparent)",
      border: "1px solid color-mix(in srgb, var(--primary) 45%, transparent)",
      level: 'good',
      minutes
    };
  }
  if (minutes < 15) {
    return {
      label: `⚠️ ${minutes}m aguardando`,
      color: "var(--warning)",
      bg: "color-mix(in srgb, var(--warning) 20%, transparent)",
      border: "1px solid color-mix(in srgb, var(--warning) 45%, transparent)",
      level: 'warning',
      minutes
    };
  }
  const hours = Math.floor(minutes / 60);
  const text = hours > 0 ? `${hours}h${minutes % 60}m` : `${minutes}m`;
  return {
    label: `🚨 ${text} aguardando`,
    color: "var(--error)",
    bg: "color-mix(in srgb, var(--error) 24%, transparent)",
    border: "1px solid color-mix(in srgb, var(--error) 55%, transparent)",
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

// Padrões neutros, iguais aos do backend (quickReplyRoutes.ts). Nunca coloque aqui conteúdo de um
// cliente (oferta, chave PIX, endereço): o produto é multi-tenant e isto aparece para todas as contas.
export const DEFAULT_QUICK_REPLIES: QuickReply[] = [
  {
    id: "saudacao",
    title: "👋 Boas-vindas",
    text: `Olá! Tudo bem? Que bom falar com você! Como posso te ajudar hoje? 😊`
  },
  {
    id: "momento",
    title: "⏳ Pedir um momento",
    text: `Recebi sua mensagem e já estou verificando. Em alguns minutos te dou o retorno completo, tá bem? Obrigado pela paciência!`
  },
  {
    id: "pix",
    title: "💳 Chave PIX",
    text: `Segue nossa chave PIX para pagamento:\n\n🔑 Chave: [sua chave PIX]\nTitular: [nome do titular]\n\nAssim que receber o comprovante, damos andamento ao seu pedido.`
  },
  {
    id: "horario",
    title: "📍 Endereço e horários",
    text: `📍 Endereço: [seu endereço]\n⏰ Horário de atendimento:\nSegunda a sexta: [horário]\nSábado: [horário]`
  },
  {
    id: "encerramento",
    title: "🙏 Encerramento",
    text: `Obrigado pelo contato! Se precisar de mais alguma coisa, é só chamar por aqui.`
  }
];

export type FunnelStage = 'NEW' | 'NEGOTIATING' | 'WAITING_PAYMENT' | 'WON' | 'LOST';

export const FUNNEL_STAGES: Record<FunnelStage, { label: string; color: string; bg: string; border: string }> = {
  NEW: { label: "📥 Novo Lead", color: "var(--info)", bg: "color-mix(in srgb, var(--info) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--info) 30%, transparent)" },
  NEGOTIATING: { label: "💬 Em Negociação", color: "var(--violet)", bg: "color-mix(in srgb, var(--violet) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--violet) 30%, transparent)" },
  WAITING_PAYMENT: { label: "💳 Aguardando PIX", color: "var(--warning)", bg: "color-mix(in srgb, var(--warning) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--warning) 30%, transparent)" },
  WON: { label: "🎉 Venda Concluída", color: "var(--primary)", bg: "color-mix(in srgb, var(--primary) 15%, transparent)", border: "1px solid color-mix(in srgb, var(--primary) 35%, transparent)" },
  LOST: { label: "💤 Sem Retorno", color: "var(--text-muted)", bg: "color-mix(in srgb, var(--text-muted) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--text-muted) 20%, transparent)" }
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
  const confirm = useConfirm();
  const { token: authToken } = useAuth();
  const isViewer = selectedAccount?.accountRole === "VIEWER";

  const [conversations, setConversations] = useState<any[]>(() => {
    return selectedAccount ? (chatCache.getConversations(selectedAccount.id) || []) : [];
  });
  const [selectedPhone, setSelectedPhone] = useState<string>(() => {
    return selectedAccount ? chatCache.getSelectedPhone(selectedAccount.id) : "";
  });
  const selectedPhoneRef = useRef(selectedPhone);

  useEffect(() => {
    selectedPhoneRef.current = selectedPhone;
  }, [selectedPhone]);

  const [chatMessages, setChatMessages] = useState<any[]>(() => {
    if (!selectedAccount) return [];
    const phone = chatCache.getSelectedPhone(selectedAccount.id);
    return phone ? (chatCache.getMessages(selectedAccount.id, phone) || []) : [];
  });
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [convFilter, setConvFilter] = useState<string>(() => {
    return selectedAccount ? chatCache.getFilter(selectedAccount.id) : "ALL";
  });
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [period, setPeriod] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const dateFilterRef = useRef({ startDate: "", endDate: "" });
  const [replyBody, setReplyBody] = useState("");
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [isConversationsLoading, setIsConversationsLoading] = useState<boolean>(() => {
    return selectedAccount ? !chatCache.hasConversations(selectedAccount.id) : false;
  });
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>(() => {
    return selectedAccount ? (chatCache.getQuickReplies(selectedAccount.id) || []) : [];
  });
  const [showQuickReplyModal, setShowQuickReplyModal] = useState(false);
  const [editingQrId, setEditingQrId] = useState<string | null>(null);
  const [qrTitleInput, setQrTitleInput] = useState("");
  const [qrTextInput, setQrTextInput] = useState("");
  const lastAccountIdRef = useRef<string | null>(selectedAccount?.id || null);

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
      chatCache.setQuickReplies(accountId, res.data);
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

  const closeQuickReplyModal = () => {
    setShowQuickReplyModal(false);
    setEditingQrId(null);
    setQrTitleInput("");
    setQrTextInput("");
  };

  const closeChatTemplateModal = () => {
    setShowChatTemplateModal(false);
    setSelectedTemplateName("");
    setTemplateVariables([]);
  };

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
    const ok = await confirm({
      title: "Restaurar as respostas rápidas padrão?",
      description: "As respostas rápidas desta conta voltam ao modelo padrão (boas-vindas, pedir um momento, chave PIX, endereço e encerramento). As que você criou ou editou serão substituídas.",
      confirmLabel: "Restaurar padrão",
      tone: "danger",
    });
    if (!ok) return;
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
  const [templates, setTemplates] = useState<Template[]>(() => {
    return selectedAccount ? (chatCache.getTemplates(selectedAccount.id) || []) : [];
  });
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
      chatCache.setTemplates(accountId, res.data);
    } catch (err) {
      console.error("Erro ao buscar templates:", err);
    }
  };

  const fetchConversations = async (accountId: string, silent = false) => {
    if (!silent) {
      setIsConversationsLoading(true);
    } else {
      setIsBackgroundSyncing(true);
    }
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
      chatCache.setConversations(accountId, merged);
    } catch (err) {
      console.error("Erro ao buscar conversas:", err);
    } finally {
      if (!silent) setIsConversationsLoading(false);
      else setIsBackgroundSyncing(false);
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
    const ok = await confirm({
      title: "Mover este contato para a lista negra?",
      description: "Ele sai da lista de conversas e passa a ser ignorado nos próximos disparos.",
      confirmLabel: "Mover para a lista negra",
      tone: "danger",
    });
    if (!ok) return;
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
      chatCache.setMessages(accountId, phone, res.data);
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

  // Contadores memoizados das mensagens do chat ativo (evita recalcular a cada tecla digitada na resposta)
  const messageFilterCounts = useMemo(() => {
    let incoming = 0;
    let sent = 0;
    let delivered = 0;
    let read = 0;
    let failed = 0;
    for (let i = 0; i < chatMessages.length; i++) {
      const m = chatMessages[i];
      if (m.direction === "INCOMING") incoming++;
      else {
        if (m.status === "SENT") sent++;
        else if (m.status === "DELIVERED") delivered++;
        else if (m.status === "READ") read++;
        else if (m.status === "FAILED") failed++;
      }
    }
    return {
      ALL: chatMessages.length,
      INCOMING: incoming,
      SENT: sent,
      DELIVERED: delivered,
      READ: read,
      FAILED: failed,
    };
  }, [chatMessages]);

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

    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase().trim();
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
  }, [conversations, matchesConvFilter, deferredSearchQuery, convFilter]);

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
    const ok = await confirm({
      title: `Concluir ${count} ${count === 1 ? "conversa" : "conversas"}?`,
      description: "Todas as conversas desta lista são marcadas como atendidas. Elas voltam para Aguardando se o cliente escrever de novo.",
      confirmLabel: "Concluir todas",
    });
    if (!ok) return;

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
  }, [selectedAccount, filteredConversations, showAlert, confirm]);

  const sendReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isViewer || !selectedAccount || !selectedPhone || !replyBody.trim()) return;

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

  // Sincronização contínua do estado local com o cache em memória (SWR)
  useEffect(() => {
    if (selectedAccount?.id && conversations.length > 0) {
      chatCache.setConversations(selectedAccount.id, conversations);
    }
  }, [selectedAccount?.id, conversations]);

  useEffect(() => {
    if (selectedAccount?.id && selectedPhone && chatMessages.length > 0) {
      chatCache.setMessages(selectedAccount.id, selectedPhone, chatMessages);
    }
  }, [selectedAccount?.id, selectedPhone, chatMessages]);

  useEffect(() => {
    if (selectedAccount?.id) {
      chatCache.setSelectedPhone(selectedAccount.id, selectedPhone);
    }
  }, [selectedAccount?.id, selectedPhone]);

  useEffect(() => {
    if (selectedAccount?.id) {
      chatCache.setFilter(selectedAccount.id, convFilter);
    }
  }, [selectedAccount?.id, convFilter]);

  useEffect(() => {
    if (selectedAccount?.id && quickReplies.length > 0) {
      chatCache.setQuickReplies(selectedAccount.id, quickReplies);
    }
  }, [selectedAccount?.id, quickReplies]);

  useEffect(() => {
    if (selectedAccount?.id && templates.length > 0) {
      chatCache.setTemplates(selectedAccount.id, templates);
    }
  }, [selectedAccount?.id, templates]);

  // Montagem, troca de abas e troca de conta com suporte a Stale-While-Revalidate (0ms de espera ao alternar menus)
  useEffect(() => {
    if (!selectedAccount) {
      setTemplates([]);
      setConversations([]);
      setSelectedPhone("");
      setChatMessages([]);
      lastAccountIdRef.current = null;
      return;
    }

    const accountId = selectedAccount.id;
    const isAccountSwitched = lastAccountIdRef.current !== null && lastAccountIdRef.current !== accountId;
    lastAccountIdRef.current = accountId;

    const hasCache = chatCache.hasConversations(accountId);

    if (isAccountSwitched) {
      // O operador trocou de conta do WhatsApp no seletor de topo
      if (hasCache) {
        const cachedConv = chatCache.getConversations(accountId) || [];
        const cachedPhone = chatCache.getSelectedPhone(accountId);
        const cachedMsgs = cachedPhone ? (chatCache.getMessages(accountId, cachedPhone) || []) : [];
        const cachedFilter = chatCache.getFilter(accountId);
        const cachedTemplates = chatCache.getTemplates(accountId) || [];
        const cachedQr = chatCache.getQuickReplies(accountId) || [];

        setConversations(cachedConv);
        setSelectedPhone(cachedPhone);
        setChatMessages(cachedMsgs);
        setConvFilter(cachedFilter);
        if (cachedTemplates.length > 0) setTemplates(cachedTemplates);
        if (cachedQr.length > 0) setQuickReplies(cachedQr);
        setIsConversationsLoading(false);

        // Revalidação silenciosa em segundo plano
        fetchConversations(accountId, true);
        fetchTemplates(accountId);
        fetchQuickReplies(accountId);
        if (cachedPhone) fetchChatMessages(accountId, cachedPhone, true);
      } else {
        // Nova conta sem histórico em cache
        setConversations([]);
        setSelectedPhone("");
        setChatMessages([]);
        setConvFilter("ALL");
        setIsConversationsLoading(true);
        fetchConversations(accountId, false);
        fetchTemplates(accountId);
        fetchQuickReplies(accountId);
      }
    } else {
      // Montagem inicial ou retorno da navegação entre menus (Dashboard <-> Live Chat <-> Campanhas)
      if (hasCache) {
        const cachedConv = chatCache.getConversations(accountId) || [];
        if (conversations.length === 0 && cachedConv.length > 0) {
          setConversations(cachedConv);
        }
        const cachedPhone = chatCache.getSelectedPhone(accountId);
        if (!selectedPhone && cachedPhone) {
          setSelectedPhone(cachedPhone);
          const cachedMsgs = chatCache.getMessages(accountId, cachedPhone) || [];
          if (cachedMsgs.length > 0) setChatMessages(cachedMsgs);
          fetchChatMessages(accountId, cachedPhone, true);
        }
        setIsConversationsLoading(false);

        // Revalidação em segundo plano sem travar tela (0ms)
        fetchConversations(accountId, true);
        fetchTemplates(accountId);
        fetchQuickReplies(accountId);
      } else {
        fetchConversations(accountId, false);
        fetchTemplates(accountId);
        fetchQuickReplies(accountId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount?.id]);

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
    <div className="fade-in chat-page-root" style={{ display: "flex", flexDirection: "column", gap: "var(--space-1-5)", height: "100%", maxHeight: "100%", minHeight: 0, flex: 1, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, padding: "0 var(--space-0-5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <h1 style={{ fontSize: "var(--fs-lg)", fontWeight: 700, margin: 0, letterSpacing: "-0.01em", display: "flex", alignItems: "center", gap: "var(--space-1-5)" }}>
            <span aria-hidden="true">💬</span> Live Chat
          </h1>
        </div>
      </div>

      {!selectedAccount ? (
        <div className="glass" style={{ borderRadius: "var(--radius-xl)" }}>
          <div className="empty-state">
            <span className="empty-state__icon" aria-hidden="true">💬</span>
            <span className="empty-state__title">Nenhuma conta selecionada</span>
            <span className="empty-state__desc">Conecte uma conta do WhatsApp para abrir o Live Chat.</span>
          </div>
        </div>
      ) : (
        <div className="glass chat-glass-container" style={{ display: "flex", flex: 1, minHeight: 0, borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--border-color)" }}>
          
          {/* 1. Lista de Conversas (Esquerda) */}
          <div className={`chat-panel-list${selectedPhone ? " mobile-hidden" : ""}`}>
            <div style={{ padding: "var(--space-2-5) var(--space-3)", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1-5)" }}>
                <span style={{ fontSize: "var(--fs-md)", fontWeight: "600" }}>Conversas</span>
                <span style={{ fontSize: "var(--fs-2xs)", color: "var(--text-muted)", background: "color-mix(in srgb, var(--text-primary) 6%, transparent)", padding: "1px var(--space-1-5)", borderRadius: "var(--radius-sm)" }}>
                  {conversations.length}
                </span>
                {isBackgroundSyncing && (
                  <span
                    title="Sincronizando atualizações em segundo plano..."
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "var(--space-1)",
                      fontSize: "var(--fs-2xs)",
                      color: "var(--primary)",
                      background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                      padding: "1px var(--space-1-5)",
                      borderRadius: "var(--radius-xs)"
                    }}
                  >
                    <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--primary)", display: "inline-block" }} />
                    Sincronizando
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fetchConversations(selectedAccount.id)}
                style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "var(--fs-base)" }}
                title="Atualizar lista" aria-label="Atualizar lista de conversas"
              >
                🔄
              </button>
            </div>

            {/* 1.1 Campo de Busca Instantânea Inteligente */}
            <div className="chat-search-bar" style={{ padding: "var(--space-2) var(--space-2-5)", borderBottom: "1px solid var(--border-color)", flexShrink: 0 }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <span aria-hidden="true" style={{ position: "absolute", left: "var(--space-2-5)", fontSize: "var(--fs-sm)", color: "var(--text-muted)", pointerEvents: "none" }}>🔍</span>
                <label htmlFor="chat-search" className="sr-only">Buscar conversas</label>
                <input
                  id="chat-search"
                  type="search"
                  placeholder="Buscar nome, número ou mensagem..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="field-input chat-search-input"
                  style={{
                    paddingLeft: "var(--space-8)",
                    paddingRight: searchQuery ? "26px" : "8px",
                    fontSize: "var(--fs-sm)",
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
                      fontSize: "var(--fs-md)",
                      padding: "var(--space-0-5)"
                    }}
                    title="Limpar busca" aria-label="Limpar busca"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Filtro por período + exportação de leads */}
            <div style={{ padding: "var(--space-1-5) var(--space-2-5)", borderBottom: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "var(--space-1-5)", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: "var(--space-1-5)", alignItems: "center" }}>
                <select
                  value={period}
                  onChange={(e) => applyPeriod(e.target.value)}
                  className="field-input"
                  style={{ fontSize: "var(--fs-xs)", padding: "var(--space-1) var(--space-1-5)", cursor: "pointer", height: "28px", flex: 1, minWidth: 0 }}
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
                  style={{ fontSize: "var(--fs-xs)", padding: "var(--space-0-5) var(--space-2)", height: "28px", background: "color-mix(in srgb, var(--primary) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--primary) 35%, transparent)", borderRadius: "var(--radius-xs)", color: "var(--primary)", cursor: isExporting ? "not-allowed" : "pointer", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "var(--space-0-5)", whiteSpace: "nowrap" }}
                  title="Exportar os contatos filtrados para CSV"
                >
                  {isExporting ? "..." : "⬇️ CSV"}
                </button>
                {convFilter === "UNANSWERED" && filteredConversations.length > 0 && (
                  <button
                    type="button"
                    onClick={markAllFilteredAsHandled}
                    style={{
                      fontSize: "var(--fs-xs)",
                      padding: "var(--space-0-5) var(--space-2)",
                      height: "28px",
                      background: "color-mix(in srgb, var(--primary) 15%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--primary) 40%, transparent)",
                      borderRadius: "var(--radius-xs)",
                      color: "var(--primary)",
                      cursor: "pointer",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "var(--space-0-5)",
                      whiteSpace: "nowrap"
                    }}
                    title="Marcar todas as conversas desta fila como atendidas/concluídas"
                  >
                    ✓✓ Limpar ({filteredConversations.length})
                  </button>
                )}
              </div>
              {period === "custom" && (
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1-5)" }}>
                  <input
                    type="date"
                    value={startDate}
                    max={endDate || undefined}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="field-input"
                    style={{ fontSize: "var(--fs-xs)", padding: "var(--space-0-5) var(--space-1-5)", flex: 1, minWidth: 0, height: "26px" }}
                    title="Data inicial"
                  />
                  <span style={{ fontSize: "var(--fs-2xs)", color: "var(--text-muted)" }}>até</span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="field-input"
                    style={{ fontSize: "var(--fs-xs)", padding: "var(--space-0-5) var(--space-1-5)", flex: 1, minWidth: 0, height: "26px" }}
                    title="Data final"
                  />
                </div>
              )}
            </div>

            {/* Filtros de conversas (chats) */}
            <div style={{ display: "flex", gap: "var(--space-1)", padding: "var(--space-1-5) var(--space-2-5)", borderBottom: "1px solid var(--border-color)", overflowX: "auto", flexWrap: "nowrap", flexShrink: 0 }}>
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
                      padding: "var(--space-0-5) var(--space-2)",
                      borderRadius: "var(--radius-md)",
                      fontSize: "var(--fs-2xs)",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      cursor: "pointer",
                      border: isActive
                        ? "1px solid var(--primary)"
                        : f.highlight && count > 0
                          ? "1px solid color-mix(in srgb, var(--primary) 55%, transparent)"
                          : "1px solid var(--border-color)",
                      background: isActive
                        ? "color-mix(in srgb, var(--primary) 22%, transparent)"
                        : f.highlight && count > 0
                          ? "color-mix(in srgb, var(--primary) 12%, transparent)"
                          : "transparent",
                      color: isActive
                        ? "var(--primary)"
                        : f.highlight && count > 0
                          ? "var(--primary)"
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
                <div style={{ padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  <div className="skeleton" style={{ width: "100%", height: "60px", borderRadius: "var(--radius-sm)" }}></div>
                  <div className="skeleton" style={{ width: "100%", height: "60px", borderRadius: "var(--radius-sm)" }}></div>
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
                    const initials = getInitials(c.profileName, "📱");
                    return (
                      <div
                        key={c.phone}
                        onClick={() => {
                          setSelectedPhone(c.phone);
                          chatCache.setSelectedPhone(selectedAccount.id, c.phone);
                          setStatusFilter("ALL");
                          const cached = chatCache.getMessages(selectedAccount.id, c.phone);
                          if (cached && cached.length > 0) {
                            setChatMessages(cached);
                            fetchChatMessages(selectedAccount.id, c.phone, true);
                          } else {
                            fetchChatMessages(selectedAccount.id, c.phone, false);
                          }
                        }}
                        className={`conv-item${isActive ? " active" : ""}`}
                      >
                        <div className="conv-actions">
                          <button
                            type="button"
                            className={`conv-action-btn ${isHandledLead ? "conv-action-btn--active" : "conv-action-btn--success"}`}
                            title={isHandledLead ? "Reabrir conversa (voltar para a fila de aguardando)" : "Marcar como Atendido / Concluído (retira da fila)"}
                            aria-label={isHandledLead ? "Reabrir conversa" : "Marcar conversa como atendida"}
                            onClick={(e) => toggleHandled(c.phone, e)}
                          >
                            {isHandledLead ? "↩️" : "✅"}
                          </button>
                          <button
                            type="button"
                            className="conv-action-btn"
                            title="Mover para a Lista Negra" aria-label="Mover para a lista negra"
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
                          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1-5)", flexWrap: "wrap", marginTop: "var(--space-1)" }}>
                            {(() => {
                              if (isHandledLead) {
                                return (
                                  <span style={{
                                    fontSize: "var(--fs-2xs)",
                                    fontWeight: 600,
                                    color: "var(--primary)",
                                    background: "color-mix(in srgb, var(--primary) 16%, transparent)",
                                    border: "1px solid color-mix(in srgb, var(--primary) 35%, transparent)",
                                    padding: "1px var(--space-1-5)",
                                    borderRadius: "var(--radius-sm)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "var(--space-0-5)"
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
                                  fontSize: "var(--fs-2xs)",
                                  fontWeight: 600,
                                  color: sla ? sla.color : "var(--primary)",
                                  background: sla ? sla.bg : "color-mix(in srgb, var(--primary) 18%, transparent)",
                                  border: sla ? sla.border : "1px solid color-mix(in srgb, var(--primary) 45%, transparent)",
                                  padding: "1px var(--space-1-5)",
                                  borderRadius: "var(--radius-sm)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "var(--space-0-5)"
                                }}>
                                  {sla ? sla.label : "🔥 Aguardando"}
                                </span>
                              );
                            }

                            const badge = c.hasIncoming && c.direction === "OUTGOING"
                              ? { text: "✓✓ Respondido", color: "var(--text-muted)", bg: "color-mix(in srgb, var(--text-primary) 5%, transparent)", border: "1px solid color-mix(in srgb, var(--text-primary) 8%, transparent)" }
                              : c.hasFailed && !c.hasDelivered && !c.hasRead
                                ? { text: "⚠️ Falha", color: "var(--error)", bg: "color-mix(in srgb, var(--error) 20%, transparent)", border: "1px solid color-mix(in srgb, var(--error) 40%, transparent)" }
                                : c.hasRead
                                  ? { text: "✓✓ Lida", color: "var(--chat-read-tick)", bg: "color-mix(in srgb, var(--chat-read-tick) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--chat-read-tick) 30%, transparent)" }
                                  : c.hasDelivered
                                    ? { text: "✓✓ Entregue", color: "var(--text-secondary)", bg: "color-mix(in srgb, var(--text-primary) 6%, transparent)", border: "none" }
                                    : c.direction === "OUTGOING"
                                      ? { text: "✓ Enviada", color: "var(--text-muted)", bg: "color-mix(in srgb, var(--text-primary) 4%, transparent)", border: "none" }
                                      : null;
                            if (!badge) return null;
                            return (
                              <span style={{
                                fontSize: "var(--fs-2xs)",
                                fontWeight: 600,
                                color: badge.color,
                                background: badge.bg,
                                border: badge.border || "none",
                                padding: "1px var(--space-1-5)",
                                borderRadius: "var(--radius-sm)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "var(--space-0-5)"
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
                                  fontSize: "var(--fs-2xs)",
                                  fontWeight: 600,
                                  color: stage.color,
                                  background: stage.bg,
                                  border: stage.border,
                                  padding: "var(--space-0-5) var(--space-1-5)",
                                  borderRadius: "var(--radius-sm)",
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
                  <div style={{ padding: "var(--space-3)", textAlign: "center", fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
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
                  <span className="empty-state__icon" aria-hidden="true">💬</span>
                  <span className="empty-state__title">Nenhuma conversa aberta</span>
                  <span className="empty-state__desc">Selecione uma conversa ao lado para visualizar o atendimento.</span>
                </div>
              </div>
            ) : (
              <>
                {/* Header da conversa */}
                <div className="chat-header-bar" style={{ padding: "var(--space-2) var(--space-3-5)", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap", flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setSelectedPhone("")}
                    className="btn btn-secondary"
                    style={{ padding: "var(--space-1) var(--space-2)", fontSize: "var(--fs-sm)", flexShrink: 0, display: "none" }}
                    id="chat-back-btn"
                  >
                    ← Voltar
                  </button>
                  <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: "160px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1-5)", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: "700", fontSize: "var(--fs-base)" }}>
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
                          fontSize: "var(--fs-2xs)",
                          fontWeight: 700,
                          padding: "var(--space-0-5) var(--space-2)",
                          borderRadius: "var(--radius-md)",
                          cursor: "pointer",
                          color: FUNNEL_STAGES[crmData.stage]?.color || "var(--text-primary)",
                          background: FUNNEL_STAGES[crmData.stage]?.bg || "transparent",
                          border: FUNNEL_STAGES[crmData.stage]?.border || "1px solid var(--border-color)",
                        }}
                        title="Alterar etapa do funil do lead"
                        aria-label="Etapa do funil do lead"
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
                            fontSize: "var(--fs-2xs)",
                            fontWeight: 700,
                            padding: "1px var(--space-1-5)",
                            borderRadius: "var(--radius-sm)",
                            color: sla.color,
                            background: sla.bg,
                            border: sla.border
                          }}>
                            {sla.label}
                          </span>
                        );
                      })()}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--fs-xs)", color: "var(--text-muted)", marginTop: "1px" }}>
                      <span>{selectedPhone}</span>
                      <a
                        href={`https://wa.me/${selectedPhone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--primary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "var(--space-0-5)" }}
                        title="Abrir no WhatsApp Web"
                      >
                        <span>↗️</span> wa.me
                      </a>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1-5)" }}>
                    {/* Botão de Concluir / Reabrir Atendimento */}
                    <button
                      type="button"
                      onClick={() => toggleHandled(selectedPhone)}
                      className="btn"
                      style={{
                        padding: "var(--space-1) var(--space-2-5)",
                        fontSize: "var(--fs-xs)",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "var(--space-1)",
                        borderRadius: "var(--radius-xs)",
                        background: isConversationHandled(selectedPhone) ? "color-mix(in srgb, var(--info) 12%, transparent)" : "color-mix(in srgb, var(--primary) 14%, transparent)",
                        border: isConversationHandled(selectedPhone) ? "1px solid color-mix(in srgb, var(--info) 35%, transparent)" : "1px solid color-mix(in srgb, var(--primary) 35%, transparent)",
                        color: isConversationHandled(selectedPhone) ? "var(--info)" : "var(--primary)",
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
                        padding: "var(--space-1) var(--space-2-5)",
                        fontSize: "var(--fs-xs)",
                        background: showCrmDrawer ? "color-mix(in srgb, var(--primary) 20%, transparent)" : undefined,
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
                      title="Atualizar mensagens"
                      aria-label="Atualizar mensagens"
                      className="btn btn-secondary"
                      style={{ padding: "var(--space-1) var(--space-2-5)", fontSize: "var(--fs-xs)" }}
                    >
                      🔄
                    </button>
                  </div>
                </div>

                {/* Barra de filtros por status */}
                <div className="chat-templates-bar" style={{ display: "flex", gap: "var(--space-1)", padding: "var(--space-1) var(--space-3-5)", borderBottom: "1px solid var(--border-color)", overflowX: "auto", flexWrap: "nowrap", flexShrink: 0 }}>
                  {FILTERS.map(f => {
                    const isActive = statusFilter === f.key;
                    const count = messageFilterCounts[f.key as keyof typeof messageFilterCounts] ?? 0;
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setStatusFilter(f.key)}
                        style={{
                          padding: "var(--space-0-5) var(--space-2)",
                          borderRadius: "var(--radius-md)",
                          fontSize: "var(--fs-2xs)",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          cursor: "pointer",
                          border: isActive ? "1px solid var(--primary)" : "1px solid var(--border-color)",
                          background: isActive ? "color-mix(in srgb, var(--primary) 15%, transparent)" : "transparent",
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
                <div style={{ flex: 1, minHeight: 0, padding: "var(--space-3) var(--space-4)", overflowY: "auto", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  {isChatLoading ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2-5)", width: "100%", height: "100%", justifyContent: "center", alignItems: "center", color: "var(--text-muted)" }}>
                      <div className="skeleton" style={{ width: "60%", height: "40px", borderRadius: "var(--radius-md)", alignSelf: "flex-start" }} />
                      <div className="skeleton" style={{ width: "40%", height: "40px", borderRadius: "var(--radius-md)", alignSelf: "flex-end" }} />
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
                              <div style={{ display: "flex", justifyContent: "center", margin: "var(--space-2-5) 0 var(--space-1-5) 0" }}>
                                <span style={{
                                  fontSize: "var(--fs-xs)",
                                  fontWeight: 600,
                                  background: "var(--surface-raised)",
                                  backdropFilter: "blur(8px)",
                                  color: "var(--text-muted)",
                                  padding: "var(--space-0-5) var(--space-3)",
                                  borderRadius: "var(--radius-md)",
                                  border: "1px solid color-mix(in srgb, var(--text-primary) 8%, transparent)",
                                  boxShadow: "var(--shadow-sm)"
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
                                    <img src={mediaUrl} alt="Imagem" style={{ maxWidth: "100%", borderRadius: "var(--radius-sm)", marginBottom: "var(--space-1-5)", display: "block" }} />
                                  );
                                  if (fmt === "VIDEO") return (
                                    <video src={mediaUrl} controls style={{ maxWidth: "100%", borderRadius: "var(--radius-sm)", marginBottom: "var(--space-1-5)", display: "block" }} />
                                  );
                                  if (fmt === "AUDIO" || fmt === "VOICE") return (
                                    <AudioMessagePlayer src={mediaUrl} />
                                  );
                                  if (fmt === "DOCUMENT") return (
                                    <a href={mediaUrl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: "var(--space-1-5)", color: "var(--primary)", marginBottom: "var(--space-1-5)" }}>
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
                                    <img src={proxyUrl} alt="Imagem recebida" style={{ maxWidth: "100%", borderRadius: "var(--radius-sm)", marginBottom: "var(--space-1-5)", display: "block" }} />
                                  );
                                  if (fmt === "VIDEO") return (
                                    <video src={proxyUrl} controls style={{ maxWidth: "100%", borderRadius: "var(--radius-sm)", marginBottom: "var(--space-1-5)", display: "block" }} />
                                  );
                                  if (fmt === "AUDIO" || fmt === "VOICE") return (
                                    <AudioMessagePlayer src={proxyUrl} />
                                  );
                                  if (fmt === "DOCUMENT") return (
                                    <a href={proxyUrl} target="_blank" rel="noreferrer" download style={{ display: "flex", alignItems: "center", gap: "var(--space-1-5)", color: "var(--primary)", marginBottom: "var(--space-1-5)" }}>
                                      📄 Documento recebido
                                    </a>
                                  );
                                  return (
                                    <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)", marginBottom: "var(--space-1-5)" }}>
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
                            <div className="msg-time" style={{ display: "flex", alignItems: "center", gap: "var(--space-1-5)", flexWrap: "wrap", justifyContent: isIncoming ? "flex-start" : "flex-end" }}>
                              {!isIncoming && msg.sentByUserName && (
                                <span
                                  style={{
                                    fontSize: "var(--fs-2xs)",
                                    color: "var(--text-muted)",
                                    background: "color-mix(in srgb, var(--text-primary) 8%, transparent)",
                                    padding: "1px var(--space-1-5)",
                                    borderRadius: "var(--radius-xs)",
                                    fontWeight: 500,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "var(--space-0-5)"
                                  }}
                                  title={`Enviado pelo operador ${msg.sentByUserName}`}
                                >
                                  <span style={{ opacity: 0.8, fontSize: "var(--fs-xs)" }}>👤</span> {msg.sentByUserName}
                                </span>
                              )}
                              <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {!isIncoming && (
                                <span style={{
                                  color: msg.status === "READ" ? "var(--success)" :
                                         msg.status === "DELIVERED" ? "var(--info)" :
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
                      padding: "var(--space-2) var(--space-3-5)",
                      borderTop: "1px solid var(--border-color)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--space-1)",
                      flexShrink: 0,
                      background: "var(--surface-raised)",
                      boxShadow: "var(--shadow-up)",
                      zIndex: 10
                    }}>
                      
                      {lastInc ? (
                        isWindowActive ? (
                          <div style={{
                            background: "color-mix(in srgb, var(--primary) 8%, transparent)",
                            border: "1px solid color-mix(in srgb, var(--primary) 22%, transparent)",
                            borderRadius: "var(--radius-xs)",
                            padding: "var(--space-0-5) var(--space-2)",
                            fontSize: "var(--fs-xs)",
                            color: "var(--success)",
                            fontWeight: "500",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "var(--space-1-5)",
                            width: "fit-content"
                          }}>
                            <span className="window-badge" style={{ fontSize: "var(--fs-2xs)", padding: "1px var(--space-1-5)" }}><span className="dot" />Janela aberta</span>
                            <span style={{ fontSize: "var(--fs-xs)" }}>Responda livremente · Expira em <strong>{timeRemainingStr}</strong></span>
                          </div>
                        ) : (
                          <div style={{
                            background: "color-mix(in srgb, var(--warning) 8%, transparent)",
                            border: "1px solid color-mix(in srgb, var(--warning) 22%, transparent)",
                            borderRadius: "var(--radius-xs)",
                            padding: "var(--space-1) var(--space-2)",
                            fontSize: "var(--fs-xs)",
                            color: "var(--warning)",
                            fontWeight: "500",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "var(--space-1-5)"
                          }}>
                            <span>⚠️ <strong>Janela Expirada:</strong> Envie um Template para reabrir.</span>
                          </div>
                        )
                      ) : (
                        <div style={{
                          background: "color-mix(in srgb, var(--text-primary) 2%, transparent)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "var(--radius-xs)",
                          padding: "var(--space-1) var(--space-2)",
                          fontSize: "var(--fs-xs)",
                          color: "var(--text-secondary)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "var(--space-1-5)"
                        }}>
                          <span>ℹ️ O cliente ainda não respondeu ao disparo. Respostas de texto livre disponíveis após interação dele.</span>
                        </div>
                      )}

                      {/* Barra de Respostas Rápidas (1-Clique / Canned Responses) */}
                      {(!lastInc || isWindowActive) && (
                        <div className="quick-replies-toolbar" style={{ padding: "0", gap: "var(--space-1)" }}>
                          <div className="quick-replies-scroll-area" style={{ gap: "var(--space-1)" }}>
                            <span className="quick-replies-label" style={{ fontSize: "var(--fs-2xs)" }}>
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
                                style={{ fontSize: "var(--fs-xs)", padding: "var(--space-0-5) var(--space-2)", display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }}
                                title={qr.text.slice(0, 120) + (qr.text.length > 120 ? "..." : "")}
                              >
                                <span>{getQrIcon(qr.title)}</span>
                                <span>{qr.title}</span>
                              </button>
                            ))}
                            {quickReplies.length === 0 && (
                              <span style={{ fontSize: "var(--fs-2xs)", color: "var(--text-muted)", fontStyle: "italic" }}>
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
                            style={{ fontSize: "var(--fs-2xs)", padding: "var(--space-0-5) var(--space-1-5)" }}
                            title="Gerenciar e criar novas respostas rápidas" aria-label="Gerenciar respostas rápidas"
                          >
                            <span>⚙️</span>
                          </button>
                        </div>
                      )}

                      {/* Barra de Formatação estilo WhatsApp e Botão de Prévia */}
                      {(!lastInc || isWindowActive) && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-0-5)", padding: "0 var(--space-0-5)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                            <button
                              type="button"
                              onClick={() => insertFormat("*")}
                              title="Negrito (*texto*)" aria-label="Negrito"
                              className="chat-fmt-btn"
                              style={{ fontWeight: "bold", padding: "var(--space-0-5) var(--space-1-5)", fontSize: "var(--fs-2xs)" }}
                            >
                              B
                            </button>
                            <button
                              type="button"
                              onClick={() => insertFormat("_")}
                              title="Itálico (_texto_)" aria-label="Itálico"
                              className="chat-fmt-btn"
                              style={{ fontStyle: "italic", padding: "var(--space-0-5) var(--space-1-5)", fontSize: "var(--fs-2xs)" }}
                            >
                              I
                            </button>
                            <button
                              type="button"
                              onClick={() => insertFormat("~")}
                              title="Tachado (~texto~)" aria-label="Tachado"
                              className="chat-fmt-btn"
                              style={{ textDecoration: "line-through", padding: "var(--space-0-5) var(--space-1-5)", fontSize: "var(--fs-2xs)" }}
                            >
                              S
                            </button>
                            <button
                              type="button"
                              onClick={() => insertFormat("• ")}
                              title="Marcador de Lista" aria-label="Inserir marcador de lista"
                              className="chat-fmt-btn"
                              style={{ padding: "var(--space-0-5) var(--space-1-5)", fontSize: "var(--fs-2xs)" }}
                            >
                              • Lista
                            </button>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1-5)" }}>
                            {replyBody.trim() && (
                              <button
                                type="button"
                                onClick={() => setShowPreview(!showPreview)}
                                className="chat-fmt-btn"
                                style={{
                                  background: showPreview ? "color-mix(in srgb, var(--primary) 20%, transparent)" : undefined,
                                  borderColor: showPreview ? "var(--primary)" : undefined,
                                  color: showPreview ? "var(--primary)" : undefined,
                                  fontSize: "var(--fs-2xs)",
                                  padding: "var(--space-0-5) var(--space-1-5)",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "var(--space-0-5)"
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
                          background: "var(--surface-raised)",
                          border: "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
                          borderRadius: "var(--radius-sm)",
                          padding: "var(--space-2-5) var(--space-3-5)",
                          marginBottom: "var(--space-2)",
                          backdropFilter: "blur(6px)"
                        }}>
                          <div style={{ fontSize: "var(--fs-xs)", color: "var(--primary)", fontWeight: 600, marginBottom: "var(--space-1-5)", display: "flex", justifyContent: "space-between" }}>
                            <span>📱 Prévia exata no WhatsApp do cliente:</span>
                            <button
                              type="button"
                              onClick={() => setShowPreview(false)}
                              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "var(--fs-xs)" }}
                            >
                              ✕ Fechar prévia
                            </button>
                          </div>
                          <div style={{
                            background: "var(--chat-bubble-out)", // Verde do balão enviado no WhatsApp Dark
                            color: "var(--chat-bubble-out-fg)",
                            borderRadius: "var(--radius-md) var(--radius-md) var(--radius-xs) var(--radius-md)",
                            padding: "var(--space-2) var(--space-3)",
                            fontSize: "var(--fs-md)",
                            lineHeight: "1.45",
                            wordBreak: "break-word",
                            display: "inline-block",
                            maxWidth: "92%",
                            boxShadow: "var(--shadow-md)"
                          }}>
                            {renderWhatsAppFormatted(replyBody)}
                            <div style={{ fontSize: "var(--fs-2xs)", color: "color-mix(in srgb, var(--chat-bubble-out-fg) 60%, transparent)", textAlign: "right", marginTop: "var(--space-1)" }}>
                              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Campo de digitação de mensagem e botões */}
                      <form onSubmit={sendReply} style={{ display: "flex", gap: "var(--space-2-5)", alignItems: "flex-end" }}>
                        <textarea
                          ref={replyTextareaRef}
                          placeholder={
                            isViewer
                              ? "Acesso em modo somente leitura (Visualizador). Respostas desabilitadas."
                              : !lastInc || isWindowActive 
                                ? "Digite a sua resposta... (Shift+Enter para pular linha, Enter para enviar)" 
                                : "Janela expirada — envie um template para reabrir..."
                          }
                          value={replyBody}
                          onChange={(e) => {
                            if (isViewer) return;
                            setReplyBody(e.target.value);
                            e.target.style.height = "auto";
                            e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
                          }}
                          onPaste={(e) => {
                            if (isViewer) return;
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
                              if (!isViewer) sendReply();
                            }
                          }}
                          disabled={isViewer || (lastInc ? !isWindowActive : true)}
                          className="chat-textarea"
                          aria-label="Mensagem para o cliente"
                          rows={1}
                          style={{
                            flex: 1,
                            padding: "var(--space-2) var(--space-3)",
                            borderRadius: "var(--radius-md)",
                            resize: "none",
                            minHeight: "40px",
                            maxHeight: "110px",
                            lineHeight: "1.4",
                            overflowY: "auto",
                            fontFamily: "inherit",
                            fontSize: "var(--fs-md)",
                            opacity: isViewer ? 0.7 : 1,
                            cursor: isViewer ? "not-allowed" : "text"
                          }}
                        />
                        <button
                          type="submit"
                          className="chat-send-btn btn btn-primary"
                          style={{ height: "40px", flexShrink: 0, opacity: isViewer ? 0.5 : 1, cursor: isViewer ? "not-allowed" : "pointer" }}
                          disabled={isViewer || isSendingReply || !replyBody.trim() || (lastInc ? !isWindowActive : true)}
                        >
                          {isSendingReply ? "Enviando..." : "Enviar ✈️"}
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => {
                            if (!isViewer) setShowChatTemplateModal(true);
                          }}
                          className="btn btn-secondary"
                          style={{ padding: "0 var(--space-3-5)", borderRadius: "var(--radius-md)", whiteSpace: "nowrap", height: "40px", flexShrink: 0, fontSize: "var(--fs-md)", opacity: isViewer ? 0.5 : 1, cursor: isViewer ? "not-allowed" : "pointer" }}
                          disabled={isViewer}
                          title={isViewer ? "Somente leitura" : "Enviar Template de Mensagem"}
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
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1-5)" }}>
                  <span style={{ fontSize: "var(--fs-lg)" }}>👤</span>
                  <span style={{ fontWeight: 700, fontSize: "var(--fs-base)" }}>Ficha do Lead (CRM)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCrmDrawer(false)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: "var(--fs-lg)",
                    padding: "var(--space-1)"
                  }}
                  title="Fechar Ficha do Lead" aria-label="Fechar ficha do lead"
                >
                  ✕
                </button>
              </div>

              {/* Informações do Lead */}
              <div style={{
                background: "color-mix(in srgb, var(--text-primary) 3%, transparent)",
                borderRadius: "var(--radius-sm)",
                padding: "var(--space-3)",
                border: "1px solid var(--border-color)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-1)"
              }}>
                <div style={{ fontWeight: 600, fontSize: "var(--fs-base)" }}>
                  {conversations.find(c => c.phone === selectedPhone)?.profileName || "Nome não identificado"}
                </div>
                <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)", fontFamily: "monospace" }}>
                  {selectedPhone}
                </div>
                <div style={{ marginTop: "var(--space-1-5)", display: "flex", gap: "var(--space-2)" }}>
                  <a
                    href={`https://wa.me/${selectedPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{
                      fontSize: "var(--fs-xs)",
                      padding: "var(--space-1) var(--space-2)",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "var(--space-1)"
                    }}
                  >
                    <span>💬</span> WhatsApp Web ↗
                  </a>
                </div>
              </div>

              {/* Etapa do Funil */}
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <span id="crm-stage-label" style={{ fontSize: "var(--fs-xs)", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Etapa do funil de vendas
                </span>
                <div role="group" aria-labelledby="crm-stage-label" style={{ display: "flex", flexDirection: "column", gap: "var(--space-1-5)" }}>
                  {(Object.keys(FUNNEL_STAGES) as FunnelStage[]).map((stageKey) => {
                    const stage = FUNNEL_STAGES[stageKey];
                    const isCurrent = crmData.stage === stageKey;
                    return (
                      <button
                        key={stageKey}
                        type="button"
                        onClick={() => updateCrm(prev => ({ ...prev, stage: stageKey }))}
                        style={{
                          padding: "var(--space-2) var(--space-3)",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "var(--fs-sm)",
                          fontWeight: isCurrent ? 700 : 500,
                          textAlign: "left",
                          cursor: "pointer",
                          border: isCurrent ? stage.border : "1px solid transparent",
                          background: isCurrent ? stage.bg : "color-mix(in srgb, var(--text-primary) 3%, transparent)",
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
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <label htmlFor="crm-tag-input" style={{ fontSize: "var(--fs-xs)", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Etiquetas
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1)", minHeight: "26px" }}>
                  {crmData.tags.length === 0 ? (
                    <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)", fontStyle: "italic" }}>
                      Nenhuma tag adicionada
                    </span>
                  ) : (
                    crmData.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: "var(--fs-xs)",
                          padding: "var(--space-0-5) var(--space-2)",
                          borderRadius: "var(--radius-md)",
                          background: "color-mix(in srgb, var(--primary) 15%, transparent)",
                          border: "1px solid color-mix(in srgb, var(--primary) 35%, transparent)",
                          color: "var(--primary)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "var(--space-1)"
                        }}
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => updateCrm(prev => ({ ...prev, tags: prev.tags.filter((_, i) => i !== idx) }))}
                          style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", padding: "0 var(--space-0-5)", fontSize: "var(--fs-xs)", lineHeight: 1 }}
                          title="Remover tag" aria-label="Remover etiqueta"
                        >
                          ✕
                        </button>
                      </span>
                    ))
                  )}
                </div>
                <div style={{ display: "flex", gap: "var(--space-1-5)", marginTop: "var(--space-1)" }}>
                  <input
                    id="crm-tag-input"
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
                    className="field-input"
                    style={{ fontSize: "var(--fs-xs)", padding: "var(--space-1) var(--space-2)", height: "32px" }}
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
                    aria-label="Adicionar etiqueta"
                    style={{ padding: "var(--space-1) var(--space-2-5)", fontSize: "var(--fs-xs)" }}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Anotações Privadas do Atendimento */}
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label htmlFor="crm-notes" style={{ fontSize: "var(--fs-xs)", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Notas da negociação
                  </label>
                  <span style={{ fontSize: "var(--fs-2xs)", color: "var(--primary)" }}>● Auto-salvamento</span>
                </div>
                <textarea
                  id="crm-notes"
                  placeholder="Ex.: Cliente quer 3 unidades. Aguardando o comprovante do PIX até as 17h."
                  value={crmData.notes}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateCrm(prev => ({ ...prev, notes: val }));
                  }}
                  className="field-input"
                  style={{
                    fontSize: "var(--fs-sm)",
                    padding: "var(--space-2-5)",
                    borderRadius: "var(--radius-sm)",
                    minHeight: "120px",
                    resize: "vertical",
                    flex: 1,
                    lineHeight: "1.45"
                  }}
                />
                <span style={{ fontSize: "var(--fs-2xs)", color: "var(--text-muted)" }}>
                  🔒 Estas notas são visíveis apenas para a sua equipe e não são enviadas ao cliente.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de enviar template no chat */}
      <Modal
        open={showChatTemplateModal}
        onClose={closeChatTemplateModal}
        title="Enviar template"
        size="sm"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!selectedAccount || !selectedPhone || !selectedTemplateName) return;
          try {
            setIsChatLoading(true);
            await axios.post(`${API_BASE_URL}/accounts/${selectedAccount.id}/messages/send`, {
              to: selectedPhone,
              templateName: selectedTemplateName,
              variables: templateVariables,
            });

            closeChatTemplateModal();
            showAlert("Template enviado.", "success");

            setTimeout(() => fetchChatMessages(selectedAccount.id, selectedPhone, true), 1000);
          } catch (err: any) {
            const details = err.response?.data?.error || "Erro desconhecido";
            showAlert(`Falha ao enviar template: ${details}`, "error");
          } finally {
            setIsChatLoading(false);
          }
        }}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={closeChatTemplateModal}>Cancelar</button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!selectedTemplateName || (templateVariables.length > 0 && templateVariables.some(v => !v.trim()))}
            >
              Enviar template
            </button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="chat-template-select" className="field-label">Template aprovado</label>
          <select
            id="chat-template-select"
            className="field-input"
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
          <span className="field-hint">Use um template para falar com o cliente fora da janela de 24 horas.</span>
        </div>

        {templateVariables.length > 0 && (
          <fieldset className="field" style={{ border: "none", padding: 0, margin: 0 }}>
            <legend className="field-label" style={{ marginBottom: "var(--space-1-5)" }}>Variáveis do template</legend>
            {templateVariables.map((v, i) => (
              <div key={i} className="field" style={{ gap: "var(--space-1)" }}>
                <label htmlFor={`chat-template-var-${i}`} style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
                  Variável {"{{"}{i + 1}{"}}"}
                </label>
                <input
                  id={`chat-template-var-${i}`}
                  type="text"
                  className="field-input"
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
          </fieldset>
        )}
      </Modal>

      {/* Modal de gerenciamento de respostas rápidas */}
      <Modal
        open={showQuickReplyModal}
        onClose={closeQuickReplyModal}
        title="Respostas rápidas"
        size="lg"
        footer={
          <>
            <button type="button" onClick={handleResetQuickReplies} className="btn btn-secondary btn-sm" style={{ marginRight: "auto" }}>
              Restaurar padrão
            </button>
            <button type="button" onClick={closeQuickReplyModal} className="btn btn-primary">
              Concluir
            </button>
          </>
        }
      >
        <p style={{ fontSize: "var(--fs-md)", color: "var(--text-muted)", margin: 0 }}>
          Cadastre mensagens que a equipe envia com um clique: ofertas, dados de pagamento, dúvidas frequentes.
        </p>

        {/* Formulário de adicionar / editar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveQuickReply();
          }}
          style={{ background: "color-mix(in srgb, var(--text-primary) 3%, transparent)", padding: "var(--space-3-5)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "var(--space-2-5)" }}
        >
          <h3 style={{ fontWeight: 600, fontSize: "var(--fs-md)", color: "var(--primary)", margin: 0 }}>
            {editingQrId ? "Editar resposta rápida" : "Nova resposta rápida"}
          </h3>
          <div className="field">
            <label htmlFor="qr-title" className="field-label">Título do botão</label>
            <input
              id="qr-title"
              type="text"
              placeholder="Ex.: 💳 Chave PIX"
              value={qrTitleInput}
              onChange={(e) => setQrTitleInput(e.target.value)}
              className="field-input"
            />
          </div>
          <div className="field">
            <label htmlFor="qr-text" className="field-label">Mensagem</label>
            <textarea
              id="qr-text"
              placeholder="Digite a mensagem completa..."
              value={qrTextInput}
              onChange={(e) => setQrTextInput(e.target.value)}
              className="field-input"
              style={{ minHeight: "85px", resize: "vertical" }}
              aria-describedby="qr-text-hint"
            />
            <span id="qr-text-hint" className="field-hint">Aceita a formatação do WhatsApp: *negrito*, _itálico_, ~riscado~.</span>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)" }}>
            {editingQrId && (
              <button
                type="button"
                onClick={() => {
                  setEditingQrId(null);
                  setQrTitleInput("");
                  setQrTextInput("");
                }}
                className="btn btn-secondary btn-sm"
              >
                Cancelar edição
              </button>
            )}
            <button type="submit" className="btn btn-primary btn-sm">
              {editingQrId ? "Salvar alterações" : "Adicionar resposta"}
            </button>
          </div>
        </form>

        {/* Lista de respostas salvas */}
        <section aria-labelledby="qr-saved-title" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <h3 id="qr-saved-title" style={{ fontSize: "var(--fs-xs)", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", margin: 0 }}>
            Respostas salvas ({quickReplies.length})
          </h3>
          <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "var(--space-2)", maxHeight: "240px" }}>
            {quickReplies.map((qr) => (
              <div
                key={qr.id}
                style={{
                  padding: "var(--space-2-5) var(--space-3)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-color)",
                  background: "color-mix(in srgb, var(--text-primary) 2%, transparent)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "var(--space-2-5)"
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "var(--fs-md)", color: "var(--text-primary)" }}>
                    {qr.title}
                  </div>
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: "var(--space-0-5)" }}>
                    {qr.text.replace(/\n/g, " ")}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "var(--space-1-5)", flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingQrId(qr.id);
                      setQrTitleInput(qr.title);
                      setQrTextInput(qr.text);
                    }}
                    className="icon-action"
                    title="Editar"
                    aria-label={`Editar a resposta rápida ${qr.title}`}
                  >
                    <Edit2 size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteQuickReply(qr.id)}
                    className="icon-action icon-action--danger"
                    title="Excluir"
                    aria-label={`Excluir a resposta rápida ${qr.title}`}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </Modal>
    </div>
  );
}
