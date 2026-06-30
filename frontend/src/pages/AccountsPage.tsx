import { useState } from "react";
import { useAccount } from "../contexts/AccountContext";
import { useAlert } from "../contexts/AlertContext";
import SetupWizard from "../components/SetupWizard";

export default function AccountsPage() {
  const { accounts, selectAccount, fetchAccounts, deleteAccount } = useAccount();
  const { showAlert } = useAlert();
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
        <div className="glass" style={{ padding: "30px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "20px" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: "600" }}>Contas Configuradas</h3>

          {accounts.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>Nenhuma conta cadastrada ainda.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {accounts.map((acc) => (
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
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: copiedId === key ? "var(--primary)" : "rgba(255,255,255,0.3)",
                            padding: "2px",
                            display: "flex",
                            alignItems: "center",
                            transition: "color 0.2s",
                            flexShrink: 0,
                          }}
                        >
                          {copiedId === key ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => deleteAccount(acc.id)} className="btn btn-danger" style={{ padding: "8px 14px", fontSize: "0.85rem" }}>
                    Excluir
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
