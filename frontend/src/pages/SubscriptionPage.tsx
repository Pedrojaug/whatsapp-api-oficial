import { useAuth } from "../contexts/AuthContext";
import { useAccount } from "../contexts/AccountContext";
import { Check, CreditCard, ArrowRight, Layers, Smartphone } from "lucide-react";

export default function SubscriptionPage() {
  const { user } = useAuth();
  const { accounts } = useAccount();

  const TRIAL_DAYS = 3;
  const isPaid = user?.planTier === "paid";
  const isSuperUser = user?.role === "SUPERUSER";
  const createdAt = user?.createdAt ? new Date(user.createdAt) : null;
  const daysSince = createdAt ? Math.floor((Date.now() - createdAt.getTime()) / 86_400_000) : 0;
  const daysLeft = Math.max(0, TRIAL_DAYS - daysSince);
  const trialExpired = !isPaid && !isSuperUser && daysSince >= TRIAL_DAYS;

  const PAYMENT_WA = `https://wa.me/5583920017106?text=${encodeURIComponent("Olá! Quero ativar/renovar meu plano Pro no Send Inteligentte. Meu e-mail é: " + (user?.email || ""))}`;

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: "2rem", fontWeight: "700", marginBottom: "6px" }}>Assinatura & Plano</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Gerencie seu plano atual, acompanhe recursos disponíveis e ative sua assinatura do Send Inteligentte
        </p>
      </div>

      {/* Status Card Banner */}
      <div className="glass" style={{
        padding: "30px",
        borderRadius: "var(--radius-xl)",
        background: isPaid || isSuperUser
          ? "linear-gradient(135deg, rgba(0, 194, 107, 0.12) 0%, rgba(16, 185, 129, 0.04) 100%)"
          : "linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.04) 100%)",
        border: isPaid || isSuperUser
          ? "1px solid rgba(0, 194, 107, 0.3)"
          : "1px solid rgba(245, 158, 11, 0.3)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "20px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{
            width: "60px",
            height: "60px",
            borderRadius: "16px",
            background: isPaid || isSuperUser ? "rgba(0, 194, 107, 0.2)" : "rgba(245, 158, 11, 0.2)",
            color: isPaid || isSuperUser ? "var(--primary)" : "#f59e0b",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.8rem"
          }}>
            {isSuperUser ? "🛡️" : isPaid ? "💎" : "⚡"}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2 style={{ fontSize: "1.35rem", fontWeight: "700" }}>
                {isSuperUser
                  ? "Plano Superadministrador"
                  : isPaid
                  ? "Plano Send Inteligentte Pro"
                  : "Período de Teste Gratuito"}
              </h2>
              <span style={{
                background: isPaid || isSuperUser ? "rgba(0, 194, 107, 0.2)" : "rgba(245, 158, 11, 0.2)",
                color: isPaid || isSuperUser ? "var(--primary)" : "#f59e0b",
                border: isPaid || isSuperUser ? "1px solid rgba(0, 194, 107, 0.4)" : "1px solid rgba(245, 158, 11, 0.4)",
                padding: "3px 10px",
                borderRadius: "20px",
                fontSize: "0.78rem",
                fontWeight: "700"
              }}>
                {isSuperUser ? "ADMIN" : isPaid ? "ATIVO" : trialExpired ? "EXPIRADO" : "TESTE"}
              </span>
            </div>

            <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem", lineHeight: "1.5" }}>
              {isSuperUser
                ? "Sua conta possui credenciais de Administrador com acesso ilimitado a todas as ferramentas do sistema."
                : isPaid
                ? "Sua assinatura Pro está ativa com envio ilimitado via API Oficial da Meta."
                : trialExpired
                ? "Seu período de teste de 3 dias expirou. Ative seu plano Pro para liberar os disparos."
                : `Você tem ${daysLeft} dia${daysLeft !== 1 ? "s" : ""} restante${daysLeft !== 1 ? "s" : ""} no seu teste gratuito de 3 dias.`}
            </p>
          </div>
        </div>

        {!isPaid && !isSuperUser && (
          <a
            href={PAYMENT_WA}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{
              padding: "12px 24px",
              fontSize: "0.95rem",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              textDecoration: "none"
            }}
          >
            <CreditCard size={18} /> Assinar Plano Pro via WhatsApp
          </a>
        )}
      </div>

      {/* Plan Cards Comparison */}
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
            {isPaid ? "Gerenciar Assinatura" : "Ativar Plano Pro Agora"} <ArrowRight size={16} />
          </a>
        </div>
      </div>

      {/* Resource Usage & Account Info */}
      <div className="glass" style={{ padding: "28px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "16px" }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
          <Layers size={18} color="var(--primary)" /> Uso de Recursos na Conta
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginTop: "4px" }}>
          <div style={{ background: "rgba(255,255,255,0.03)", padding: "16px", borderRadius: "var(--radius-md)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "4px" }}>Linhas Meta Conectadas</div>
            <div style={{ fontSize: "1.4rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
              <Smartphone size={18} color="var(--primary)" /> {accounts.length} conta{accounts.length !== 1 ? "s" : ""}
            </div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.03)", padding: "16px", borderRadius: "var(--radius-md)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "4px" }}>Data de Cadastro</div>
            <div style={{ fontSize: "1.1rem", fontWeight: "600", color: "var(--text-primary)" }}>
              {createdAt ? createdAt.toLocaleDateString("pt-BR") : "Desconhecido"}
            </div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.03)", padding: "16px", borderRadius: "var(--radius-md)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "4px" }}>Titular da Conta</div>
            <div style={{ fontSize: "1.1rem", fontWeight: "600", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.name || user?.email}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
