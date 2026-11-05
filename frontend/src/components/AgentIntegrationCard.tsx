import { useEffect, useState } from "react";
import axios from "axios";
import { Copy, Check, RefreshCw, Send } from "lucide-react";
import { API_BASE_URL } from "../contexts/AuthContext";
import { useAlert } from "../contexts/AlertContext";

interface Integration {
  enabled: boolean;
  webhookUrl: string | null;
  mode: "webhook" | "pull";
  hasSecret: boolean;
  pauseHours: number;
  last24h: { delivered: number; pending: number; failed: number; pull: number };
  lastDeliveredAt: string | null;
  lastError: { message: string; status: string; at: string } | null;
  secret?: string;
}

/** Mensagem de erro da API (axios) ou o texto padrão. */
function apiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = (err.response?.data as { error?: string } | undefined)?.error;
    if (msg) return msg;
  }
  return fallback;
}

/**
 * Configuração da integração com o agente de IA (vendas/SDR) da conta.
 * Especificação para o time do agente: docs/integracao-agente-ia.md
 */
export default function AgentIntegrationCard({ accountId }: { accountId: string }) {
  const { showAlert } = useAlert();
  const [data, setData] = useState<Integration | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);

  // O componente é montado com key={accountId}: trocar de conta recria o estado (inclusive o segredo exibido)
  useEffect(() => {
    let alive = true;
    axios
      .get<Integration>(`${API_BASE_URL}/accounts/${accountId}/agent-integration`)
      .then((res) => {
        if (!alive) return;
        setData(res.data);
        setEnabled(res.data.enabled);
        setUrl(res.data.webhookUrl || "");
        setForbidden(false);
      })
      .catch((err: unknown) => {
        if (alive && axios.isAxiosError(err) && err.response?.status === 403) setForbidden(true);
      });
    return () => {
      alive = false;
    };
  }, [accountId, reloadKey]);

  if (forbidden || !data) return null;

  const save = async () => {
    setSaving(true);
    try {
      const res = await axios.put<Integration>(`${API_BASE_URL}/accounts/${accountId}/agent-integration`, {
        enabled,
        webhookUrl: url.trim(),
      });
      setData(res.data);
      if (res.data.secret) setSecret(res.data.secret);
      showAlert(enabled ? "Integração com o agente salva." : "Integração com o agente desativada.", "success");
    } catch (err) {
      showAlert(apiError(err, "Erro ao salvar a integração."), "error");
    } finally {
      setSaving(false);
    }
  };

  const rotate = async () => {
    if (!window.confirm("Gerar um novo segredo? O agente para de aceitar eventos até você atualizar o segredo nele.")) return;
    try {
      const res = await axios.post<{ secret: string }>(`${API_BASE_URL}/accounts/${accountId}/agent-integration/secret`);
      setSecret(res.data.secret);
      setReloadKey((k) => k + 1);
    } catch (err) {
      showAlert(apiError(err, "Erro ao gerar segredo."), "error");
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const res = await axios.post<{ ok: boolean; error: string | null; latencyMs: number }>(
        `${API_BASE_URL}/accounts/${accountId}/agent-integration/test`
      );
      if (res.data.ok) showAlert(`Agente respondeu em ${res.data.latencyMs} ms.`, "success");
      else showAlert(`O agente não confirmou o evento: ${res.data.error}`, "error");
    } catch (err) {
      showAlert(apiError(err, "Erro ao testar."), "error");
    } finally {
      setTesting(false);
    }
  };

  const copy = () => {
    if (!secret) return;
    navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const dirty = enabled !== data.enabled || url.trim() !== (data.webhookUrl || "");

  return (
    <div className="glass section-card">
      <div className="section-header">
        <div>
          <div className="section-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span aria-hidden="true">🤖</span> Agente de IA
          </div>
          <div className="section-subtitle">
            Repassa as mensagens recebidas a um agente externo, que responde pela API pública
          </div>
        </div>
        <span
          className="tag-chip"
          style={{ color: data.enabled ? "var(--primary)" : "var(--text-muted)" }}
        >
          {data.enabled ? (data.mode === "webhook" ? "Ativo · webhook" : "Ativo · leitura por /events") : "Desativado"}
        </span>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.9rem", cursor: "pointer" }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Enviar as mensagens recebidas deste número para o agente
      </label>

      <div className="field">
        <label className="field-label">URL do webhook do agente</label>
        <input
          type="url"
          className="field-input"
          placeholder="https://agente.suaempresa.com.br/webhooks/send"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          HTTPS e endereço público. Deixe vazio enquanto o agente roda localmente: ele busca os eventos em{" "}
          <code>GET /api/v1/events</code> com uma chave de API.
        </span>
      </div>

      {secret && (
        <div className="info-panel info-panel--warning" style={{ flexDirection: "column", alignItems: "stretch", gap: "8px" }}>
          <strong>Segredo de assinatura — copie agora, ele não será exibido de novo.</strong>
          <div style={{ display: "flex", gap: "8px" }}>
            <code style={{ flex: 1, wordBreak: "break-all", padding: "8px 10px", background: "rgba(0,0,0,0.3)", borderRadius: "var(--radius-sm)" }}>
              {secret}
            </code>
            <button type="button" className="btn btn-secondary btn-sm" onClick={copy}>
              {copied ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
            </button>
          </div>
          <span style={{ fontSize: "0.78rem" }}>
            Configure no agente (ex.: <code>SEND_WEBHOOK_SECRET</code>) para validar o header <code>X-Send-Signature</code>.
          </span>
        </div>
      )}

      {data.enabled && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
          <span>Últimas 24h:</span>
          {data.mode === "webhook" ? (
            <>
              <span>✅ {data.last24h.delivered} entregues</span>
              {data.last24h.pending > 0 && <span>⏳ {data.last24h.pending} aguardando nova tentativa</span>}
              {data.last24h.failed > 0 && <span style={{ color: "var(--error)" }}>❌ {data.last24h.failed} desistidos</span>}
            </>
          ) : (
            <span>📥 {data.last24h.pull} eventos disponíveis para leitura</span>
          )}
          {data.lastError && (
            <span style={{ color: "var(--error)" }}>Último erro: {data.lastError.message}</span>
          )}
          <span>Pausa após atendimento humano: {data.pauseHours}h</span>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "flex-end" }}>
        {data.hasSecret && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={rotate}>
            <RefreshCw size={13} /> Novo segredo
          </button>
        )}
        {data.enabled && data.webhookUrl && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={test} disabled={testing || dirty}>
            <Send size={13} /> {testing ? "Testando..." : "Testar webhook"}
          </button>
        )}
        <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving || !dirty}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}
