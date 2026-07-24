import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth, API_BASE_URL } from "../contexts/AuthContext";
import { useAlert } from "../contexts/AlertContext";
import { Users, CreditCard, Smartphone, Send, Search, Trash2, UserCheck, Sparkles, RefreshCw } from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "SUPERUSER";
  planTier: "free" | "paid";
  emailVerified: boolean;
  createdAt: string;
  _count: {
    accounts: number;
  };
}

interface AdminStats {
  totalUsers: number;
  paidUsers: number;
  freeUsers: number;
  totalAccounts: number;
  totalMessages: number;
}

export default function AdminPage() {
  const { user, impersonate } = useAuth();
  const { showAlert } = useAlert();
  const navigate = useNavigate();

  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState<"all" | "paid" | "free">("all");

  // User Deletion Modal
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);

  const fetchAdminUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/admin/users`);
      setAdminUsers(res.data);
    } catch (err: any) {
      console.error("Erro ao buscar usuários do sistema:", err);
      showAlert("Erro ao buscar usuários do sistema.", "error");
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/admin/stats`);
      setStats(res.data);
    } catch (err: any) {
      console.error("Erro ao carregar estatísticas gerais:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchAdminUsers();
    fetchStats();
  }, []);

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

  const handlePlanChange = async (targetUserId: string, newPlan: "free" | "paid") => {
    setUpdatingId(targetUserId);
    try {
      await axios.patch(`${API_BASE_URL}/admin/users/${targetUserId}/plan`, { planTier: newPlan });
      showAlert(`Plano atualizado para ${newPlan === "paid" ? "Pago (Pro)" : "Gratuito (Teste)"}!`, "success");
      setAdminUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, planTier: newPlan } : u));
      fetchStats();
    } catch (err: any) {
      showAlert(err.response?.data?.error || "Erro ao atualizar plano do usuário.", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRoleChange = async (targetUserId: string, newRole: "USER" | "SUPERUSER") => {
    setUpdatingId(targetUserId);
    try {
      await axios.patch(`${API_BASE_URL}/admin/users/${targetUserId}/role`, { role: newRole });
      showAlert(`Perfil atualizado para ${newRole === "SUPERUSER" ? "Superusuário" : "Usuário Regular"}!`, "success");
      setAdminUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, role: newRole } : u));
    } catch (err: any) {
      showAlert(err.response?.data?.error || "Erro ao atualizar perfil do usuário.", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setUpdatingId(userToDelete.id);
    try {
      await axios.delete(`${API_BASE_URL}/admin/users/${userToDelete.id}`);
      showAlert("Usuário removido com sucesso!", "success");
      setAdminUsers(prev => prev.filter(u => u.id !== userToDelete.id));
      setUserToDelete(null);
      fetchStats();
    } catch (err: any) {
      showAlert(err.response?.data?.error || "Erro ao excluir usuário.", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredUsers = adminUsers.filter(u => {
    const matchesSearch =
      (u.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlan =
      planFilter === "all" ? true : u.planTier === planFilter;
    return matchesSearch && matchesPlan;
  });

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "2rem", fontWeight: "700", marginBottom: "6px" }}>Painel Administrativo</h1>
          <p style={{ color: "var(--text-secondary)" }}>
            Gestão completa de clientes, status de assinaturas e suporte técnico do Send Inteligentte
          </p>
        </div>
        <button
          type="button"
          onClick={() => { fetchAdminUsers(); fetchStats(); }}
          className="btn btn-secondary"
          style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.88rem" }}
        >
          <RefreshCw size={16} /> Atualizar Dados
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
        <div className="glass" style={{ padding: "20px", borderRadius: "var(--radius-lg)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>Total Clientes</span>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(0,194,107,0.12)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users size={20} />
            </div>
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700 }}>
            {loadingStats ? "..." : stats?.totalUsers ?? 0}
          </div>
        </div>

        <div className="glass" style={{ padding: "20px", borderRadius: "var(--radius-lg)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>Assinantes Pro</span>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(16,185,129,0.12)", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CreditCard size={20} />
            </div>
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#10b981" }}>
            {loadingStats ? "..." : stats?.paidUsers ?? 0}
          </div>
        </div>

        <div className="glass" style={{ padding: "20px", borderRadius: "var(--radius-lg)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>Em Período de Teste</span>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(245,158,11,0.12)", color: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={20} />
            </div>
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#f59e0b" }}>
            {loadingStats ? "..." : stats?.freeUsers ?? 0}
          </div>
        </div>

        <div className="glass" style={{ padding: "20px", borderRadius: "var(--radius-lg)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>Contas Meta Conectadas</span>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(99,102,241,0.12)", color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Smartphone size={20} />
            </div>
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700 }}>
            {loadingStats ? "..." : stats?.totalAccounts ?? 0}
          </div>
        </div>

        <div className="glass" style={{ padding: "20px", borderRadius: "var(--radius-lg)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>Total Disparos</span>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(236,72,153,0.12)", color: "#ec4899", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Send size={20} />
            </div>
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700 }}>
            {loadingStats ? "..." : stats?.totalMessages ?? 0}
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="glass" style={{ padding: "28px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Controls header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: "600" }}>
            Clientes Cadastrados ({filteredUsers.length} de {adminUsers.length})
          </h3>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            {/* Search Input */}
            <div style={{ position: "relative", minWidth: "220px" }}>
              <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Buscar por nome ou e-mail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="field-input"
                style={{ paddingLeft: "36px", fontSize: "0.85rem" }}
              />
            </div>

            {/* Plan Filter */}
            <select
              value={planFilter}
              onChange={(e: any) => setPlanFilter(e.target.value)}
              className="field-input"
              style={{ fontSize: "0.85rem", paddingRight: "30px", cursor: "pointer" }}
            >
              <option value="all">Todos os Planos</option>
              <option value="paid">Apenas Pagantes (Pro)</option>
              <option value="free">Apenas Gratuitos (Teste)</option>
            </select>
          </div>
        </div>

        {loadingUsers ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className="skeleton" style={{ width: "100%", height: "48px", borderRadius: "8px" }}></div>
            <div className="skeleton" style={{ width: "100%", height: "48px", borderRadius: "8px" }}></div>
            <div className="skeleton" style={{ width: "100%", height: "48px", borderRadius: "8px" }}></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
            <p style={{ fontSize: "0.95rem" }}>Nenhum cliente encontrado com os filtros selecionados.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.92rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}>
                  <th style={{ padding: "12px 10px" }}>Cliente</th>
                  <th style={{ padding: "12px 10px" }}>E-mail</th>
                  <th style={{ padding: "12px 10px" }}>Plano Atual</th>
                  <th style={{ padding: "12px 10px" }}>Perfil</th>
                  <th style={{ padding: "12px 10px" }}>Linhas Meta</th>
                  <th style={{ padding: "12px 10px" }}>Cadastro</th>
                  <th style={{ padding: "12px 10px", textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const isSelf = u.id === user?.id;
                  const isUpdating = updatingId === u.id;

                  return (
                    <tr key={u.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "14px 10px", fontWeight: "600" }}>
                        {u.name || "-"}
                      </td>
                      <td style={{ padding: "14px 10px", color: "var(--text-secondary)" }}>
                        {u.email}
                      </td>
                      <td style={{ padding: "14px 10px" }}>
                        <select
                          value={u.planTier}
                          disabled={isUpdating}
                          onChange={(e) => handlePlanChange(u.id, e.target.value as "free" | "paid")}
                          style={{
                            background: u.planTier === "paid" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                            color: u.planTier === "paid" ? "#10b981" : "#f59e0b",
                            border: u.planTier === "paid" ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(245, 158, 11, 0.3)",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            fontSize: "0.8rem",
                            fontWeight: "600",
                            cursor: "pointer"
                          }}
                        >
                          <option value="free" style={{ background: "#111827", color: "#fff" }}>⚡ Gratuito (Teste)</option>
                          <option value="paid" style={{ background: "#111827", color: "#fff" }}>💎 Pago (Pro Send)</option>
                        </select>
                      </td>
                      <td style={{ padding: "14px 10px" }}>
                        <select
                          value={u.role}
                          disabled={isUpdating || isSelf}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as "USER" | "SUPERUSER")}
                          style={{
                            background: u.role === "SUPERUSER" ? "rgba(0, 194, 107, 0.15)" : "rgba(255, 255, 255, 0.05)",
                            color: u.role === "SUPERUSER" ? "var(--primary)" : "var(--text-secondary)",
                            border: u.role === "SUPERUSER" ? "1px solid rgba(0, 194, 107, 0.3)" : "1px solid rgba(255, 255, 255, 0.1)",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            fontSize: "0.8rem",
                            fontWeight: "600",
                            cursor: isSelf ? "default" : "pointer"
                          }}
                        >
                          <option value="USER" style={{ background: "#111827", color: "#fff" }}>USER</option>
                          <option value="SUPERUSER" style={{ background: "#111827", color: "#fff" }}>SUPERUSER</option>
                        </select>
                      </td>
                      <td style={{ padding: "14px 10px" }}>
                        📱 {u._count?.accounts || 0}
                      </td>
                      <td style={{ padding: "14px 10px", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                        {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td style={{ padding: "14px 10px", textAlign: "right" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", alignItems: "center" }}>
                          {!isSelf ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleLaunchImpersonate(u.id)}
                                className="btn btn-primary"
                                style={{
                                  padding: "6px 12px",
                                  fontSize: "0.78rem",
                                  background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                                  boxShadow: "0 4px 12px 0 rgba(245, 158, 11, 0.2)",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px"
                                }}
                              >
                                <UserCheck size={14} /> Suporte
                              </button>

                              <button
                                type="button"
                                onClick={() => setUserToDelete(u)}
                                className="btn btn-danger"
                                style={{
                                  padding: "6px 10px",
                                  fontSize: "0.78rem",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px"
                                }}
                                title="Excluir Usuário"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          ) : (
                            <span style={{ color: "var(--text-muted)", fontSize: "0.82rem", fontStyle: "italic" }}>
                              Sua Conta
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Deletion Confirmation Modal */}
      {userToDelete && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 10000,
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px"
        }}>
          <div className="glass" style={{
            maxWidth: "440px",
            width: "100%",
            padding: "28px",
            borderRadius: "var(--radius-xl)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            display: "flex",
            flexDirection: "column",
            gap: "20px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "var(--error)" }}>
              <Trash2 size={24} />
              <h3 style={{ fontSize: "1.2rem", fontWeight: "700" }}>Confirmar Exclusão</h3>
            </div>

            <p style={{ fontSize: "0.92rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
              Tem certeza que deseja excluir permanentemente o cliente <strong>{userToDelete.name || userToDelete.email}</strong>?
              Esta ação excluirá todas as contas de WhatsApp e mensagens vinculadas.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="btn btn-secondary"
                style={{ padding: "8px 16px" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                className="btn btn-danger"
                style={{ padding: "8px 16px" }}
              >
                Excluir Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
