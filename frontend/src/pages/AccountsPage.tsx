import { useAccount } from "../contexts/AccountContext";
import SetupWizard from "../components/SetupWizard";

export default function AccountsPage() {
  const { accounts, selectAccount, fetchAccounts, deleteAccount } = useAccount();

  const handleSave = (newAcc: any) => {
    fetchAccounts();
    selectAccount(newAcc);
  };

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
      <div>
        <h1 style={{ fontSize: "2rem", fontWeight: "700", marginBottom: "8px" }}>Configurações de Contas Meta API</h1>
        <p style={{ color: "var(--text-secondary)" }}>Gerencie suas contas do WhatsApp Business integradas</p>
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
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontWeight: "600", fontSize: "1.1rem" }}>{acc.name}</span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}><strong>ID Interno (n8n/API):</strong> {acc.id}</span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>WABA ID: {acc.wabaId}</span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Phone ID: {acc.phoneNumberId}</span>
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
