import { useState } from "react";
import axios from "axios";
import { useAccount } from "../contexts/AccountContext";
import { useAlert } from "../contexts/AlertContext";
import { API_BASE_URL } from "../contexts/AuthContext";
import SetupWizard from "../components/SetupWizard";

interface ShareMember {
  id: string;
  userId: string;
  user: { id: string; email: string; name: string | null; avatarUrl: string | null };
}

export default function AccountsPage() {
  const { accounts, selectAccount, fetchAccounts, deleteAccount } = useAccount();
  const { showAlert } = useAlert();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Share management state
  const [shareModalAccountId, setShareModalAccountId] = useState<string | null>(null);
  const [shareModalAccountName, setShareModalAccountName] = useState("");
  const [members, setMembers] = useState<ShareMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [loadingShare, setLoadingShare] = useState(false);

  const handleCopy = (text: string, label: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(key);
      showAlert(`${label} copiado!`, "success");
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleSave = (newAcc: any) => {
    fetchAccounts();
    selectAccount(newAcc);
  };

  const openShareModal = async (accountId: string, accountName: string) => {
    setShareModalAccountId(accountId);
    setShareModalAccountName(accountName);
    setInviteEmail("");
    try {
      const res = await axios.get(`${API_BASE_URL}/accounts/${accountId}/shares`);
      setMembers(res.data);
    } catch {
      setMembers([]);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !shareModalAccountId) return;
    setLoadingShare(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/accounts/${shareModalAccountId}/shares`, {
        email: inviteEmail.trim(),
      });
      setMembers(prev => [...prev, res.data]);
      setInviteEmail("");
      showAlert("Acesso concedido com sucesso!", "success");
    } catch (err: any) {
      showAlert(err.response?.data?.error || "Erro ao convidar usuário.", "error");
    } finally {
      setLoadingShare(false);
    }
  };

  const handleRemoveMember = async (shareId: string) => {
    if (!shareModalAccountId) return;
    try {
      await axios.delete(`${API_BASE_URL}/accounts/${shareModalAccountId}/shares/${shareId}`);
      setMembers(prev => prev.filter(m => m.id !== shareId));
      showAlert("Acesso removido.", "success");
    } catch {
      showAlert("Erro ao remover acesso.", "error");
    }
  };

  const ownedAccounts = accounts.filter(a => !a.isShared);
  const sharedAccounts = accounts.filter(a => a.isShared);

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
      <div>
        <h1 className="page-heading">Configurações de Contas Meta API</h1>
        <p className="page-subheading">Gerencie suas contas do WhatsApp Business integradas</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "30px", alignItems: "start" }}>
        {/* Wizard de Conexão */}
        <div>
          <SetupWizard onSave={handleSave} />
        </div>

        {/* Lista de Contas */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Contas próprias */}
          <div className="glass" style={{ padding: "30px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "20px" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: "600" }}>Contas Configuradas</h3>

            {ownedAccounts.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>Nenhuma conta cadastrada ainda.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {ownedAccounts.map((acc) => (
                  <div key={acc.id} className="glass" style={{ padding: "20px", borderRadius: "var(--radius-md)", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <span style={{ fontWeight: "600", fontSize: "1.1rem" }}>{acc.name}</span>
                      {[
                        { label: "ID Interno (n8n/API)", value: acc.id, key: `id-${acc.id}` },
                        { label: "WABA ID", value: acc.wabaId, key: `waba-${acc.id}` },
                        { label: "Phone ID", value: acc.phoneNumberId, key: `phone-${acc.id}` },
                      ].map(({ label, value, key }) => (
                        <div key={key} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                            <strong style={{ color: "var(--text-secondary)" }}>{label}:</strong>{" "}
                            <span style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{value}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(value, label, key)}
                            title={`Copiar ${label}`}
                            style={{ background: "none", border: "none", cursor: "pointer", color: copiedId === key ? "var(--primary)" : "rgba(255,255,255,0.3)", padding: "2px", display: "flex", alignItems: "center", transition: "color 0.2s", flexShrink: 0 }}
                          >
                            {copiedId === key ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <button
                        onClick={() => openShareModal(acc.id, acc.name)}
                        className="btn btn-secondary"
                        style={{ padding: "8px 14px", fontSize: "0.8rem" }}
                        title="Gerenciar quem tem acesso a esta conta"
                      >
                        Gerenciar Acesso
                      </button>
                      <button onClick={() => deleteAccount(acc.id)} className="btn btn-danger" style={{ padding: "8px 14px", fontSize: "0.85rem" }}>
                        Excluir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contas compartilhadas comigo */}
          {sharedAccounts.length > 0 && (
            <div className="glass" style={{ padding: "24px 30px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "16px" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "600", color: "var(--text-secondary)" }}>
                Contas Compartilhadas Comigo
              </h3>
              {sharedAccounts.map((acc) => (
                <div key={acc.id} className="glass" style={{ padding: "16px 20px", borderRadius: "var(--radius-md)", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontWeight: "600" }}>{acc.name}</span>
                      <span style={{ fontSize: "0.7rem", background: "rgba(0,194,107,0.15)", color: "var(--primary)", padding: "2px 8px", borderRadius: "20px", fontWeight: "600" }}>
                        Compartilhada
                      </span>
                    </div>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontFamily: "monospace" }}>{acc.id}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Gerenciamento de Acesso */}
      {shareModalAccountId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShareModalAccountId(null)}>
          <div className="glass" style={{ width: "480px", maxWidth: "95vw", borderRadius: "var(--radius-xl)", padding: "30px", display: "flex", flexDirection: "column", gap: "24px" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: "700" }}>Gerenciar Acesso</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "2px" }}>{shareModalAccountName}</p>
              </div>
              <button type="button" onClick={() => setShareModalAccountId(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.3rem", cursor: "pointer" }}>✕</button>
            </div>

            {/* Convidar novo usuário */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-secondary)" }}>Conceder acesso por e-mail</label>
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleInvite()}
                  style={{ flex: 1, padding: "10px 14px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.07)", border: "1px solid var(--border-color)", color: "#fff", outline: "none", fontSize: "0.9rem" }}
                />
                <button
                  onClick={handleInvite}
                  disabled={loadingShare || !inviteEmail.trim()}
                  className="btn btn-primary"
                  style={{ padding: "10px 18px", fontSize: "0.85rem", whiteSpace: "nowrap" }}
                >
                  {loadingShare ? "..." : "Adicionar"}
                </button>
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>O usuário precisa já ter uma conta no Send Inteligentte.</p>
            </div>

            {/* Lista de membros com acesso */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-secondary)" }}>Usuários com acesso</label>
              {members.length === 0 ? (
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Nenhum usuário adicional com acesso.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {members.map(m => (
                    <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: "var(--radius-md)", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span style={{ fontSize: "0.9rem", fontWeight: "500" }}>{m.user.name || m.user.email}</span>
                        {m.user.name && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{m.user.email}</span>}
                      </div>
                      <button
                        onClick={() => handleRemoveMember(m.id)}
                        className="btn btn-danger"
                        style={{ padding: "5px 12px", fontSize: "0.78rem" }}
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
