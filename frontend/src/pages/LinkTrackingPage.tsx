import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { Link2, Copy, Check, Plus, Trash2, X } from "lucide-react";
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
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "28px" }}>

      {/* ── Page Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "14px" }}>
        <div>
          <h1 className="page-heading">Rastreamento de Links</h1>
          <p className="page-subheading">URLs encurtadas com contagem de cliques para incluir nos disparos</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          disabled={!selectedAccount}
          className="btn btn-primary"
        >
          <Plus size={16} /> Novo Link
        </button>
      </div>

      {/* ── Content ── */}
      {!selectedAccount ? (
        <div className="glass" style={{ borderRadius: "var(--radius-xl)" }}>
          <div className="empty-state">
            <Link2 size={36} className="empty-state__icon" />
            <span className="empty-state__title">Nenhuma conta selecionada</span>
            <span className="empty-state__desc">Selecione uma conta para gerenciar links rastreados.</span>
          </div>
        </div>
      ) : loading ? (
        <div className="glass section-card">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: "56px", borderRadius: "var(--radius-md)" }} />
          ))}
        </div>
      ) : links.length === 0 ? (
        <div className="glass" style={{ borderRadius: "var(--radius-xl)" }}>
          <div className="empty-state">
            <Link2 size={36} className="empty-state__icon" />
            <span className="empty-state__title">Nenhum link criado</span>
            <span className="empty-state__desc">Crie links rastreados para medir o engajamento dos seus disparos.</span>
          </div>
        </div>
      ) : (
        <div className="glass table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Label / Código</th>
                <th>URL Rastreada</th>
                <th>URL Original</th>
                <th style={{ textAlign: "center" }}>Cliques</th>
                <th>Último Clique</th>
                <th>Criado em</th>
                <th style={{ width: "80px" }}></th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{link.label || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Sem label</span>}</div>
                    <span className="key-prefix" style={{ marginTop: "4px", display: "inline-block" }}>{link.shortCode}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "var(--primary)" }}>
                        {link.trackedUrl}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(link)}
                        title="Copiar URL rastreada"
                        className={`copy-btn${copiedId === link.id ? " copied" : ""}`}
                      >
                        {copiedId === link.id ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
                      </button>
                    </div>
                  </td>
                  <td style={{ maxWidth: "200px", color: "var(--text-secondary)", fontSize: "0.82rem" }}>
                    <a
                      href={link.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--text-secondary)", wordBreak: "break-all" }}
                    >
                      {link.originalUrl.length > 50 ? link.originalUrl.slice(0, 50) + "…" : link.originalUrl}
                    </a>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: "1.1rem", color: link.clicks > 0 ? "var(--primary)" : "var(--text-muted)" }}>
                      {link.clicks}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-secondary)", fontSize: "0.82rem" }}>
                    {link.lastClickAt ? new Date(link.lastClickAt).toLocaleString("pt-BR") : (
                      <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Nunca clicado</span>
                    )}
                  </td>
                  <td style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                    {new Date(link.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleDelete(link.id)}
                      className="btn btn-danger btn-sm"
                      title="Excluir link"
                    >
                      <Trash2 size={13} /> Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal: Criar link ── */}
      {showCreateModal && (
        <ModalPortal>
          <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowCreateModal(false); } }}>
            <div className="glass modal-card fade-in">
              <div className="modal-header">
                <span className="modal-header__title">Novo Link Rastreado</span>
                <button type="button" className="modal-header__close" onClick={() => setShowCreateModal(false)}>
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleCreate}>
                <div className="modal-body">
                  <div className="field">
                    <label className="field-label">URL Original *</label>
                    <input
                      type="url"
                      className="field-input"
                      placeholder="https://seusite.com/pagina"
                      value={newOriginalUrl}
                      onChange={(e) => setNewOriginalUrl(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="field">
                    <label className="field-label">Label (opcional)</label>
                    <input
                      type="text"
                      className="field-input"
                      placeholder="Ex: Campanha Black Friday"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                    />
                  </div>
                  <div className="info-panel info-panel--success">
                    <span>🔗</span>
                    <span>Um código único será gerado automaticamente. Use a URL rastreada nos seus disparos para contabilizar cliques.</span>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">Cancelar</button>
                  <button type="submit" disabled={creating || !newOriginalUrl.trim()} className="btn btn-primary" style={{ minWidth: "120px" }}>
                    {creating ? "Criando..." : <><Plus size={15} /> Criar Link</>}
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
