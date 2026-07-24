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
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Modal states
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<any | null>(null);
  const [selectedUserForPayment, setSelectedUserForPayment] = useState<any | null>(null);
  const [selectedUserForHistory, setSelectedUserForHistory] = useState<any | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Form state - Subscription edit
  const [subForm, setSubForm] = useState({
    planTier: "free",
    subscriptionStatus: "ACTIVE",
    subscriptionExpiresAt: "",
    customPriceMonthly: "",
    maxAccounts: 1,
    paymentMethod: "PIX",
    notes: "",
  });

  // Form state - Record Payment
  const [payForm, setPayForm] = useState({
    amount: "",
    paymentMethod: "PIX",
    referencePeriod: new Date().toISOString().slice(0, 7),
    extendDays: 30,
    notes: "Pagamento de mensalidade recebido",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const usersRes = await axios.get(`${API_BASE_URL}/admin/users`).catch((err) => {
        console.warn("[Admin] Falha ao obter /admin/users:", err.message);
        return { data: [] };
      });
      
      const metricsRes = await axios.get(`${API_BASE_URL}/admin/metrics/financial`).catch((err) => {
        console.warn("[Admin] Falha ao obter /admin/metrics/financial:", err.message);
        return { data: null };
      });

      setAdminUsers(usersRes.data || []);
      setMetrics(metricsRes.data || null);
    } catch (err: any) {
      console.error("Erro ao buscar dados do admin:", err);
      showAlert("Erro ao carregar dados do painel. Clique em Atualizar Dados para tentar novamente.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
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

  const openEditModal = (u: any) => {
    setSelectedUserForEdit(u);
    setSubForm({
      planTier: u.planTier || "free",
      subscriptionStatus: u.subscriptionStatus || "ACTIVE",
      subscriptionExpiresAt: u.subscriptionExpiresAt ? new Date(u.subscriptionExpiresAt).toISOString().split("T")[0] : "",
      customPriceMonthly: u.customPriceMonthly !== null && u.customPriceMonthly !== undefined ? String(u.customPriceMonthly) : "",
      maxAccounts: u.maxAccounts || 1,
      paymentMethod: u.paymentMethod || "PIX",
      notes: u.notes || "",
    });
  };

  const handleSaveSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForEdit) return;
    try {
      const payload: any = {
        planTier: subForm.planTier,
        subscriptionStatus: subForm.subscriptionStatus,
        subscriptionExpiresAt: subForm.subscriptionExpiresAt ? subForm.subscriptionExpiresAt : null,
        customPriceMonthly: subForm.customPriceMonthly !== "" ? parseFloat(subForm.customPriceMonthly) : 0,
        maxAccounts: parseInt(String(subForm.maxAccounts), 10) || 1,
        paymentMethod: subForm.paymentMethod,
        notes: subForm.notes,
      };

      await axios.patch(`${API_BASE_URL}/admin/users/${selectedUserForEdit.id}/subscription`, payload);
      showAlert("✅ Status do perfil e limites atualizados com sucesso!", "success");
      setSelectedUserForEdit(null);
      fetchData();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || "Erro ao atualizar assinatura.";
      showAlert(`Erro ao salvar: ${errorMsg}`, "error");
    }
  };

  const openPaymentModal = (u: any) => {
    setSelectedUserForPayment(u);
    setPayForm({
      amount: String(u.monthlyPrice || 197),
      paymentMethod: u.paymentMethod || "PIX",
      referencePeriod: new Date().toISOString().slice(0, 7),
      extendDays: 30,
      notes: `Pagamento mensal referente a ${new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`,
    });
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPayment) return;
    try {
      await axios.post(`${API_BASE_URL}/admin/users/${selectedUserForPayment.id}/payments`, payForm);
      showAlert("✅ Pagamento registrado e acesso liberado por +30 dias!", "success");
      setSelectedUserForPayment(null);
      fetchData();
    } catch (err: any) {
      showAlert(err.response?.data?.error || "Erro ao registrar pagamento.", "error");
    }
  };

  // AÇÃO RÁPIDA DE 1-CLIQUE: Renovação direta por 30 dias
  const handleQuickExtend30Days = async (u: any) => {
    if (!window.confirm(`Confirmar renovação direta de +30 dias para ${u.name || u.email}?`)) return;
    try {
      await axios.post(`${API_BASE_URL}/admin/users/${u.id}/payments`, {
        amount: u.monthlyPrice || 197,
        paymentMethod: u.paymentMethod || "PIX",
        referencePeriod: new Date().toISOString().slice(0, 7),
        extendDays: 30,
        notes: "Renovação rápida de 1-clique feita pelo painel administrativo"
      });
      showAlert(`✅ Assinatura de ${u.name || u.email} renovada por +30 dias!`, "success");
      fetchData();
    } catch (err: any) {
      showAlert(err.response?.data?.error || "Erro ao renovar assinatura.", "error");
    }
  };

  const openHistoryModal = async (u: any) => {
    setSelectedUserForHistory(u);
    setLoadingHistory(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/admin/users/${u.id}/payments`);
      setPaymentHistory(res.data);
    } catch (err: any) {
      showAlert("Erro ao buscar histórico de pagamentos.", "error");
    } finally {
      setLoadingHistory(false);
    }
  };

  const filteredUsers = adminUsers.filter((u) => {
    const matchesSearch =
      (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === "ALL") return matchesSearch;
    if (statusFilter === "EXPIRING_SOON") {
      if (!u.subscriptionExpiresAt) return false;
      const exp = new Date(u.subscriptionExpiresAt).getTime();
      const now = new Date().getTime();
      const diffDays = (exp - now) / (1000 * 3600 * 24);
      return matchesSearch && diffDays >= 0 && diffDays <= 7;
    }
    return matchesSearch && u.subscriptionStatus === statusFilter;
  });

  const getStatusBadge = (status: string, expiresAt: string | null) => {
    const isExpired = expiresAt && new Date(expiresAt) < new Date();
    if (isExpired && (status === "ACTIVE" || status === "TRIAL")) {
      return (
        <span className="tag-chip" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#f87171", border: "1px solid rgba(239,68,68,0.4)", fontWeight: "700" }}>
          ⚠️ Vencido
        </span>
      );
    }

    switch (status) {
      case "ACTIVE":
        return (
          <span className="tag-chip" style={{ background: "rgba(0, 194, 107, 0.2)", color: "#00c26b", border: "1px solid rgba(0,194,107,0.4)", fontWeight: "700" }}>
            🟢 Liberado (Ativo)
          </span>
        );
      case "TRIAL":
        return (
          <span className="tag-chip" style={{ background: "rgba(59, 130, 246, 0.2)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.4)", fontWeight: "700" }}>
            🔵 Em Teste Grátis
          </span>
        );
      case "PAST_DUE":
        return (
          <span className="tag-chip" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#f87171", border: "1px solid rgba(239,68,68,0.4)", fontWeight: "700" }}>
            🔴 Vencido / Bloqueado
          </span>
        );
      case "SUSPENDED":
      case "CANCELED":
        return (
          <span className="tag-chip" style={{ background: "rgba(156, 163, 175, 0.2)", color: "#9ca3af", border: "1px solid rgba(156,163,175,0.4)", fontWeight: "700" }}>
            ⚪ Suspenso
          </span>
        );
      default:
        return <span className="tag-chip">{status}</span>;
    }
  };

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* CABEÇALHO AMIGÁVEL */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: "700", marginBottom: "4px" }}>
             Painel de Controle de Clientes & Pagamentos
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
            Gerencie mensalidades, controle validades de acesso e dê baixa em pagamentos dos clientes.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchData}
          className="btn btn-secondary"
          style={{ padding: "10px 18px", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "8px" }}
        >
          🔄 Atualizar Dados
        </button>
      </div>

      {/* CARDS INTERATIVOS DE FILTRO RÁPIDO */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "16px" }}>
        <div
          onClick={() => setStatusFilter("ALL")}
          className="glass"
          style={{
            padding: "18px",
            borderRadius: "var(--radius-lg)",
            borderLeft: "4px solid #94a3b8",
            cursor: "pointer",
            transition: "transform 0.2s ease",
            boxShadow: statusFilter === "ALL" ? "0 0 0 2px #94a3b8" : "none",
          }}
          title="Clique para ver todos os clientes"
        >
          <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "4px" }}>Faturamento Mensal Estimado</div>
          <div style={{ fontSize: "1.6rem", fontWeight: "700", color: "#00c26b" }}>
            R$ {metrics ? metrics.totalMRR.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "0,00"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
            👥 Total: <strong>{metrics?.totalUsers || 0} clientes</strong>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter("ACTIVE")}
          className="glass"
          style={{
            padding: "18px",
            borderRadius: "var(--radius-lg)",
            borderLeft: "4px solid #00c26b",
            cursor: "pointer",
            transition: "transform 0.2s ease",
            boxShadow: statusFilter === "ACTIVE" ? "0 0 0 2px #00c26b" : "none",
          }}
          title="Clique para filtrar clientes com mensalidade em dia"
        >
          <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "4px" }}>🟢 Clientes Em Dia</div>
          <div style={{ fontSize: "1.6rem", fontWeight: "700", color: "#00c26b" }}>
            {metrics?.activeClients || 0}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>Pagamentos e acessos ativos</div>
        </div>

        <div
          onClick={() => setStatusFilter("PAST_DUE")}
          className="glass"
          style={{
            padding: "18px",
            borderRadius: "var(--radius-lg)",
            borderLeft: "4px solid #ef4444",
            cursor: "pointer",
            transition: "transform 0.2s ease",
            boxShadow: statusFilter === "PAST_DUE" ? "0 0 0 2px #ef4444" : "none",
          }}
          title="Clique para filtrar clientes que precisam renovar"
        >
          <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "4px" }}>🔴 Vencidos / Cobrar</div>
          <div style={{ fontSize: "1.6rem", fontWeight: "700", color: "#f87171" }}>
            {metrics?.pastDueClients || 0}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>Clique para ver quem precisa pagar</div>
        </div>

        <div
          onClick={() => setStatusFilter("TRIAL")}
          className="glass"
          style={{
            padding: "18px",
            borderRadius: "var(--radius-lg)",
            borderLeft: "4px solid #3b82f6",
            cursor: "pointer",
            transition: "transform 0.2s ease",
            boxShadow: statusFilter === "TRIAL" ? "0 0 0 2px #3b82f6" : "none",
          }}
          title="Clique para filtrar clientes em teste grátis"
        >
          <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "4px" }}>🔵 Em Teste Grátis</div>
          <div style={{ fontSize: "1.6rem", fontWeight: "700", color: "#60a5fa" }}>
            {metrics?.trialClients || 0}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>Testando a plataforma</div>
        </div>
      </div>

      {/* BARRA DE PESQUISA E FILTROS RÁPIDOS */}
      <div className="glass" style={{ padding: "24px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h3 style={{ fontSize: "1.15rem", fontWeight: "600" }}>
              Lista de Clientes ({filteredUsers.length})
            </h3>
            <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
              Filtro selecionado: <strong>{statusFilter === "ALL" ? "Todos os Clientes" : statusFilter}</strong>
            </span>
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="text"
              placeholder="🔍 Buscar cliente por nome ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="field-input"
              style={{ width: "280px", padding: "9px 14px", fontSize: "0.88rem" }}
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="field-input"
              style={{ width: "190px", padding: "9px 14px", fontSize: "0.88rem", fontWeight: "600" }}
            >
              <option value="ALL">📋 Mostrar Todos</option>
              <option value="ACTIVE">🟢 Apenas Ativos (Em Dia)</option>
              <option value="PAST_DUE">🔴 Apenas Vencidos</option>
              <option value="EXPIRING_SOON">⏰ Vencendo nos Próximos 7 Dias</option>
              <option value="TRIAL">🔵 Em Teste Grátis</option>
              <option value="SUSPENDED">⚪ Suspensos / Inativos</option>
            </select>
          </div>
        </div>

        {/* TABELA DE CLIENTES INTUITIVA */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className="skeleton" style={{ width: "100%", height: "50px", borderRadius: "8px" }}></div>
            <div className="skeleton" style={{ width: "100%", height: "50px", borderRadius: "8px" }}></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>
            <p style={{ fontSize: "1.05rem" }}>Nenhum cliente encontrado com este filtro.</p>
            <button
              type="button"
              onClick={() => { setStatusFilter("ALL"); setSearchTerm(""); }}
              className="btn btn-secondary"
              style={{ marginTop: "12px", padding: "8px 16px" }}
            >
              Limpar Filtros
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}>
                  <th style={{ padding: "12px 10px" }}>Nome do Cliente / E-mail</th>
                  <th style={{ padding: "12px 10px" }}>Plano</th>
                  <th style={{ padding: "12px 10px" }}>Situação Atual</th>
                  <th style={{ padding: "12px 10px" }}>Validade da Assinatura</th>
                  <th style={{ padding: "12px 10px" }}>Mensalidade (R$)</th>
                  <th style={{ padding: "12px 10px" }}>Conexões Meta</th>
                  <th style={{ padding: "12px 10px", textAlign: "right" }}>Ações Rápidas da Equipe</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "12px 10px" }}>
                      <div style={{ fontWeight: "700", color: "var(--text-primary)" }}>{u.name || "Cliente Sem Nome"}</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{u.email}</div>
                    </td>

                    <td style={{ padding: "12px 10px" }}>
                      <span className="tag-chip" style={{ background: "rgba(255,255,255,0.08)", fontWeight: "700", textTransform: "uppercase" }}>
                        {u.planTier || "FREE"}
                      </span>
                    </td>

                    <td style={{ padding: "12px 10px" }}>
                      {getStatusBadge(u.subscriptionStatus, u.subscriptionExpiresAt)}
                    </td>

                    <td style={{ padding: "12px 10px", color: "var(--text-secondary)" }}>
                      {u.subscriptionExpiresAt
                        ? new Date(u.subscriptionExpiresAt).toLocaleDateString("pt-BR")
                        : "Vitalício / Indefinido"}
                    </td>

                    <td style={{ padding: "12px 10px", fontWeight: "700", color: "#00c26b" }}>
                      R$ {(u.monthlyPrice || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>

                    <td style={{ padding: "12px 10px" }}>
                      📱 {u.accountsCount} / {u.maxAccounts || 1}
                    </td>

                    <td style={{ padding: "12px 10px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                        {/* AÇÃO 1: RENOVAÇÃO DIRETA DE 1-CLIQUE */}
                        <button
                          type="button"
                          onClick={() => handleQuickExtend30Days(u)}
                          className="btn btn-primary"
                          style={{
                            padding: "6px 12px",
                            fontSize: "0.8rem",
                            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                            boxShadow: "0 2px 8px rgba(16, 185, 129, 0.25)"
                          }}
                          title="Estender acesso por +30 dias com um único clique"
                        >
                          ⚡ +30 Dias Rápidos
                        </button>

                        {/* AÇÃO 2: REGISTRAR PAGAMENTO DETALHADO */}
                        <button
                          type="button"
                          onClick={() => openPaymentModal(u)}
                          className="btn btn-secondary"
                          style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                          title="Registrar forma de pagamento e lançar recibo"
                        >
                          💳 Baixar Pagamento
                        </button>

                        {/* AÇÃO 3: VER HISTÓRICO DE RECIBOS */}
                        <button
                          type="button"
                          onClick={() => openHistoryModal(u)}
                          className="btn btn-secondary"
                          style={{ padding: "6px 10px", fontSize: "0.8rem" }}
                          title="Ver histórico de pagamentos anteriores do cliente"
                        >
                          📋 Recibos
                        </button>

                        {/* AÇÃO 4: AJUSTAR PLANO & STATUS */}
                        <button
                          type="button"
                          onClick={() => openEditModal(u)}
                          className="btn btn-secondary"
                          style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                          title="Alterar plano, status de acesso e mensalidade"
                        >
                          ⚙️ Alterar Status
                        </button>

                        {/* AÇÃO 5: IMPERSONATE SUPORTE */}
                        {u.id !== user?.id && (
                          <button
                            type="button"
                            onClick={() => handleLaunchImpersonate(u.id)}
                            className="btn btn-primary"
                            style={{
                              padding: "6px 12px",
                              fontSize: "0.8rem",
                              background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                            }}
                            title="Acessar a conta do cliente para ajudar no suporte"
                          >
                            🚪 Entrar como Suporte
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL SIMPLIFICADO: AJUSTAR PLANO & STATUS (100% OPACO, CORRIGIDO) */}
      {selectedUserForEdit && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: "560px", background: "#0d111c", border: "1px solid rgba(255, 255, 255, 0.18)", boxShadow: "0 25px 60px rgba(0,0,0,0.95)", borderRadius: "16px" }}>
            <div className="modal-header">
              <h3>⚙️ Configuração de Acesso — {selectedUserForEdit.name || selectedUserForEdit.email}</h3>
              <button type="button" onClick={() => setSelectedUserForEdit(null)} className="btn btn-secondary" style={{ padding: "4px 8px" }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSubscription} className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div style={{ background: "rgba(255,255,255,0.04)", padding: "12px 16px", borderRadius: "8px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                💡 <strong>Dica para a equipe:</strong> Altere o status de acesso (Liberado/Vencido), o valor da mensalidade ou a data de vencimento.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className="field">
                  <label className="field-label">1. Categoria do Plano</label>
                  <select
                    className="field-input"
                    value={subForm.planTier}
                    onChange={(e) => setSubForm({ ...subForm, planTier: e.target.value })}
                  >
                    <option value="free">Free (Gratuito)</option>
                    <option value="starter">Starter (Básico)</option>
                    <option value="pro">Pro (Profissional)</option>
                    <option value="enterprise">Enterprise (Personalizado)</option>
                  </select>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Selecione o plano do cliente</span>
                </div>

                <div className="field">
                  <label className="field-label">2. Status de Acesso</label>
                  <select
                    className="field-input"
                    value={subForm.subscriptionStatus}
                    onChange={(e) => setSubForm({ ...subForm, subscriptionStatus: e.target.value })}
                  >
                    <option value="ACTIVE">🟢 Liberado / Em Dia (Ativo)</option>
                    <option value="TRIAL">🔵 Em Teste Grátis</option>
                    <option value="PAST_DUE">🔴 Vencido / Bloqueado</option>
                    <option value="SUSPENDED">⚪ Suspenso / Cancelado</option>
                  </select>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Controla o acesso à plataforma</span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className="field">
                  <label className="field-label">3. Data de Validade do Acesso</label>
                  <input
                    type="date"
                    className="field-input"
                    value={subForm.subscriptionExpiresAt}
                    onChange={(e) => setSubForm({ ...subForm, subscriptionExpiresAt: e.target.value })}
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Até quando o cliente pode usar</span>
                </div>

                <div className="field">
                  <label className="field-label">4. Mensalidade em R$</label>
                  <input
                    type="number"
                    step="0.01"
                    className="field-input"
                    placeholder="Ex: 197.00"
                    value={subForm.customPriceMonthly}
                    onChange={(e) => setSubForm({ ...subForm, customPriceMonthly: e.target.value })}
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Valor cobrado por mês</span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className="field">
                  <label className="field-label">5. Limite de Linhas WhatsApp</label>
                  <input
                    type="number"
                    min="1"
                    className="field-input"
                    value={subForm.maxAccounts}
                    onChange={(e) => setSubForm({ ...subForm, maxAccounts: parseInt(e.target.value, 10) || 1 })}
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Quantas contas Meta pode conectar</span>
                </div>

                <div className="field">
                  <label className="field-label">6. Forma de Pagamento</label>
                  <select
                    className="field-input"
                    value={subForm.paymentMethod}
                    onChange={(e) => setSubForm({ ...subForm, paymentMethod: e.target.value })}
                  >
                    <option value="PIX">PIX</option>
                    <option value="CREDIT_CARD">Cartão de Crédito</option>
                    <option value="BOLETO">Boleto Bancário</option>
                    <option value="MANUAL">Acordo / Transferência</option>
                  </select>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Forma de pagamento padrão</span>
                </div>
              </div>

              <div className="field">
                <label className="field-label">Anotações da Equipe (Uso Interno)</label>
                <textarea
                  className="field-input"
                  rows={2}
                  placeholder="Ex: Cliente fechou plano anual no PIX."
                  value={subForm.notes}
                  onChange={(e) => setSubForm({ ...subForm, notes: e.target.value })}
                ></textarea>
              </div>

              <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" onClick={() => setSelectedUserForEdit(null)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  💾 Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: BAIXA EM PAGAMENTO (REGISTRO RÁPIDO) */}
      {selectedUserForPayment && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: "500px", background: "#0d111c", border: "1px solid rgba(255, 255, 255, 0.18)", boxShadow: "0 25px 60px rgba(0,0,0,0.95)", borderRadius: "16px" }}>
            <div className="modal-header">
              <h3>💳 Baixa em Pagamento de Mensalidade</h3>
              <button type="button" onClick={() => setSelectedUserForPayment(null)} className="btn btn-secondary" style={{ padding: "4px 8px" }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ background: "rgba(0, 194, 107, 0.1)", border: "1px solid rgba(0, 194, 107, 0.3)", padding: "12px", borderRadius: "8px", color: "#00c26b", fontSize: "0.9rem" }}>
                Ao confirmar, o acesso do cliente <strong>{selectedUserForPayment.name || selectedUserForPayment.email}</strong> será liberado por +30 dias automaticamente!
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div className="field">
                  <label className="field-label">Valor Pago (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="field-input"
                    value={payForm.amount}
                    onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                  />
                </div>

                <div className="field">
                  <label className="field-label">Forma de Pagamento</label>
                  <select
                    className="field-input"
                    value={payForm.paymentMethod}
                    onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                  >
                    <option value="PIX">PIX</option>
                    <option value="CREDIT_CARD">Cartão de Crédito</option>
                    <option value="BOLETO">Boleto Bancário</option>
                    <option value="MANUAL">Manual / Outros</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div className="field">
                  <label className="field-label">Renovar por (Dias)</label>
                  <input
                    type="number"
                    className="field-input"
                    value={payForm.extendDays}
                    onChange={(e) => setPayForm({ ...payForm, extendDays: parseInt(e.target.value, 10) || 30 })}
                  />
                </div>

                <div className="field">
                  <label className="field-label">Mês Referência</label>
                  <input
                    type="text"
                    className="field-input"
                    value={payForm.referencePeriod}
                    onChange={(e) => setPayForm({ ...payForm, referencePeriod: e.target.value })}
                  />
                </div>
              </div>

              <div className="field">
                <label className="field-label">Observação (Opcional)</label>
                <input
                  type="text"
                  className="field-input"
                  value={payForm.notes}
                  onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                />
              </div>

              <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" onClick={() => setSelectedUserForPayment(null)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}>
                  ✅ Confirmar Pagamento & Liberar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: HISTÓRICO DE RECIBOS DO CLIENTE */}
      {selectedUserForHistory && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: "600px", background: "#0d111c", border: "1px solid rgba(255, 255, 255, 0.18)", boxShadow: "0 25px 60px rgba(0,0,0,0.95)", borderRadius: "16px" }}>
            <div className="modal-header">
              <h3>📋 Recibos de Pagamento — {selectedUserForHistory.name || selectedUserForHistory.email}</h3>
              <button type="button" onClick={() => setSelectedUserForHistory(null)} className="btn btn-secondary" style={{ padding: "4px 8px" }}>
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {loadingHistory ? (
                <p>Carregando histórico...</p>
              ) : paymentHistory.length === 0 ? (
                <p style={{ color: "var(--text-muted)" }}>Nenhum pagamento registrado anteriormente.</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}>
                      <th style={{ padding: "8px" }}>Data</th>
                      <th style={{ padding: "8px" }}>Valor Pago</th>
                      <th style={{ padding: "8px" }}>Forma</th>
                      <th style={{ padding: "8px" }}>Referência</th>
                      <th style={{ padding: "8px" }}>Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentHistory.map((p) => (
                      <tr key={p.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "8px" }}>{new Date(p.createdAt).toLocaleDateString("pt-BR")}</td>
                        <td style={{ padding: "8px", fontWeight: "700", color: "#00c26b" }}>
                          R$ {p.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: "8px" }}>{p.paymentMethod}</td>
                        <td style={{ padding: "8px" }}>{p.referencePeriod || "-"}</td>
                        <td style={{ padding: "8px", color: "var(--text-secondary)" }}>{p.notes || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
