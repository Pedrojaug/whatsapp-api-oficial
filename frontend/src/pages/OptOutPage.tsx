import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useAccount } from "../contexts/AccountContext";
import { useAlert } from "../hooks/useAlert";
import { API_BASE_URL } from "../contexts/AuthContext";
import { ShieldOff, Trash2, PlusCircle, Search, Upload } from "lucide-react";

interface OptOut {
  id: string;
  phone: string;
  reason: string;
  createdAt: string;
}

const REASON_LABEL: Record<string, string> = {
  KEYWORD: "Automático (STOP)",
  MANUAL: "Manual",
  USER_REQUEST: "Solicitação",
};

export default function OptOutPage() {
  const { selectedAccount } = useAccount();
  const { showAlert } = useAlert();

  const [optOuts, setOptOuts] = useState<OptOut[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [addingPhone, setAddingPhone] = useState(false);

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [importing, setImporting] = useState(false);

  const LIMIT = 50;

  const fetchOptOuts = useCallback(async () => {
    if (!selectedAccount) return;
    setLoading(true);
    try {
      const params: any = { page, limit: LIMIT };
      if (search.trim()) params.search = search.trim();
      const res = await axios.get(`${API_BASE_URL}/accounts/${selectedAccount.id}/optouts`, { params });
      setOptOuts(res.data.optOuts);
      setTotal(res.data.total);
    } catch {
      showAlert("Erro ao carregar lista de opt-out.", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedAccount, page, search]);

  useEffect(() => { fetchOptOuts(); }, [fetchOptOuts]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOptOuts();
  };

  const handleRemove = async (phone: string) => {
    if (!selectedAccount) return;
    if (!confirm(`Remover ${phone} da lista de opt-out e permitir envios novamente?`)) return;
    try {
      await axios.delete(`${API_BASE_URL}/accounts/${selectedAccount.id}/optouts/${encodeURIComponent(phone)}`);
      showAlert("Contato removido da lista de opt-out.", "success");
      fetchOptOuts();
    } catch {
      showAlert("Erro ao remover contato.", "error");
    }
  };

  const handleAddSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount || !newPhone.trim()) return;
    setAddingPhone(true);
    try {
      await axios.post(`${API_BASE_URL}/accounts/${selectedAccount.id}/optouts`, { phone: newPhone.trim() });
      showAlert("Número adicionado à lista de opt-out.", "success");
      setNewPhone("");
      setShowAddModal(false);
      fetchOptOuts();
    } catch (err: any) {
      showAlert(err.response?.data?.error || "Erro ao adicionar número.", "error");
    } finally {
      setAddingPhone(false);
    }
  };

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    const phones = bulkText
      .split(/[\n,;]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (phones.length === 0) { showAlert("Nenhum número encontrado.", "error"); return; }
    setImporting(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/accounts/${selectedAccount.id}/optouts/bulk`, { phones });
      showAlert(`${res.data.imported} número(s) importado(s) com sucesso.`, "success");
      setBulkText("");
      setShowBulkModal(false);
      fetchOptOuts();
    } catch (err: any) {
      showAlert(err.response?.data?.error || "Erro na importação.", "error");
    } finally {
      setImporting(false);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  if (!selectedAccount) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <ShieldOff size={40} style={{ color: "var(--text-muted)" }} />
          <p>Selecione uma conta para gerenciar opt-outs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <ShieldOff size={22} /> Lista de Opt-out (LGPD)
          </h1>
          <p className="page-subtitle">
            Contatos que optaram por não receber mensagens. O dispatcher bloqueia automaticamente o envio para esses números.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={() => setShowBulkModal(true)}>
            <Upload size={16} /> Importar lista
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <PlusCircle size={16} /> Adicionar número
          </button>
        </div>
      </div>

      {/* Stats card */}
      <div className="stats-grid" style={{ marginBottom: "20px" }}>
        <div className="stat-card glass">
          <div className="stat-label">Total opt-outs</div>
          <div className="stat-value">{total}</div>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            className="field-input"
            style={{ paddingLeft: "36px" }}
            placeholder="Buscar por número..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-secondary">Buscar</button>
      </form>

      {/* Table */}
      <div className="glass" style={{ borderRadius: "12px", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Carregando...</div>
        ) : optOuts.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center" }}>
            <ShieldOff size={36} style={{ color: "var(--text-muted)", marginBottom: "12px" }} />
            <p style={{ color: "var(--text-muted)" }}>Nenhum contato na lista de opt-out.</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>Número</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>Origem</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>Data</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {optOuts.map((o) => (
                <tr key={o.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "0.9rem" }}>{o.phone}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      fontSize: "0.75rem", fontWeight: 600, padding: "3px 8px", borderRadius: "20px",
                      background: o.reason === "KEYWORD" ? "rgba(239,68,68,0.1)" : "rgba(99,102,241,0.1)",
                      color: o.reason === "KEYWORD" ? "var(--error)" : "var(--primary)",
                    }}>
                      {REASON_LABEL[o.reason] ?? o.reason}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    {new Date(o.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: "5px 10px", fontSize: "0.8rem" }}
                      onClick={() => handleRemove(o.phone)}
                      title="Remover da lista (re-opt-in)"
                    >
                      <Trash2 size={14} /> Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "16px" }}>
          <button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</button>
          <span style={{ lineHeight: "36px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
            {page} / {totalPages}
          </span>
          <button className="btn btn-secondary" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Próxima</button>
        </div>
      )}

      {/* Modal: Adicionar único */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal glass" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "420px" }}>
            <h2 style={{ marginBottom: "16px" }}>Adicionar número ao opt-out</h2>
            <form onSubmit={handleAddSingle}>
              <div className="field">
                <label className="field-label">Número (com DDI, ex: 5511999999999)</label>
                <input
                  className="field-input"
                  placeholder="5511999999999"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={addingPhone}>
                  {addingPhone ? "Adicionando..." : "Adicionar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Importação em massa */}
      {showBulkModal && (
        <div className="modal-overlay" onClick={() => setShowBulkModal(false)}>
          <div className="modal glass" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
            <h2 style={{ marginBottom: "8px" }}>Importar lista de opt-out</h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "16px" }}>
              Cole os números (um por linha, ou separados por vírgula/ponto-e-vírgula). Máximo 10.000 por importação.
            </p>
            <form onSubmit={handleBulkImport}>
              <textarea
                className="field-input"
                rows={10}
                placeholder={"5511999999999\n5521988888888\n5531977777777"}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                style={{ fontFamily: "monospace", resize: "vertical" }}
                required
              />
              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowBulkModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={importing}>
                  {importing ? "Importando..." : "Importar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
