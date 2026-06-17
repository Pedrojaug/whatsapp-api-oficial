import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
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
      showAlert("Chave revogada.", "success");
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
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px" }}>
        <div>
          <h1 className="page-heading">API Pública</h1>
          <p className="page-subheading">Chaves de acesso para integrar disparos programaticamente sem fazer login</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          disabled={!selectedAccount}
          className="btn btn-primary"
          style={{ padding: "9px 18px", fontSize: "0.9rem" }}
        >
          + Nova Chave
        </button>
      </div>

      {/* Documentação rápida */}
      <div className="glass" style={{ padding: "24px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "14px" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: "700", color: "var(--text-secondary)" }}>Como usar a API</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "0.85rem" }}>
          <div style={{ background: "rgba(0,0,0,0.25)", padding: "12px 16px", borderRadius: "var(--radius-md)", fontFamily: "monospace", lineHeight: "1.8", color: "var(--text-secondary)" }}>
            <span style={{ color: "var(--primary)" }}>POST</span> {backendUrl}/api/v1/send<br />
            <span style={{ color: "#888" }}>Authorization: Bearer sk_...</span><br />
            <span style={{ color: "#888" }}>Content-Type: application/json</span><br />
            <br />
            {`{`}<br />
            &nbsp;&nbsp;<span style={{ color: "#f9c74f" }}>"to"</span>: <span style={{ color: "#90be6d" }}>"5511999999999"</span>,<br />
            &nbsp;&nbsp;<span style={{ color: "#f9c74f" }}>"templateName"</span>: <span style={{ color: "#90be6d" }}>"nome_do_template"</span>,<br />
            &nbsp;&nbsp;<span style={{ color: "#f9c74f" }}>"variables"</span>: [<span style={{ color: "#90be6d" }}>"João"</span>, <span style={{ color: "#90be6d" }}>"Promoção"</span>]<br />
            {`}`}
          </div>
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", fontSize: "0.82rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ color: "var(--text-muted)", fontWeight: "600" }}>Endpoints disponíveis</span>
              <span style={{ color: "var(--text-secondary)" }}>POST /api/v1/send — Disparar mensagem</span>
              <span style={{ color: "var(--text-secondary)" }}>GET /api/v1/messages/:id — Consultar status</span>
              <span style={{ color: "var(--text-secondary)" }}>GET /api/v1/templates — Listar templates aprovados</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ color: "var(--text-muted)", fontWeight: "600" }}>Limites</span>
              <span style={{ color: "var(--text-secondary)" }}>60 requisições/min por chave</span>
              <span style={{ color: "var(--text-secondary)" }}>Máximo 10 chaves por conta</span>
              <span style={{ color: "var(--text-secondary)" }}>Retorna 422 se número está em opt-out</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de chaves */}
      {!selectedAccount ? (
        <div className="glass" style={{ borderRadius: "var(--radius-xl)" }}>
          <div className="empty-state">
            <span className="empty-state__icon">🔑</span>
            <span className="empty-state__title">Nenhuma conta selecionada</span>
            <span className="empty-state__desc">Selecione uma conta para gerenciar suas chaves de API.</span>
          </div>
        </div>
      ) : loading ? (
        <div className="glass" style={{ padding: "24px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "10px" }}>
          {[1, 2].map((i) => <div key={i} className="skeleton" style={{ height: "56px", borderRadius: "var(--radius-md)" }} />)}
        </div>
      ) : keys.length === 0 ? (
        <div className="glass" style={{ borderRadius: "var(--radius-xl)" }}>
          <div className="empty-state">
            <span className="empty-state__icon">🔑</span>
            <span className="empty-state__title">Nenhuma chave criada</span>
            <span className="empty-state__desc">Crie sua primeira chave de API para integrar disparos ao seu sistema.</span>
          </div>
        </div>
      ) : (
        <div className="glass" style={{ borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.2)", color: "var(--text-secondary)", textAlign: "left" }}>
                <th style={{ padding: "14px 20px", fontWeight: "600" }}>Nome</th>
                <th style={{ padding: "14px 16px", fontWeight: "600" }}>Prefixo</th>
                <th style={{ padding: "14px 16px", fontWeight: "600" }}>Último uso</th>
                <th style={{ padding: "14px 16px", fontWeight: "600" }}>Criada em</th>
                <th style={{ padding: "14px 16px", width: "100px" }}></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key, idx) => (
                <tr key={key.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                  <td style={{ padding: "14px 20px", fontWeight: "600" }}>{key.name}</td>
                  <td style={{ padding: "14px 16px", fontFamily: "monospace", fontSize: "0.82rem", color: "var(--primary)" }}>
                    {key.keyPrefix}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                    {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString("pt-BR") : "Nunca utilizada"}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    {new Date(key.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => handleRevoke(key.id, key.name)}
                      className="btn btn-danger"
                      style={{ padding: "5px 10px", fontSize: "0.78rem" }}
                    >
                      Revogar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: criar chave */}
      {showCreateModal && (
        <ModalPortal>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
            <div className="glass fade-in" style={{ width: "420px", maxWidth: "95vw", borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid var(--border-color)", background: "rgba(0,0,0,0.1)" }}>
                <h3 style={{ fontSize: "1.15rem", fontWeight: "700" }}>Nova Chave de API</h3>
                <button type="button" onClick={() => { setShowCreateModal(false); setNewKeyName(""); }} style={{ background: "none", border: "none", color: "#fff", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
              </div>
              <form onSubmit={handleCreate} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>Nome da chave *</label>
                  <input
                    type="text"
                    placeholder="Ex: Integração n8n, App Mobile..."
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    required
                    autoFocus
                    style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none", fontSize: "0.9rem" }}
                  />
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", padding: "10px 14px", background: "rgba(255,193,7,0.05)", borderRadius: "var(--radius-md)", border: "1px solid rgba(255,193,7,0.2)" }}>
                  ⚠️ A chave completa será exibida <strong>uma única vez</strong> após a criação. Copie e armazene-a com segurança.
                </div>
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", borderTop: "1px solid var(--border-color)", paddingTop: "14px" }}>
                  <button type="button" onClick={() => { setShowCreateModal(false); setNewKeyName(""); }} className="btn btn-secondary">Cancelar</button>
                  <button type="submit" disabled={creating} className="btn btn-primary" style={{ minWidth: "130px" }}>
                    {creating ? "Criando..." : "Criar Chave"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal: revelar chave criada */}
      {revealedKey && (
        <ModalPortal>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
            <div className="glass fade-in" style={{ width: "520px", maxWidth: "95vw", borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-color)", background: "rgba(0,0,0,0.1)" }}>
                <h3 style={{ fontSize: "1.15rem", fontWeight: "700", color: "var(--primary)" }}>✅ Chave criada: {revealedKey.name}</h3>
              </div>
              <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
                <div style={{ padding: "14px 16px", background: "rgba(255,193,7,0.07)", border: "1px solid rgba(255,193,7,0.3)", borderRadius: "var(--radius-md)", fontSize: "0.85rem", color: "#f9c74f", fontWeight: "600" }}>
                  ⚠️ Copie esta chave agora. Ela não poderá ser exibida novamente.
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <code style={{ flex: 1, padding: "12px 14px", background: "rgba(0,0,0,0.3)", borderRadius: "var(--radius-md)", fontFamily: "monospace", fontSize: "0.82rem", color: "var(--primary)", wordBreak: "break-all", border: "1px solid rgba(0,194,107,0.2)" }}>
                    {revealedKey.rawKey}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="btn btn-secondary"
                    style={{ padding: "10px 14px", whiteSpace: "nowrap", fontSize: "0.85rem" }}
                  >
                    {copiedKey ? "✅ Copiado!" : "📋 Copiar"}
                  </button>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--border-color)", paddingTop: "14px" }}>
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
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
