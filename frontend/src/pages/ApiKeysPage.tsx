import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { KeyRound, Copy, Check, Plus, Trash2, X } from "lucide-react";
import { useAccount } from "../contexts/AccountContext";
import { useAlert } from "../contexts/AlertContext";
import { API_BASE_URL } from "../contexts/AuthContext";

function ModalPortal({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body);
}

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function ApiKeysPage() {
  const { selectedAccount } = useAccount();
  const { showAlert } = useAlert();

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<{ id: string; rawKey: string; name: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const fetchKeys = useCallback(async (accountId: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/accounts/${accountId}/api-keys`);
      setKeys(res.data);
    } catch {
      showAlert("Erro ao buscar chaves de API.", "error");
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    if (selectedAccount) fetchKeys(selectedAccount.id);
    else setKeys([]);
  }, [selectedAccount, fetchKeys]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    setCreating(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/accounts/${selectedAccount.id}/api-keys`, {
        name: newKeyName.trim(),
      });
      setShowCreateModal(false);
      setNewKeyName("");
      setRevealedKey({ id: res.data.id, rawKey: res.data.rawKey, name: res.data.name });
      fetchKeys(selectedAccount.id);
    } catch (err: any) {
      showAlert(err.response?.data?.error || "Erro ao criar chave.", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    if (!selectedAccount) return;
    if (!window.confirm(`Revogar a chave "${name}"? Esta ação é irreversível e interrompe qualquer integração que a utilize.`)) return;
    try {
      await axios.delete(`${API_BASE_URL}/accounts/${selectedAccount.id}/api-keys/${id}`);
      showAlert("Chave revogada com sucesso.", "success");
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } catch {
      showAlert("Erro ao revogar chave.", "error");
    }
  };

  const handleCopy = () => {
    if (!revealedKey) return;
    navigator.clipboard.writeText(revealedKey.rawKey).then(() => {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
    });
  };

  const backendUrl = (import.meta as any).env?.VITE_API_BASE_URL
    ? (import.meta as any).env.VITE_API_BASE_URL.replace("/api", "")
    : "https://seu-backend.render.com";

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "28px" }}>

      {/* ── Page Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "14px" }}>
        <div>
          <h1 className="page-heading">API Pública</h1>
          <p className="page-subheading">Chaves de acesso para disparos programáticos sem login</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          disabled={!selectedAccount}
          className="btn btn-primary"
        >
          <Plus size={16} /> Nova Chave
        </button>
      </div>

      {/* ── Documentation Card ── */}
      <div className="glass section-card">
        <div className="section-header">
          <div>
            <div className="section-title">Como usar a API</div>
            <div className="section-subtitle">Autentique com Bearer token no header Authorization</div>
          </div>
        </div>

        <div className="code-block">
          <span className="c-method">POST</span> <span className="c-url">{backendUrl}/api/v1/send</span>{"\n"}
          <span className="c-header">Authorization: Bearer sk_...</span>{"\n"}
          <span className="c-header">Content-Type: application/json</span>{"\n\n"}
          {"{"}{"\n"}
          {"  "}<span className="c-key">"to"</span>: <span className="c-val">"5511999999999"</span>,{"\n"}
          {"  "}<span className="c-key">"templateName"</span>: <span className="c-val">"nome_do_template"</span>,{"\n"}
          {"  "}<span className="c-key">"variables"</span>: [<span className="c-val">"João"</span>, <span className="c-val">"Promoção X"</span>]{"\n"}
          {"}"}
        </div>

        <div className="api-docs-grid">
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div className="section-subtitle" style={{ fontWeight: 700, marginBottom: "2px" }}>Endpoints disponíveis</div>
            {[
              { method: "POST", path: "/api/v1/send", desc: "Disparar mensagem" },
              { method: "GET",  path: "/api/v1/messages/:id", desc: "Consultar status" },
              { method: "GET",  path: "/api/v1/templates", desc: "Listar templates aprovados" },
            ].map(({ method, path, desc }) => (
              <div key={path} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.83rem" }}>
                <span className={`method-badge method-badge--${method.toLowerCase()}`}>{method}</span>
                <code style={{ background: "none", border: "none", padding: 0, fontSize: "0.83rem", color: "var(--text-secondary)" }}>{path}</code>
                <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>— {desc}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div className="section-subtitle" style={{ fontWeight: 700, marginBottom: "2px" }}>Limites e regras</div>
            {[
              "60 requisições / minuto por chave",
              "Máximo 10 chaves por conta",
              "Retorna 422 se número está em opt-out",
              "Template deve estar aprovado pela Meta",
            ].map((item) => (
              <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "0.83rem", color: "var(--text-secondary)" }}>
                <span style={{ color: "var(--primary)", marginTop: "1px", flexShrink: 0 }}>·</span>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Keys List ── */}
      {!selectedAccount ? (
        <div className="glass" style={{ borderRadius: "var(--radius-xl)" }}>
          <div className="empty-state">
            <KeyRound size={36} className="empty-state__icon" />
            <span className="empty-state__title">Nenhuma conta selecionada</span>
            <span className="empty-state__desc">Selecione uma conta para gerenciar suas chaves de API.</span>
          </div>
        </div>
      ) : loading ? (
        <div className="glass section-card">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: "52px", borderRadius: "var(--radius-md)" }} />
          ))}
        </div>
      ) : keys.length === 0 ? (
        <div className="glass" style={{ borderRadius: "var(--radius-xl)" }}>
          <div className="empty-state">
            <KeyRound size={36} className="empty-state__icon" />
            <span className="empty-state__title">Nenhuma chave criada</span>
            <span className="empty-state__desc">Crie sua primeira chave de API para integrar disparos ao seu sistema.</span>
          </div>
        </div>
      ) : (
        <div className="glass table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Prefixo</th>
                <th>Último uso</th>
                <th>Criada em</th>
                <th style={{ width: "80px" }}></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id}>
                  <td style={{ fontWeight: 600 }}>{key.name}</td>
                  <td><span className="key-prefix">{key.keyPrefix}</span></td>
                  <td style={{ color: "var(--text-secondary)", fontSize: "0.83rem" }}>
                    {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString("pt-BR") : (
                      <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Nunca utilizada</span>
                    )}
                  </td>
                  <td style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                    {new Date(key.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleRevoke(key.id, key.name)}
                      className="btn btn-danger btn-sm"
                      title="Revogar chave"
                    >
                      <Trash2 size={13} /> Revogar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal: Criar chave ── */}
      {showCreateModal && (
        <ModalPortal>
          <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowCreateModal(false); setNewKeyName(""); } }}>
            <div className="glass modal-card modal-card--sm fade-in">
              <div className="modal-header">
                <span className="modal-header__title">Nova Chave de API</span>
                <button type="button" className="modal-header__close" onClick={() => { setShowCreateModal(false); setNewKeyName(""); }}>
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleCreate}>
                <div className="modal-body">
                  <div className="field">
                    <label className="field-label">Nome da chave *</label>
                    <input
                      type="text"
                      className="field-input"
                      placeholder="Ex: Integração n8n, App Mobile..."
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="info-panel info-panel--warning">
                    <span>⚠️</span>
                    <span>A chave completa será exibida <strong>uma única vez</strong> após a criação. Copie e armazene-a com segurança imediatamente.</span>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" onClick={() => { setShowCreateModal(false); setNewKeyName(""); }} className="btn btn-secondary">
                    Cancelar
                  </button>
                  <button type="submit" disabled={creating || !newKeyName.trim()} className="btn btn-primary" style={{ minWidth: "120px" }}>
                    {creating ? "Criando..." : <><Plus size={15} /> Criar Chave</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ── Modal: Revelar chave ── */}
      {revealedKey && (
        <ModalPortal>
          <div className="modal-overlay">
            <div className="glass modal-card fade-in">
              <div className="modal-header">
                <span className="modal-header__title" style={{ color: "var(--primary)" }}>
                  <span style={{ marginRight: "8px" }}>✅</span>Chave criada: {revealedKey.name}
                </span>
              </div>
              <div className="modal-body">
                <div className="info-panel info-panel--warning">
                  <span>⚠️</span>
                  <strong>Copie esta chave agora — ela não poderá ser exibida novamente.</strong>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "stretch" }}>
                  <code style={{
                    flex: 1,
                    padding: "12px 14px",
                    background: "rgba(0,0,0,0.3)",
                    borderRadius: "var(--radius-md)",
                    fontFamily: "monospace",
                    fontSize: "0.83rem",
                    color: "var(--primary)",
                    wordBreak: "break-all",
                    border: "1px solid rgba(0,194,107,0.22)",
                    display: "block",
                    lineHeight: "1.5",
                  }}>
                    {revealedKey.rawKey}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={`btn btn-secondary copy-btn${copiedKey ? " copied" : ""}`}
                    style={{ alignSelf: "stretch", padding: "0 16px" }}
                  >
                    {copiedKey ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar</>}
                  </button>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => { setRevealedKey(null); setCopiedKey(false); }}
                  className="btn btn-primary"
                >
                  Entendi, fechar
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
