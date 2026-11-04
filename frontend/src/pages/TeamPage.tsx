import { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { useAccount } from "../contexts/AccountContext";
import { useAlert } from "../contexts/AlertContext";
import { API_BASE_URL } from "../contexts/AuthContext";
import { useConfirm } from "../hooks/useConfirm";
import Modal from "../components/Modal";
import { getInitials } from "../utils/formatters";
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

// Cores vêm dos tokens --role-* (index.css), então acompanham o tema claro/escuro.
const ROLE_INFO: Record<string, { label: string; short: string; desc: string; color: string; icon: typeof Shield }> = {
  OWNER: {
    label: "Proprietário",
    short: "Acesso total à conta",
    desc: "Acesso total: números, disparos, equipe e chaves de API. Único que pode excluir a conta.",
    color: "var(--role-owner)",
    icon: Shield,
  },
  ADMIN: {
    label: "Administrador",
    short: "Tudo, exceto excluir a conta",
    desc: "Tudo do proprietário, inclusive equipe e chaves de API, exceto excluir a conta.",
    color: "var(--role-admin)",
    icon: Shield,
  },
  MANAGER: {
    label: "Gerente",
    short: "Templates, listas, disparos e métricas",
    desc: "Cria templates, listas e campanhas, faz disparos, vê métricas e atende no chat.",
    color: "var(--role-manager)",
    icon: Briefcase,
  },
  ATTENDANT: {
    label: "Atendente",
    short: "Live Chat e respostas rápidas",
    desc: "Atende no Live Chat (responde, envia template a um contato, respostas rápidas) e consulta listas.",
    color: "var(--role-attendant)",
    icon: Headphones,
  },
  VIEWER: {
    label: "Visualizador",
    short: "Somente leitura",
    desc: "Somente leitura de conversas, listas, disparos e métricas. Não envia mensagens.",
    color: "var(--role-viewer)",
    icon: Eye,
  },
};

const ASSIGNABLE_ROLES = ["ATTENDANT", "MANAGER", "ADMIN", "VIEWER"] as const;

// Variáveis CSS por elemento: o selo e o bloco de ícone leem a cor daqui.
const roleStyle = (color: string) => ({ "--role-color": color }) as React.CSSProperties;
const tileStyle = (color: string) => ({ "--tile-color": color }) as React.CSSProperties;

/** Grupo de opções de cargo (radiogroup): setas do teclado trocam a seleção. */
function RolePicker({ value, onChange, labelledBy }: { value: string; onChange: (role: string) => void; labelledBy: string }) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const i = Math.max(0, ASSIGNABLE_ROLES.indexOf(value as (typeof ASSIGNABLE_ROLES)[number]));
    const next = ASSIGNABLE_ROLES[(i + delta + ASSIGNABLE_ROLES.length) % ASSIGNABLE_ROLES.length];
    onChange(next);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-role="${next}"]`)?.focus();
  };
  return (
    <div className="role-options" role="radiogroup" aria-labelledby={labelledBy} onKeyDown={onKeyDown}>
      {ASSIGNABLE_ROLES.map((key) => {
        const info = ROLE_INFO[key];
        const Icon = info.icon;
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            data-role={key}
            className="role-option"
            style={roleStyle(info.color)}
            onClick={() => onChange(key)}
          >
            <span className="role-option__label">
              <Icon size={14} aria-hidden="true" /> {info.label}
            </span>
            <span className="role-option__desc">{info.short}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function TeamPage() {
  const { selectedAccount } = useAccount();
  const { showAlert } = useAlert();
  const confirm = useConfirm();

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

  // Mesmas regras do backend (validateMemberPassword). A senha vai exatamente como
  // digitada: o login não faz trim, então nada de remover espaços em silêncio.
  const getPasswordError = (password: string): string | null => {
    if (!password) return "Defina uma senha de acesso para o colaborador.";
    if (password !== password.trim()) return "A senha não pode começar nem terminar com espaço.";
    if (password.length < 6) return "A senha deve ter no mínimo 6 caracteres.";
    if (password.length > 128) return "A senha deve ter no máximo 128 caracteres.";
    return null;
  };

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

    const passwordError = getPasswordError(passwordInput);
    if (passwordError) {
      showAlert(passwordError, "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/accounts/${selectedAccount.id}/team`, {
        name: nameInput.trim(),
        email: emailInput.trim(),
        password: passwordInput,
        role: roleInput,
      });

      if (res.data.notice) {
        showAlert(res.data.notice, "info");
      } else {
        showAlert(`Colaborador ${res.data.name} adicionado! Ele entra com o e-mail ${res.data.email} e a senha definida.`, "success");
      }
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

    if (editPasswordInput) {
      const passwordError = getPasswordError(editPasswordInput);
      if (passwordError) {
        showAlert(passwordError, "error");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await axios.patch(`${API_BASE_URL}/accounts/${selectedAccount.id}/team/${selectedMember.id}`, {
        role: editRoleInput,
        name: editNameInput.trim() || undefined,
        password: editPasswordInput || undefined,
      });

      showAlert(
        res.data.passwordUpdated
          ? "Colaborador atualizado. A nova senha já vale para o próximo login."
          : "Dados do colaborador atualizados com sucesso!",
        "success"
      );
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

    const ok = await confirm({
      title: `Revogar o acesso de ${member.name}?`,
      description: `${member.email} deixa de acessar esta conta imediatamente. O usuário continua existindo e pode ser adicionado de novo depois.`,
      confirmLabel: "Revogar acesso",
      tone: "danger",
    });
    if (!ok) return;

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
      <div className="glass" style={{ borderRadius: "var(--radius-xl)" }}>
        <div className="empty-state">
          <Users size={48} className="empty-state__icon" aria-hidden="true" />
          <h2 className="empty-state__title">Nenhuma conta selecionada</h2>
          <p className="empty-state__desc">Selecione uma conta do WhatsApp no topo para gerenciar a equipe e os cargos.</p>
        </div>
      </div>
    );
  }

  const statTiles = [
    { label: "Total de membros", value: stats.total, color: "var(--text-primary)", icon: Users },
    { label: "Atendentes", value: stats.attendants, color: "var(--role-attendant)", icon: Headphones },
    { label: "Gerentes", value: stats.managers, color: "var(--role-manager)", icon: Briefcase },
    { label: "Proprietário e admins", value: stats.admins, color: "var(--role-owner)", icon: Shield },
  ];

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: "1200px", margin: "0 auto", width: "100%" }}>

      {/* ── Cabeçalho ── */}
      <div className="page-header">
        <div>
          <h1 className="page-heading">Equipe &amp; Acessos</h1>
          <p className="page-subheading">
            Convide colaboradores e defina o que cada um pode fazer na conta <strong>{selectedAccount.name}</strong>.
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
        >
          <UserPlus size={16} aria-hidden="true" />
          Novo colaborador
        </button>
      </div>

      {/* ── Números da equipe ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "var(--space-4)" }}>
        {statTiles.map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="glass" style={{ borderRadius: "var(--radius-lg)", padding: "var(--space-4) var(--space-5)", display: "flex", alignItems: "center", gap: "var(--space-3-5)" }}>
            <div className="icon-tile" style={tileStyle(color)}>
              <Icon size={22} aria-hidden="true" />
            </div>
            <div>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.04em" }}>{label}</div>
              <div style={{ fontSize: "var(--fs-2xl)", fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Busca ── */}
      <div className="glass" style={{ borderRadius: "var(--radius-lg)", padding: "var(--space-3) var(--space-4)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3-5)", flexWrap: "wrap" }}>
        <div className="field-with-icon" style={{ flex: 1, minWidth: "min(260px, 100%)" }}>
          <Search size={16} aria-hidden="true" />
          <label htmlFor="team-search" className="sr-only">Buscar colaborador</label>
          <input
            id="team-search"
            type="search"
            placeholder="Buscar por nome, e-mail ou cargo"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="field-input"
          />
        </div>
        <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)" }} aria-live="polite">
          Exibindo <strong>{filteredMembers.length}</strong> de {members.length} colaboradores
        </div>
      </div>

      {/* ── Tabela de colaboradores ── */}
      <div className="glass" style={{ borderRadius: "var(--radius-lg)", padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div className="empty-state" role="status">
            <div className="spinner" aria-hidden="true"></div>
            <span>Carregando colaboradores...</span>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="empty-state">
            <Users size={40} className="empty-state__icon" aria-hidden="true" />
            <h3 className="empty-state__title">Nenhum colaborador encontrado</h3>
            <p className="empty-state__desc">
              {searchQuery ? "Nenhum membro corresponde ao termo pesquisado." : "Adicione os operadores da sua empresa para que eles atendam clientes no Live Chat sem usar o login do proprietário."}
            </p>
          </div>
        ) : (
          <div className="table-container" style={{ borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Colaborador</th>
                  <th scope="col">Cargo</th>
                  <th scope="col" className="team-col-desc">O que pode fazer</th>
                  <th scope="col">Desde</th>
                  <th scope="col" style={{ textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((m) => {
                  const rInfo = ROLE_INFO[m.role] || ROLE_INFO.ATTENDANT;
                  const Icon = rInfo.icon;

                  return (
                    <tr key={m.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                          <div className="avatar avatar--role" style={roleStyle(rInfo.color)} aria-hidden="true">
                            {getInitials(m.name || m.email, "?")}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600 }}>{m.name}</div>
                            <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>{m.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="role-badge" style={roleStyle(rInfo.color)}>
                          <Icon size={12} aria-hidden="true" />
                          {rInfo.label}
                        </span>
                      </td>
                      <td className="team-col-desc" style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)", maxWidth: "280px" }}>
                        {rInfo.desc}
                      </td>
                      <td style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)", whiteSpace: "nowrap" }}>
                        {new Date(m.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {m.isOwner ? (
                          <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>Dono da conta</span>
                        ) : (
                          <div style={{ display: "inline-flex", gap: "var(--space-1-5)" }}>
                            <button
                              type="button"
                              onClick={() => openEditModal(m)}
                              className="icon-action"
                              aria-label={`Editar cargo ou senha de ${m.name}`}
                              title="Editar cargo ou senha"
                            >
                              <Edit2 size={15} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMember(m)}
                              className="icon-action icon-action--danger"
                              aria-label={`Revogar o acesso de ${m.name}`}
                              title="Revogar acesso"
                            >
                              <Trash2 size={15} aria-hidden="true" />
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

      {/* ── Modal: novo colaborador ── */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Novo colaborador"
        icon={<span className="icon-tile icon-tile--sm" style={tileStyle("var(--primary)")}><UserPlus size={18} aria-hidden="true" /></span>}
        onSubmit={handleCreateMember}
        footer={
          <>
            <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary">
              {isSubmitting ? "Adicionando..." : "Adicionar colaborador"}
            </button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="member-name" className="field-label">Nome completo</label>
          <div className="field-with-icon">
            <UserIcon size={15} aria-hidden="true" />
            <input id="member-name" type="text" required placeholder="Ex.: Amanda Ferreira" value={nameInput} onChange={(e) => setNameInput(e.target.value)} className="field-input" />
          </div>
        </div>

        <div className="field">
          <label htmlFor="member-email" className="field-label">E-mail de login</label>
          <div className="field-with-icon">
            <Mail size={15} aria-hidden="true" />
            <input id="member-email" type="email" required autoComplete="off" placeholder="amanda@empresa.com.br" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="field-input" />
          </div>
        </div>

        <div className="field">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-2)" }}>
            <label htmlFor="member-password" className="field-label">Senha inicial</label>
            <button type="button" onClick={generatePassword} className="btn btn-secondary btn-sm">
              <Sparkles size={12} aria-hidden="true" /> Gerar senha
            </button>
          </div>
          <div className="field-with-icon">
            <Lock size={15} aria-hidden="true" />
            <input
              id="member-password"
              type="text"
              required
              minLength={6}
              maxLength={128}
              autoComplete="new-password"
              placeholder="Mínimo 6 caracteres"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="field-input"
              aria-describedby="member-password-hint"
            />
          </div>
          <span id="member-password-hint" className="field-hint">O colaborador entra na plataforma com este e-mail e esta senha.</span>
        </div>

        <div className="field">
          <span id="member-role-label" className="field-label">Cargo</span>
          <RolePicker value={roleInput} onChange={setRoleInput} labelledBy="member-role-label" />
        </div>
      </Modal>

      {/* ── Modal: editar colaborador ── */}
      <Modal
        open={showEditModal && !!selectedMember}
        onClose={() => setShowEditModal(false)}
        title={selectedMember ? `Editar ${selectedMember.name}` : "Editar colaborador"}
        icon={<span className="icon-tile icon-tile--sm" style={tileStyle("var(--role-manager)")}><Edit2 size={18} aria-hidden="true" /></span>}
        onSubmit={handleUpdateMember}
        footer={
          <>
            <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-secondary">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary">
              {isSubmitting ? "Salvando..." : "Salvar alterações"}
            </button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="edit-member-name" className="field-label">Nome</label>
          <input id="edit-member-name" type="text" value={editNameInput} onChange={(e) => setEditNameInput(e.target.value)} className="field-input" />
        </div>

        <div className="field">
          <span id="edit-member-role-label" className="field-label">Cargo</span>
          <RolePicker value={editRoleInput} onChange={setEditRoleInput} labelledBy="edit-member-role-label" />
        </div>

        <div className="field">
          <label htmlFor="edit-member-password" className="field-label">Nova senha (opcional)</label>
          <div className="field-with-icon">
            <KeyRound size={15} aria-hidden="true" />
            <input
              id="edit-member-password"
              type="text"
              minLength={6}
              maxLength={128}
              autoComplete="new-password"
              placeholder="Deixe em branco para manter a atual"
              value={editPasswordInput}
              onChange={(e) => setEditPasswordInput(e.target.value)}
              className="field-input"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
