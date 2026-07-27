import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL, useAuth } from "../contexts/AuthContext";
import { useAlert } from "../contexts/AlertContext";
import { formatPlanTier } from "../utils/formatters";
import { Check, ArrowRight } from "lucide-react";

export default function BillingPage() {
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const [planData, setPlanData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPlans, setShowPlans] = useState(false);

  const fetchBillingInfo = async () => {
    setLoading(true);
    try {
      const [planRes, historyRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/billing/my-plan`),
        axios.get(`${API_BASE_URL}/billing/history`),
      ]);
      setPlanData(planRes.data);
      setHistory(historyRes.data);
    } catch (err: any) {
      console.error("Erro ao carregar dados de faturamento:", err);
      showAlert("Erro ao carregar dados da sua assinatura.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingInfo();
  }, []);

  if (loading) {
    return (
      <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div className="skeleton" style={{ width: "200px", height: "30px", borderRadius: "8px" }}></div>
        <div className="skeleton" style={{ width: "100%", height: "200px", borderRadius: "16px" }}></div>
      </div>
    );
  }

  const isExpired = planData?.subscriptionExpiresAt && new Date(planData.subscriptionExpiresAt) < new Date();
  const isPastDue = planData?.subscriptionStatus === "PAST_DUE" || isExpired;
  const isPaid = planData?.planTier === "paid" || user?.planTier === "paid";
  const isSuperUser = user?.role === "SUPERUSER";

  const accountsPercent = Math.min(100, Math.round(((planData?.connectedAccountsCount || 0) / (planData?.maxAccounts || 1)) * 100));
  const messagesPercent = Math.min(100, Math.round(((planData?.monthlyMessagesSent || 0) / (planData?.maxMonthlyMessages || 5000)) * 100));

  const PAYMENT_WA = `https://wa.me/5583920017106?text=${encodeURIComponent("Olá! Quero ativar/renovar meu plano no Send Inteligentte. Meu e-mail é: " + (user?.email || ""))}`;

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
      <div>
        <h1 style={{ fontSize: "2rem", fontWeight: "700", marginBottom: "8px" }}>Assinatura & Plano</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Acompanhe os detalhes da sua assinatura, consumo de mensagens, linhas conectadas e histórico de faturas.
        </p>
      </div>

      {/* BANNER DE AVISO DE INADIMPLÊNCIA/VENCIMENTO */}
      {isPastDue && (
        <div
          className="glass"
          style={{
            padding: "20px 24px",
            borderRadius: "var(--radius-lg)",
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <h4 style={{ fontSize: "1.1rem", fontWeight: "700", color: "#f87171", marginBottom: "4px" }}>
              ⚠️ Assinatura Vencida / Pendente de Renovação
            </h4>
            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
              Sua assinatura expirou. Para manter o envio automático de mensagens e a conexão das suas linhas Meta ativas, faça a renovação.
            </p>
          </div>
          <a
            href={PAYMENT_WA}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
            style={{ background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)", boxShadow: "0 4px 14px 0 rgba(239,68,68,0.3)" }}
          >
            ⚡ Renovar Agora via WhatsApp
          </a>
        </div>
      )}

      {/* CARD DO PLANO ATUAL */}
      <div
        className="glass"
        style={{
          padding: "30px",
          borderRadius: "var(--radius-xl)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "30px",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span
              className="tag-chip"
              style={{
                fontSize: "0.85rem",
                padding: "4px 12px",
                background: "rgba(0, 194, 107, 0.15)",
                color: "var(--primary)",
                border: "1px solid rgba(0, 194, 107, 0.3)",
                fontWeight: "700",
                textTransform: "uppercase",
              }}
            >
              {formatPlanTier(planData?.planTier)}
            </span>

            {isPastDue ? (
              <span className="tag-chip" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#f87171" }}>
                🔴 Vencido
              </span>
            ) : (
              <span className="tag-chip" style={{ background: "rgba(0, 194, 107, 0.2)", color: "#00c26b" }}>
                🟢 Assinatura Ativa
              </span>
            )}
          </div>

          <div style={{ fontSize: "2.2rem", fontWeight: "800", color: "var(--text-primary)" }}>
            R$ {(planData?.monthlyPrice || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}{" "}
            <span style={{ fontSize: "1rem", color: "var(--text-muted)", fontWeight: "400" }}>/mês</span>
          </div>

          <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
            Próxima renovação:{" "}
            <strong>
              {planData?.subscriptionExpiresAt
                ? new Date(planData.subscriptionExpiresAt).toLocaleDateString("pt-BR")
                : "Acesso Vitalício / Não Expira"}
            </strong>
          </div>
        </div>

        {/* BARRAS DE CONSUMO DE LIMITES */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem", marginBottom: "6px" }}>
              <span>📱 Linhas Meta Conectadas</span>
              <strong>
                {planData?.connectedAccountsCount || 0} / {planData?.maxAccounts || 1}
              </strong>
            </div>
            <div style={{ width: "100%", height: "8px", background: "rgba(255,255,255,0.08)", borderRadius: "4px", overflow: "hidden" }}>
              <div
                style={{
                  width: `${accountsPercent}%`,
                  height: "100%",
                  background: accountsPercent >= 100 ? "#ef4444" : "var(--primary)",
                  transition: "width 0.3s ease",
                }}
              ></div>
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem", marginBottom: "6px" }}>
              <span>💬 Mensagens Disparadas este Mês</span>
              <strong>
                {planData?.monthlyMessagesSent || 0} / {planData?.maxMonthlyMessages || 5000}
              </strong>
            </div>
            <div style={{ width: "100%", height: "8px", background: "rgba(255,255,255,0.08)", borderRadius: "4px", overflow: "hidden" }}>
              <div
                style={{
                  width: `${messagesPercent}%`,
                  height: "100%",
                  background: messagesPercent >= 100 ? "#ef4444" : "#3b82f6",
                  transition: "width 0.3s ease",
                }}
              ></div>
            </div>
          </div>
        </div>

        {/* CTA DE UPGRADE */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-start" }}>
          <h4 style={{ fontSize: "1rem", fontWeight: "600" }}>Precisa de mais conexões ou disparos?</h4>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Conheça nossos planos empresariais avançados com disparos ilimitados e suporte dedicado.
          </p>
          <div style={{ display: "flex", gap: "10px", width: "100%", flexWrap: "wrap" }}>
            <button
              onClick={() => setShowPlans(!showPlans)}
              className="btn btn-secondary"
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "10px 16px" }}
            >
              {showPlans ? "▲ Ocultar Planos" : "▼ Ver Comparativo de Planos"}
            </button>
            <a
              href={PAYMENT_WA}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
              style={{ flex: 1, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "10px 16px", textDecoration: "none" }}
            >
              🚀 Upgrade via WhatsApp
            </a>
          </div>
        </div>
      </div>

      {/* PLAN CARDS COMPARISON (VISÍVEL QUANDO SOLICITADO OU SE NÃO FOR PAGO) */}
      {(showPlans || !isPaid) && (
        <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: "600" }}>Opções de Planos Disponíveis</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px" }}>
            {/* Trial Plan Card */}
            <div className="glass" style={{
              padding: "32px",
              borderRadius: "var(--radius-xl)",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              border: !isPaid && !isSuperUser ? "1.5px solid rgba(245, 158, 11, 0.4)" : "1px solid rgba(255,255,255,0.08)"
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Iniciante</span>
                  {!isPaid && !isSuperUser && (
                    <span style={{ fontSize: "0.75rem", background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", padding: "2px 8px", borderRadius: "4px", fontWeight: 600 }}>Plano Atual</span>
                  )}
                </div>
                <h3 style={{ fontSize: "1.5rem", fontWeight: "700" }}>Teste Gratuito</h3>
                <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginTop: "12px" }}>
                  <span style={{ fontSize: "2.2rem", fontWeight: "800" }}>R$ 0</span>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>/ 3 dias</span>
                </div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", marginTop: "8px" }}>
                  Período de avaliação para explorar todas as funcionalidades do Send Inteligentte.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.88rem" }}>
                  <Check size={16} color="#00c26b" /> 3 dias de acesso total aos recursos
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.88rem" }}>
                  <Check size={16} color="#00c26b" /> Conexão de conta Meta API Oficial
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.88rem" }}>
                  <Check size={16} color="#00c26b" /> Criação e sincronização de Templates
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.88rem" }}>
                  <Check size={16} color="#00c26b" /> Importação de listas de contatos
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.88rem" }}>
                  <Check size={16} color="#00c26b" /> Disparos em fila com outbox pattern
                </div>
              </div>
            </div>

            {/* Pro Plan Card */}
            <div className="glass" style={{
              padding: "32px",
              borderRadius: "var(--radius-xl)",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              position: "relative",
              background: "linear-gradient(180deg, rgba(0,194,107,0.08) 0%, rgba(5,7,15,0.4) 100%)",
              border: isPaid ? "2px solid var(--primary)" : "1px solid rgba(0, 194, 107, 0.4)",
              boxShadow: "0 10px 30px -10px rgba(0, 194, 107, 0.2)"
            }}>
              <div style={{
                position: "absolute",
                top: "-12px",
                right: "24px",
                background: "linear-gradient(135deg, #00c26b 0%, #009652 100%)",
                color: "#fff",
                padding: "4px 12px",
                borderRadius: "20px",
                fontSize: "0.75rem",
                fontWeight: "700",
                letterSpacing: "0.05em",
                boxShadow: "0 4px 12px rgba(0,194,107,0.3)"
              }}>
                RECOMENDADO
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Empresarial</span>
                  {isPaid && (
                    <span style={{ fontSize: "0.75rem", background: "rgba(0, 194, 107, 0.2)", color: "var(--primary)", padding: "2px 8px", borderRadius: "4px", fontWeight: 600 }}>Seu Plano Ativo</span>
                  )}
                </div>
                <h3 style={{ fontSize: "1.5rem", fontWeight: "700" }}>Send Inteligentte Pro</h3>
                <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginTop: "12px" }}>
                  <span style={{ fontSize: "2.2rem", fontWeight: "800", color: "var(--primary)" }}>Plano Pro</span>
                </div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", marginTop: "8px" }}>
                  Acesso completo sem restrições para automatizar seu atendimento e vendas pelo WhatsApp.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.88rem" }}>
                  <Check size={16} color="#00c26b" /> <strong>Tudo do plano de teste</strong> + envios contínuos
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.88rem" }}>
                  <Check size={16} color="#00c26b" /> Multi-contas de WhatsApp Business
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.88rem" }}>
                  <Check size={16} color="#00c26b" /> Agendamento e campanhas recorrentes
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.88rem" }}>
                  <Check size={16} color="#00c26b" /> Rastreamento avançado de cliques em links
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.88rem" }}>
                  <Check size={16} color="#00c26b" /> Chaves de API Pública para n8n, Make e Zapier
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.88rem" }}>
                  <Check size={16} color="#00c26b" /> Suporte técnico dedicado via WhatsApp
                </div>
              </div>

              <a
                href={PAYMENT_WA}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{
                  width: "100%",
                  textAlign: "center",
                  padding: "14px",
                  fontSize: "0.95rem",
                  marginTop: "auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  textDecoration: "none"
                }}
              >
                {isPaid ? "Falar sobre Upgrade" : "Ativar Plano Pro Agora"} <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* HISTÓRICO DE PAGAMENTOS */}
      <div className="glass" style={{ padding: "30px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "20px" }}>
        <h3 style={{ fontSize: "1.2rem", fontWeight: "600" }}>Histórico de Faturas & Pagamentos</h3>

        {history.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>Nenhum histórico de pagamento registrado até o momento.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}>
                  <th style={{ padding: "12px 8px" }}>Data do Pagamento</th>
                  <th style={{ padding: "12px 8px" }}>Valor</th>
                  <th style={{ padding: "12px 8px" }}>Forma de Pagamento</th>
                  <th style={{ padding: "12px 8px" }}>Referência</th>
                  <th style={{ padding: "12px 8px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "12px 8px" }}>{new Date(h.createdAt).toLocaleDateString("pt-BR")}</td>
                    <td style={{ padding: "12px 8px", fontWeight: "700", color: "#00c26b" }}>
                      R$ {h.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: "12px 8px" }}>{h.paymentMethod}</td>
                    <td style={{ padding: "12px 8px", color: "var(--text-secondary)" }}>{h.referencePeriod || "-"}</td>
                    <td style={{ padding: "12px 8px" }}>
                      <span className="tag-chip" style={{ background: "rgba(0,194,107,0.15)", color: "#00c26b" }}>
                        PAGO
                      </span>
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
