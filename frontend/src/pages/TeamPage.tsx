import { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { useAccount } from "../contexts/AccountContext";
import { useAlert } from "../contexts/AlertContext";
import { API_BASE_URL } from "../contexts/AuthContext";
import {
  Users,
  UserPlus,
  Shield,
  Headphones,
  Briefcase,
  Eye,
  KeyRound,
  Trash2,
  Edit2,
  Lock,
  Mail,
  User as UserIcon,
  Search,
  Sparkles
} from "lucide-react";

interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: "OWNER" | "ADMIN" | "MANAGER" | "ATTENDANT" | "VIEWER" | string;
  isOwner: boolean;
  createdAt: string;
}

const ROLE_INFO: Record<string, { label: string; desc: string; color: string; bg: string; border: string; icon: any }> = {
  OWNER: {
    label: "Proprietário",
    desc: "Acesso irrestrito a faturamento, números, campanhas e equipe.",
    color: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.12)",
    border: "rgba(245, 158, 11, 0.35)",
    icon: Shield,
  },
  ADMIN: {
    label: "Administrador",
    desc: "Acesso completo à conta, relatórios e gestão de colaboradores.",
    color: "#8b5cf6",
    bg: "rgba(139, 92, 246, 0.12)",
    border: "rgba(139, 92, 246, 0.35)",
    icon: Shield,
  },
  MANAGER: {
    label: "Gerente",
    desc: "Cria campanhas, gerencia listas, analisa métricas e supervisiona chats.",
    color: "#3b82f6",
    bg: "rgba(59, 130, 246, 0.12)",
    border: "rgba(59, 130, 246, 0.35)",
    icon: Briefcase,
  },
  ATTENDANT: {
    label: "Atendente",
    desc: "Foco no Live Chat, Mini-CRM e envio de respostas rápidas.",
    color: "#10b981",
    bg: "rgba(16, 185, 129, 0.12)",
    border: "rgba(16, 185, 129, 0.35)",
    icon: Headphones,
  },
  VIEWER: {
    label: "Visualizador",
    desc: "Apenas leitura de conversas e métricas, sem permissão de envio.",
    color: "#94a3b8",
    bg: "rgba(148, 163, 184, 0.12)",
    border: "rgba(148, 163, 184, 0.35)",
    icon: Eye,
  },
};

