import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth, API_BASE_URL } from "../contexts/AuthContext";
import { useAlert } from "../contexts/AlertContext";

export default function AdminPage() {
  const { user, impersonate } = useAuth();
  const { showAlert } = useAlert();
  const navigate = useNavigate();

  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [loadingAdminUsers, setLoadingAdminUsers] = useState(false);

  const fetchAdminUsers = async () => {
    setLoadingAdminUsers(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/admin/users`);
      setAdminUsers(res.data);
    } catch (err: any) {
      console.error("Erro ao buscar usuários do sistema:", err);
      showAlert("Erro ao buscar usuários do sistema.", "error");
    } finally {
      setLoadingAdminUsers(false);
    }
  };

  const handleLaunchImpersonate = async (targetUserId: string) => {
    try {
      showAlert("Iniciando sessão de suporte...");
      await impersonate(targetUserId);
      showAlert("Sessão de suporte iniciada!", "success");
      navigate("/metrics");
    } catch (err: any) {
      showAlert(err.message || "Erro ao iniciar suporte.", "error");
    }
  };

  useEffect(() => {
    fetchAdminUsers();
  }, []);

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
      <div>
        <h1 style={{ fontSize: "2rem", fontWeight: "700", marginBottom: "8px" }}>Painel Administrativo</h1>
        <p style={{ color: "var(--text-secondary)" }}>Gerencie todos os clientes cadastrados e acesse suas contas via suporte técnico</p>
      </div>

      <div className="glass" style={{ padding: "30px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: "600" }}>Clientes Cadastrados ({adminUsers.length})</h3>
          <button type="button" onClick={fetchAdminUsers} className="btn btn-secondary" style={{ padding: "8px 14px", fontSize: "0.85rem" }}>
            🔄 Atualizar Lista
          </button>
        </div>

        {loadingAdminUsers ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className="skeleton" style={{ width: "100%", height: "40px", borderRadius: "8px" }}></div>
            <div className="skeleton" style={{ width: "100%", height: "40px", borderRadius: "8px" }}></div>
            <div className="skeleton" style={{ width: "100%", height: "40px", borderRadius: "8px" }}></div>
          </div>
        ) : adminUsers.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>Nenhum usuário cadastrado no sistema.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}>
                  <th style={{ padding: "12px 8px" }}>Nome</th>
                  <th style={{ padding: "12px 8px" }}>E-mail</th>
                  <th style={{ padding: "12px 8px" }}>Perfil</th>
                  <th style={{ padding: "12px 8px" }}>Linhas Meta</th>
                  <th style={{ padding: "12px 8px" }}>Cadastro</th>
                  <th style={{ padding: "12px 8px" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {adminUsers.map((u) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "12px 8px", fontWeight: "600" }}>{u.name || "-"}</td>
                    <td style={{ padding: "12px 8px" }}>{u.email}</td>
                    <td style={{ padding: "12px 8px" }}>
                      <span style={{
                        background: u.role === "SUPERUSER" ? "rgba(0, 194, 107, 0.15)" : "rgba(255, 255, 255, 0.05)",
                        color: u.role === "SUPERUSER" ? "var(--primary)" : "var(--text-secondary)",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        fontWeight: "600"
                      }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: "12px 8px" }}>📱 {u._count?.accounts || 0}</td>
                    <td style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "12px 8px" }}>
                      {u.id !== user?.id ? (
                        <button
                          type="button"
                          onClick={() => handleLaunchImpersonate(u.id)}
                          className="btn btn-primary"
                          style={{ padding: "6px 12px", fontSize: "0.8rem", background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", boxShadow: "0 4px 14px 0 rgba(245, 158, 11, 0.2)" }}
                        >
                          🚪 Entrar como Suporte
                        </button>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Sua Conta</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
