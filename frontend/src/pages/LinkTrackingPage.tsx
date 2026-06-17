import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useAccount } from "../contexts/AccountContext";
import { useAlert } from "../contexts/AlertContext";
import { API_BASE_URL } from "../contexts/AuthContext";

function ModalPortal({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body);
}

interface TrackedLink {
  id: string;
  shortCode: string;
  originalUrl: string;
  label: string | null;
  clicks: number;
  lastClickAt: string | null;
  createdAt: string;
  trackedUrl: string;
}

export default function LinkTrackingPage() {
  const { selectedAccount } = useAccount();
  const { showAlert } = useAlert();

  const [links, setLinks] = useState<TrackedLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOriginalUrl, setNewOriginalUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchLinks = useCallback(async (accountId: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/accounts/${accountId}/tracked-links`);
      setLinks(res.data);
    } catch {
      showAlert("Erro ao buscar links rastreados.", "error");
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    if (selectedAccount) fetchLinks(selectedAccount.id);
    else setLinks([]);
  }, [selectedAccount, fetchLinks]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    setCreating(true);
    try {
      await axios.post(`${API_BASE_URL}/accounts/${selectedAccount.id}/tracked-links`, {
        originalUrl: newOriginalUrl.trim(),
        label: newLabel.trim() || undefined,
      });
      showAlert("Link rastreado criado!", "success");
      setShowCreateModal(false);
      setNewOriginalUrl("");
      setNewLabel("");
      fetchLinks(selectedAccount.id);
    } catch (err: any) {
      showAlert(err.response?.data?.error || "Erro ao criar link.", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!selectedAccount) return;
    if (!window.confirm("Excluir este link rastreado?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/accounts/${selectedAccount.id}/tracked-links/${id}`);
      showAlert("Link excluído.", "success");
      setLinks((prev) => prev.filter((l) => l.id !== id));
    } catch {
      showAlert("Erro ao excluir link.", "error");
    }
  };

  const handleCopy = (link: TrackedLink) => {
    navigator.clipboard.writeText(link.trackedUrl).then(() => {
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px" }}>
        <div>
          <h1 className="page-heading">Rastreamento de Links</h1>
          <p className="page-subheading">Crie URLs encurtadas com contagem de cliques para incluir nos seus disparos</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          disabled={!selectedAccount}
          className="btn btn-primary"
          style={{ padding: "9px 18px", fontSize: "0.9rem" }}
        >
          + Novo Link
        </button>
      </div>

      {!selectedAccount ? (
        <div className="glass" style={{ borderRadius: "var(--radius-xl)" }}>
          <div className="empty-state">
            <span className="empty-state__icon">🔗</span>
            <span className="empty-state__title">Nenhuma conta selecionada</span>
            <span className="empty-state__desc">Selecione uma conta para gerenciar links rastreados.</span>
          </div>
        </div>
      ) : loading ? (
        <div className="glass" style={{ padding: "30px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "12px" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: "60px", borderRadius: "var(--radius-md)" }} />
          ))}
        </div>
      ) : links.length === 0 ? (
        <div className="glass" style={{ borderRadius: "var(--radius-xl)" }}>
          <div className="empty-state">
            <span className="empty-state__icon">🔗</span>
            <span className="empty-state__title">Nenhum link criado</span>
            <span className="empty-state__desc">Clique em "Novo Link" para criar seu primeiro link rastreado.</span>
          </div>
        </div>
      ) : (
        <div className="glass" style={{ borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.2)", color: "var(--text-secondary)", textAlign: "left" }}>
                <th style={{ padding: "14px 20px", fontWeight: "600" }}>Label / Código</th>
                <th style={{ padding: "14px 16px", fontWeight: "600" }}>URL Rastreada</th>
                <th style={{ padding: "14px 16px", fontWeight: "600" }}>URL Original</th>
                <th style={{ padding: "14px 16px", fontWeight: "600", textAlign: "center" }}>Cliques</th>
                <th style={{ padding: "14px 16px", fontWeight: "600" }}>Último Clique</th>
                <th style={{ padding: "14px 16px", fontWeight: "600" }}>Criado em</th>
                <th style={{ padding: "14px 16px", width: "90px" }}></th>
              </tr>
            </thead>
            <tbody>
              {links.map((link, idx) => (
                <tr
                  key={link.id}
                  style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}
                >
                  <td style={{ padding: "14px 20px" }}>
                    <div style={{ fontWeight: "600" }}>{link.label || "—"}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "monospace" }}>{link.shortCode}</div>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontFamily: "monospace", fontSize: "0.82rem", color: "var(--primary)" }}>
                        {link.trackedUrl}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(link)}
                        title="Copiar URL rastreada"
                        style={{ background: "none", border: "none", cursor: "pointer", color: copiedId === link.id ? "var(--primary)" : "var(--text-muted)", fontSize: "0.9rem", padding: "2px 4px", borderRadius: "4px" }}
                      >
                        {copiedId === link.id ? "✅" : "📋"}
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px", maxWidth: "200px" }}>
                    <a
                      href={link.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--text-secondary)", fontSize: "0.82rem", wordBreak: "break-all" }}
                    >
                      {link.originalUrl.length > 50 ? link.originalUrl.slice(0, 50) + "…" : link.originalUrl}
                    </a>
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "center", fontWeight: "700", fontSize: "1.1rem", color: link.clicks > 0 ? "var(--primary)" : "var(--text-muted)" }}>
                    {link.clicks}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                    {link.lastClickAt ? new Date(link.lastClickAt).toLocaleString("pt-BR") : "—"}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    {new Date(link.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => handleDelete(link.id)}
                      className="btn btn-danger"
                      style={{ padding: "5px 10px", fontSize: "0.78rem" }}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <ModalPortal>
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
            <div className="glass fade-in" style={{ width: "500px", maxWidth: "95vw", borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid var(--border-color)", background: "rgba(0,0,0,0.1)" }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: "700" }}>Novo Link Rastreado</h3>
                <button type="button" onClick={() => setShowCreateModal(false)} style={{ background: "none", border: "none", color: "#fff", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
              </div>

              <form onSubmit={handleCreate} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>URL Original *</label>
                  <input
                    type="url"
                    placeholder="https://seusite.com/pagina"
                    value={newOriginalUrl}
                    onChange={(e) => setNewOriginalUrl(e.target.value)}
                    required
                    style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none", fontSize: "0.9rem" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>Label (opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: Campanha Black Friday"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none", fontSize: "0.9rem" }}
                  />
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", padding: "10px 14px", background: "rgba(0,194,107,0.05)", borderRadius: "var(--radius-md)", border: "1px solid rgba(0,194,107,0.15)" }}>
                  Um código curto único será gerado automaticamente. Use a URL rastreada nos seus disparos para contabilizar cliques.
                </div>
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", borderTop: "1px solid var(--border-color)", paddingTop: "14px" }}>
                  <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">Cancelar</button>
                  <button type="submit" disabled={creating} className="btn btn-primary" style={{ minWidth: "130px" }}>
                    {creating ? "Criando..." : "Criar Link"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