export default function TeamPage() {
  const { selectedAccount } = useAccount();
  const { showAlert } = useAlert();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modais
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  // Form State Novo Colaborador
  const [nameInput, setNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [roleInput, setRoleInput] = useState<string>("ATTENDANT");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State Edição
  const [editRoleInput, setEditRoleInput] = useState<string>("ATTENDANT");
  const [editNameInput, setEditNameInput] = useState("");
  const [editPasswordInput, setEditPasswordInput] = useState("");

  // Carregar membros da equipe
  const fetchTeam = useCallback(async (accountId: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/accounts/${accountId}/team`);
      setMembers(res.data.members || []);
    } catch (err: any) {
      console.error("Erro ao carregar equipe:", err);
      showAlert(err.response?.data?.error || "Erro ao carregar membros da equipe.", "error");
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    if (selectedAccount) {
      fetchTeam(selectedAccount.id);
    } else {
      setMembers([]);
      setLoading(false);
    }
  }, [selectedAccount, fetchTeam]);

  // Gerador de senha segura
  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$*";
    let pass = "";
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPasswordInput(pass);
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;

    if (!nameInput.trim() || !emailInput.trim()) {
      showAlert("Preencha o nome e o e-mail do colaborador.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/accounts/${selectedAccount.id}/team`, {
        name: nameInput.trim(),
        email: emailInput.trim(),
        password: passwordInput.trim() || undefined,
        role: roleInput,
      });

      showAlert(`Colaborador ${res.data.name} adicionado com sucesso! 🎉`, "success");
      setShowAddModal(false);
      setNameInput("");
      setEmailInput("");
      setPasswordInput("");
      setRoleInput("ATTENDANT");
      fetchTeam(selectedAccount.id);
    } catch (err: any) {
      showAlert(err.response?.data?.error || "Falha ao adicionar colaborador.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount || !selectedMember) return;

    setIsSubmitting(true);
    try {
      await axios.patch(`${API_BASE_URL}/accounts/${selectedAccount.id}/team/${selectedMember.id}`, {
        role: editRoleInput,
        name: editNameInput.trim() || undefined,
        password: editPasswordInput.trim() || undefined,
      });

      showAlert("Dados do colaborador atualizados com sucesso!", "success");
      setShowEditModal(false);
      setSelectedMember(null);
      fetchTeam(selectedAccount.id);
    } catch (err: any) {
      showAlert(err.response?.data?.error || "Erro ao atualizar colaborador.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMember = async (member: TeamMember) => {
    if (!selectedAccount) return;
    if (member.isOwner) {
      showAlert("Não é possível remover o proprietário da conta.", "error");
      return;
    }

    if (!window.confirm(`Tem certeza que deseja revogar o acesso de "${member.name}" (${member.email}) a esta conta?`)) {
      return;
    }

    try {
      await axios.delete(`${API_BASE_URL}/accounts/${selectedAccount.id}/team/${member.id}`);
      showAlert("Acesso do colaborador revogado.", "info");
      setMembers(prev => prev.filter(m => m.id !== member.id));
    } catch (err: any) {
      showAlert(err.response?.data?.error || "Erro ao remover colaborador.", "error");
    }
  };

  const openEditModal = (member: TeamMember) => {
    setSelectedMember(member);
    setEditRoleInput(member.role);
    setEditNameInput(member.name);
    setEditPasswordInput("");
    setShowEditModal(true);
  };

  // Contadores de distribuição de equipe
  const stats = useMemo(() => {
    let attendants = 0;
    let managers = 0;
    let admins = 0;
    for (const m of members) {
      if (m.role === "ATTENDANT") attendants++;
      else if (m.role === "MANAGER") managers++;
      else if (m.role === "ADMIN" || m.role === "OWNER") admins++;
    }
    return { total: members.length, attendants, managers, admins };
  }, [members]);

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase().trim();
    return members.filter(m =>
      m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.role.toLowerCase().includes(q)
    );
  }, [members, searchQuery]);

  if (!selectedAccount) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
        <Users size={48} style={{ color: "var(--text-muted)", marginBottom: "16px", opacity: 0.5 }} />
        <h2 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "8px" }}>Nenhuma conta selecionada</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>
          Selecione uma conta do WhatsApp no topo para gerenciar os colaboradores e cargos.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "1200px", margin: "0 auto", width: "100%" }}>
      
      {/* ── Cabeçalho Principal ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0, letterSpacing: "-0.5px" }}>
              Equipe & Colaboradores
            </h1>
            <span
              style={{
                fontSize: "0.72rem",
                padding: "2px 8px",
                borderRadius: "12px",
                background: "rgba(0, 194, 107, 0.12)",
                color: "var(--primary)",
                fontWeight: 600,
                border: "1px solid rgba(0, 194, 107, 0.3)"
              }}
            >
              Multi-Agentes & RBAC
            </span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: 0 }}>
            Gerencie os acessos individuais da sua equipe no WhatsApp Oficial <strong>{selectedAccount.name}</strong>.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setNameInput("");
            setEmailInput("");
            setPasswordInput("");
            setRoleInput("ATTENDANT");
            setShowAddModal(true);
          }}
          className="btn btn-primary"
          style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 18px", fontSize: "0.85rem", fontWeight: 600 }}
        >
          <UserPlus size={16} />
          Novo Colaborador
        </button>
      </div>

      {/* ── Cards de Estatísticas ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "16px" }}>
        <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text)" }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Total de Membros</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{stats.total}</div>
          </div>
        </div>

        <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(16, 185, 129, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981" }}>
            <Headphones size={22} />
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Atendentes (Live Chat)</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#10b981" }}>{stats.attendants}</div>
          </div>
        </div>

        <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(59, 130, 246, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6" }}>
            <Briefcase size={22} />
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Gerentes / Supervisores</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#3b82f6" }}>{stats.managers}</div>
          </div>
        </div>

        <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(245, 158, 11, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b" }}>
            <Shield size={22} />
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Admins & Dono</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#f59e0b" }}>{stats.admins}</div>
          </div>
        </div>
      </div>

      {/* ── Barra de Pesquisa e Filtro ── */}
      <div className="card" style={{ padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "260px" }}>
          <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail ou cargo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-control"
            style={{ paddingLeft: "36px", height: "38px", fontSize: "0.82rem" }}
          />
        </div>
        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
          Exibindo <strong>{filteredMembers.length}</strong> de {members.length} colaboradores
        </div>
      </div>

      {/* ── Tabela de Colaboradores ── */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
            <div className="spinner" style={{ margin: "0 auto 12px" }}></div>
            Carregando colaboradores...
          </div>
        ) : filteredMembers.length === 0 ? (
          <div style={{ padding: "50px 20px", textAlign: "center" }}>
            <Users size={40} style={{ color: "var(--text-muted)", marginBottom: "12px", opacity: 0.4 }} />
            <h3 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: "6px" }}>Nenhum colaborador encontrado</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", maxWidth: "400px", margin: "0 auto 16px" }}>
              {searchQuery ? "Nenhum membro corresponde ao termo pesquisado." : "Cadastre os operadores da sua empresa para que eles atendam clientes no Live Chat sem acesso aos dados do proprietário."}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-color)", background: "rgba(255,255,255,0.02)", color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                  <th style={{ padding: "14px 20px" }}>Colaborador</th>
                  <th style={{ padding: "14px 20px" }}>Cargo / Nível</th>
                  <th style={{ padding: "14px 20px" }}>Permissões Principais</th>
                  <th style={{ padding: "14px 20px" }}>Ingresso</th>
                  <th style={{ padding: "14px 20px", textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((m) => {
                  const rInfo = ROLE_INFO[m.role] || ROLE_INFO.ATTENDANT;
                  const Icon = rInfo.icon;
                  const initials = m.name ? m.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "U";

                  return (
                    <tr key={m.id} style={{ borderBottom: "1px solid var(--border-color)", transition: "background 0.15s" }}>
                      
                      {/* Nome e E-mail */}
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div
                            style={{
                              width: "38px",
                              height: "38px",
                              borderRadius: "50%",
                              background: rInfo.bg,
                              border: `1px solid ${rInfo.border}`,
                              color: rInfo.color,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: "0.82rem",
                              flexShrink: 0
                            }}
                          >
                            {initials}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                              {m.name}
                              {m.isOwner && (
                                <span style={{ fontSize: "0.65rem", padding: "1px 5px", borderRadius: "6px", background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
                                  Dono
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>{m.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Cargo */}
                      <td style={{ padding: "14px 20px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "3px 10px",
                            borderRadius: "14px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            background: rInfo.bg,
                            color: rInfo.color,
                            border: `1px solid ${rInfo.border}`,
                          }}
                        >
                          <Icon size={12} />
                          {rInfo.label}
                        </span>
                      </td>

                      {/* Descrição resumida */}
                      <td style={{ padding: "14px 20px", color: "var(--text-muted)", fontSize: "0.78rem", maxWidth: "280px" }}>
                        {rInfo.desc}
                      </td>

                      {/* Data de ingresso */}
                      <td style={{ padding: "14px 20px", color: "var(--text-muted)", fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                        {new Date(m.createdAt).toLocaleDateString("pt-BR")}
                      </td>

                      {/* Ações */}
                      <td style={{ padding: "14px 20px", textAlign: "right", whiteSpace: "nowrap" }}>
                        {m.isOwner ? (
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                            Inalterável
                          </span>
                        ) : (
                          <div style={{ display: "inline-flex", gap: "6px" }}>
                            <button
                              type="button"
                              onClick={() => openEditModal(m)}
                              className="btn btn-ghost"
                              style={{ padding: "6px 10px", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
                              title="Alterar cargo ou redefinir senha"
                            >
                              <Edit2 size={13} /> Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMember(m)}
                              className="btn btn-ghost"
                              style={{ padding: "6px 10px", fontSize: "0.75rem", color: "#f87171" }}
                              title="Revogar acesso à conta"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal: Novo Colaborador ── */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "520px", width: "95%", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-color)", padding: "24px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(0, 194, 107, 0.15)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <UserPlus size={18} />
                </div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Adicionar Colaborador</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.1rem" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMember} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "6px", display: "block" }}>
                  Nome Completo do Colaborador *
                </label>
                <div style={{ position: "relative" }}>
                  <UserIcon size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                  <input
                    type="text"
                    required
                    placeholder="Ex: Amanda Ferreira"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="form-control"
                    style={{ paddingLeft: "32px", height: "38px", fontSize: "0.82rem" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "6px", display: "block" }}>
                  E-mail de Login Corporativo *
                </label>
                <div style={{ position: "relative" }}>
                  <Mail size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                  <input
                    type="email"
                    required
                    placeholder="amanda@empresa.com.br"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="form-control"
                    style={{ paddingLeft: "32px", height: "38px", fontSize: "0.82rem" }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, margin: 0 }}>
                    Senha Inicial de Acesso
                  </label>
                  <button
                    type="button"
                    onClick={generatePassword}
                    style={{ background: "none", border: "none", color: "var(--primary)", fontSize: "0.72rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "3px", fontWeight: 600 }}
                  >
                    <Sparkles size={12} /> Gerar Automática
                  </button>
                </div>
                <div style={{ position: "relative" }}>
                  <Lock size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                  <input
                    type="text"
                    placeholder="Mínimo 6 caracteres (ou deixe em branco para padrão)"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="form-control"
                    style={{ paddingLeft: "32px", height: "38px", fontSize: "0.82rem" }}
                  />
                </div>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                  O colaborador usará este e-mail e senha para entrar na plataforma.
                </span>
              </div>

              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "8px", display: "block" }}>
                  Cargo e Nível de Permissão *
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {[
                    { key: "ATTENDANT", label: "🎧 Atendente", desc: "Live Chat e Mini-CRM" },
                    { key: "MANAGER", label: "👔 Gerente", desc: "Campanhas, Listas e Métricas" },
                    { key: "ADMIN", label: "🛡️ Administrador", desc: "Acesso total à conta" },
                    { key: "VIEWER", label: "📊 Visualizador", desc: "Apenas leitura de dados" },
                  ].map((item) => {
                    const isSelected = roleInput === item.key;
                    return (
                      <div
                        key={item.key}
                        onClick={() => setRoleInput(item.key)}
                        style={{
                          padding: "10px 12px",
                          borderRadius: "10px",
                          border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border-color)",
                          background: isSelected ? "rgba(0, 194, 107, 0.12)" : "rgba(255,255,255,0.03)",
                          cursor: "pointer",
                          transition: "all 0.15s"
                        }}
                      >
                        <div style={{ fontSize: "0.82rem", fontWeight: 600, color: isSelected ? "var(--primary)" : "var(--text)" }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px" }}>
                          {item.desc}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-ghost"
                  style={{ fontSize: "0.82rem" }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary"
                  style={{ fontSize: "0.82rem", padding: "8px 20px" }}
                >
                  {isSubmitting ? "Cadastrando..." : "Cadastrar Colaborador"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Editar Cargo / Senha ── */}
      {showEditModal && selectedMember && (
        <div className="modal-backdrop" onClick={() => setShowEditModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "480px", width: "95%", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-color)", padding: "24px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Edit2 size={18} />
                </div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Editar Colaborador</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.1rem" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateMember} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "6px", display: "block" }}>
                  Nome
                </label>
                <input
                  type="text"
                  value={editNameInput}
                  onChange={(e) => setEditNameInput(e.target.value)}
                  className="form-control"
                  style={{ height: "38px", fontSize: "0.82rem" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "6px", display: "block" }}>
                  Alterar Cargo
                </label>
                <select
                  value={editRoleInput}
                  onChange={(e) => setEditRoleInput(e.target.value)}
                  className="form-control"
                  style={{ height: "38px", fontSize: "0.82rem" }}
                >
                  <option value="ATTENDANT">🎧 Atendente (Apenas Live Chat & Mini-CRM)</option>
                  <option value="MANAGER">👔 Gerente (Campanhas, Listas e Métricas)</option>
                  <option value="ADMIN">🛡️ Administrador (Acesso total à conta)</option>
                  <option value="VIEWER">📊 Visualizador (Apenas leitura)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "6px", display: "block" }}>
                  Redefinir Senha de Acesso (opcional)
                </label>
                <div style={{ position: "relative" }}>
                  <KeyRound size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                  <input
                    type="text"
                    placeholder="Deixe em branco para não alterar"
                    value={editPasswordInput}
                    onChange={(e) => setEditPasswordInput(e.target.value)}
                    className="form-control"
                    style={{ paddingLeft: "32px", height: "38px", fontSize: "0.82rem" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-ghost"
                  style={{ fontSize: "0.82rem" }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary"
                  style={{ fontSize: "0.82rem", padding: "8px 20px" }}
                >
                  {isSubmitting ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
