import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../contexts/AuthContext";
import { useAlert } from "../contexts/AlertContext";

interface AgentStatus {
  enabled: boolean;
  paused: boolean;
  pausedBy: string | null;
  resumesAt: string | null;
}

/**
 * Faixa no topo da conversa do Live Chat: mostra se o agente de IA está
 * atendendo este contato e permite pausar (assumir) ou devolver ao agente.
 * Não aparece quando a integração com o agente está desligada na conta.
 */
export default function AgentStatusBar({ accountId, phone, canChat }: { accountId: string; phone: string; canChat: boolean }) {
  const { showAlert } = useAlert();
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    axios
      .get<AgentStatus>(`${API_BASE_URL}/accounts/${accountId}/conversations/${encodeURIComponent(phone)}/agent`)
      .then((res) => alive && setStatus(res.data))
      .catch(() => alive && setStatus(null));
    return () => {
      alive = false;
    };
  }, [accountId, phone, reloadKey]);

  // Atualiza quando um atendente responde, o agente pede um humano ou alguém pausa/retoma
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (!d || d.accountId !== accountId) return;
      const samePhone = typeof d.to === "string" && d.to.replace(/\D/g, "").endsWith(phone.replace(/\D/g, "").slice(-8));
      if (!samePhone) return;
      if (d.type === "agentStatusChanged" || d.type === "conversationStatusChanged" || d.sentByUserName) {
        setReloadKey((k) => k + 1);
      }
    };
    window.addEventListener("messageUpdated", handler);
    return () => window.removeEventListener("messageUpdated", handler);
  }, [accountId, phone]);

  if (!status?.enabled) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      const res = await axios.patch<AgentStatus>(
        `${API_BASE_URL}/accounts/${accountId}/conversations/${encodeURIComponent(phone)}/agent`,
        { paused: !status.paused }
      );
      setStatus({ ...status, ...res.data });
      showAlert(res.data.paused ? "Agente pausado nesta conversa." : "Conversa devolvida ao agente de IA.", "success");
    } catch (err) {
      const msg = axios.isAxiosError(err) ? (err.response?.data as { error?: string } | undefined)?.error : undefined;
      showAlert(msg || "Não foi possível alterar o agente.", "error");
    } finally {
      setBusy(false);
    }
  };

  const resumes = status.resumesAt ? new Date(status.resumesAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null;

  return (
    <div
      className={`info-panel ${status.paused ? "info-panel--warning" : "info-panel--success"}`}
      style={{ margin: "var(--space-1) var(--space-3-5)", padding: "6px 12px", display: "flex", alignItems: "center", gap: "10px", flexShrink: 0, fontSize: "0.8rem" }}
    >
      <span aria-hidden="true">{status.paused ? "⏸️" : "🤖"}</span>
      <span style={{ flex: 1 }}>
        {status.paused
          ? <>Agente de IA pausado{status.pausedBy ? (status.pausedBy === "agente" ? " — o agente pediu um atendente" : ` — ${status.pausedBy} assumiu`) : ""}.{resumes ? ` Volta a atender sozinho em ${resumes}.` : ""}</>
          : <>Agente de IA atendendo esta conversa. Se você responder, ele é pausado.</>}
      </span>
      {canChat && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={toggle} disabled={busy}>
          {status.paused ? "Devolver ao agente" : "Assumir conversa"}
        </button>
      )}
    </div>
  );
}
