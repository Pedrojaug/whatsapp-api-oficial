import { useState } from "react";
import { formatBRL, formatUSD, META_RATES_BRL, META_RATES_USD } from "../utils/pricing";

interface FinancialMetricsSectionProps {
  costs?: any;
  periodLabel: string;
  templateMetrics?: Array<{ templateName: string; total: number; sent: number; delivered?: number; read: number; failed: number }>;
  isLoading?: boolean;
}

export default function FinancialMetricsSection({
  costs,
  periodLabel,
  templateMetrics = [],
  isLoading = false,
}: FinancialMetricsSectionProps) {
  // Simulador de Custos em Tempo Real
  const [simulatorContacts, setSimulatorContacts] = useState<number>(1000);
  const [simulatorCategory, setSimulatorCategory] = useState<"MARKETING" | "UTILITY" | "AUTHENTICATION">("MARKETING");
  const [showMetaRules, setShowMetaRules] = useState(false);

  // Valores extraídos com fallback seguro
  const periodSpentBrl = costs?.period?.totalSpentBrl ?? 0;
  const periodSpentUsd = costs?.period?.totalSpentUsd ?? 0;
  const deliveredBilled = costs?.period?.totalDeliveredBilled ?? 0;
  const failedFree = costs?.period?.totalFailedFree ?? 0;
  const savingsFromFailuresBrl = costs?.period?.savingsFromFailuresBrl ?? 0;

  const currentMonthSpentBrl = costs?.billingForecast?.currentMonthSpentBrl ?? periodSpentBrl;
  const dailyRunRateBrl = costs?.billingForecast?.dailyRunRateBrl ?? (currentMonthSpentBrl / Math.max(1, new Date().getDate()));
  const projectedMonthEndBrl = costs?.billingForecast?.projectedMonthEndCostBrl ?? currentMonthSpentBrl;
  const projectedMonthEndUsd = costs?.billingForecast?.projectedMonthEndCostUsd ?? (projectedMonthEndBrl / 5.75);
  const activeCampaignsProjectedBrl = costs?.billingForecast?.activeCampaignsProjectedBrl ?? 0;
  const totalForecastMonthBrl = costs?.billingForecast?.totalForecastMonthBrl ?? (currentMonthSpentBrl + activeCampaignsProjectedBrl);
  const nextBillingEstimate = costs?.billingForecast?.nextBillingEstimate ?? "Fechamento mensal Meta ou no limite de gastos";

  // Preço unitário simulado
  const unitRateSimulatedBrl = META_RATES_BRL[simulatorCategory] || 0.36;
  const unitRateSimulatedUsd = META_RATES_USD[simulatorCategory] || 0.0625;
  const totalSimulatedBrl = simulatorContacts * unitRateSimulatedBrl;
  const totalSimulatedUsd = simulatorContacts * unitRateSimulatedUsd;

  // Lista consolidada de templates com custo
  const templateCostsList = costs?.templateCosts && costs.templateCosts.length > 0
    ? costs.templateCosts
    : templateMetrics.map((t) => {
        const cat: "MARKETING" | "UTILITY" = t.templateName.toLowerCase().includes("pedido") || t.templateName.toLowerCase().includes("aviso") ? "UTILITY" : "MARKETING";
        const unitBrl = META_RATES_BRL[cat];
        const unitUsd = META_RATES_USD[cat];
        const delivered = t.delivered ?? t.sent;
        const totalBrl = delivered * unitBrl;
        return {
          templateName: t.templateName,
          category: cat,
          delivered,
          failed: t.failed,
          total: t.total,
          unitCostBrl: unitBrl,
          unitCostUsd: unitUsd,
          totalCostBrl: totalBrl,
          totalCostUsd: delivered * unitUsd,
          percentageOfTotal: periodSpentBrl > 0 ? Math.round((totalBrl / periodSpentBrl) * 100) : 0,
        };
      });

  if (isLoading) {
    return (
      <div className="glass" style={{ padding: "26px 30px", borderRadius: "var(--radius-xl)" }}>
        <div className="skeleton" style={{ height: "40px", width: "300px", marginBottom: "20px" }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: "110px", borderRadius: "var(--radius-md)" }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="glass"
      style={{
        padding: "28px 30px",
        borderRadius: "var(--radius-xl)",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        border: "1px solid rgba(37, 211, 102, 0.18)",
        background: "linear-gradient(135deg, rgba(20, 24, 28, 0.95) 0%, rgba(28, 33, 39, 0.95) 100%)",
      }}
    >
      {/* Cabeçalho Corporativo & Status de Tarifação */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "1.4rem" }}>💰</span>
            <h3 style={{ fontSize: "1.3rem", fontWeight: "700", margin: 0, color: "var(--text-primary)" }}>
              Prévia Financeira & Custos da Meta API
            </h3>
            <span
              style={{
                fontSize: "0.72rem",
                padding: "3px 8px",
                borderRadius: "20px",
                background: "rgba(37, 211, 102, 0.15)",
                color: "var(--primary)",
                fontWeight: "700",
                border: "1px solid rgba(37, 211, 102, 0.3)",
              }}
            >
              Oficial Meta Cloud
            </span>
          </div>
          <p style={{ margin: "6px 0 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Transparência total dos disparos efetuados ({periodLabel}) e previsão da fatura cobrada no seu cartão Meta.
          </p>
        </div>

        {/* Badges de Destaque Técnico */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid var(--border-color)",
              borderRadius: "16px",
              fontSize: "0.78rem",
              color: "var(--text-secondary)",
            }}
          >
            <span>🛡️</span>
            <span>Falhas = <strong>R$ 0,00</strong> (Isentas pela Meta)</span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              background: "rgba(37, 211, 102, 0.08)",
              border: "1px solid rgba(37, 211, 102, 0.25)",
              borderRadius: "16px",
              fontSize: "0.78rem",
              color: "var(--primary)",
              fontWeight: "600",
            }}
          >
            <span>💵</span>
            <span>Câmbio Ref.: <strong>US$ 1.00 = R$ 5,75</strong></span>
          </div>
        </div>
      </div>

      {/* Grid de 4 Cards Financeiros Principais */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        {/* Card 1: Gasto no Período Selecionado */}
        <div
          className="glass-interactive"
          style={{
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid var(--border-color)",
            borderRadius: "14px",
            padding: "18px 20px",
            borderLeft: "4px solid var(--primary)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>
              Gasto no Período
            </span>
            <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>{periodLabel}</span>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: "800", color: "var(--text-primary)" }}>
            {formatBRL(periodSpentBrl)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
            <span>{formatUSD(periodSpentUsd)}</span>
            <span>•</span>
            <span style={{ color: "var(--primary)" }}>{deliveredBilled.toLocaleString("pt-BR")} entregues</span>
          </div>
        </div>

        {/* Card 2: Previsão da Fatura do Mês */}
        <div
          className="glass-interactive"
          style={{
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid var(--border-color)",
            borderRadius: "14px",
            padding: "18px 20px",
            borderLeft: "4px solid #8b5cf6",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.82rem", color: "#a78bfa", fontWeight: "600", textTransform: "uppercase" }}>
              Previsão de Fatura (Mês)
            </span>
            <span style={{ fontSize: "0.72rem", background: "rgba(139, 92, 246, 0.15)", color: "#c4b5fd", padding: "2px 6px", borderRadius: "4px" }}>
              Projeção
            </span>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: "800", color: "#c4b5fd" }}>
            {formatBRL(projectedMonthEndBrl)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "6px", fontSize: "0.76rem", color: "var(--text-secondary)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span>Ritmo: ~{formatBRL(dailyRunRateBrl)}/dia</span>
              <span>•</span>
              <span>{formatUSD(projectedMonthEndUsd)}</span>
            </div>
            {activeCampaignsProjectedBrl > 0 && (
              <div style={{ color: "#a78bfa", fontSize: "0.72rem" }}>
                Total c/ agendadas: {formatBRL(totalForecastMonthBrl)}
              </div>
            )}
            <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", marginTop: "2px" }}>
              Vencimento est.: {nextBillingEstimate}
            </div>
          </div>
        </div>

        {/* Card 3: Disparos Cobrados vs Isentos */}
        <div
          className="glass-interactive"
          style={{
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid var(--border-color)",
            borderRadius: "14px",
            padding: "18px 20px",
            borderLeft: "4px solid #06b6d4",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.82rem", color: "#22d3ee", fontWeight: "600", textTransform: "uppercase" }}>
              Entregues vs Isentos
            </span>
            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Meta Billing</span>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: "800", color: "#67e8f9" }}>
            {deliveredBilled.toLocaleString("pt-BR")}{" "}
            <span style={{ fontSize: "1rem", fontWeight: "500", color: "var(--text-muted)" }}>tarifados</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
            <span style={{ color: "#facc15" }}>{failedFree.toLocaleString("pt-BR")} falhas</span>
            <span>•</span>
            <span style={{ color: "var(--success)" }}>R$ 0,00 cobrados</span>
          </div>
        </div>

        {/* Card 4: Economia Real com Falhas */}
        <div
          className="glass-interactive"
          style={{
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid var(--border-color)",
            borderRadius: "14px",
            padding: "18px 20px",
            borderLeft: "4px solid var(--success)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.82rem", color: "var(--success)", fontWeight: "600", textTransform: "uppercase" }}>
              Economia em Falhas
            </span>
            <span style={{ fontSize: "0.72rem", background: "rgba(37, 211, 102, 0.12)", color: "var(--success)", padding: "2px 6px", borderRadius: "4px" }}>
              Proteção
            </span>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: "800", color: "var(--success)" }}>
            {formatBRL(savingsFromFailuresBrl)}
          </div>
          <div style={{ marginTop: "6px", fontSize: "0.78rem", color: "var(--text-muted)" }}>
            Valor não faturado por números inexistentes ou sem WhatsApp.
          </div>
        </div>
      </div>

      {/* Seção Central: Tarifas por Categoria + Simulador de Disparos */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "20px" }}>
        {/* Lado Esquerdo: Tarifas Oficiais Meta por Categoria */}
        <div
          style={{
            background: "rgba(0, 0, 0, 0.2)",
            border: "1px solid var(--border-color)",
            borderRadius: "14px",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h4 style={{ margin: 0, fontSize: "0.98rem", fontWeight: "700", color: "var(--text-primary)" }}>
              🏷️ Tarifas Oficiais da Meta (Brasil +55)
            </h4>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Por conversa entregue</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {/* Categoria Marketing */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px",
                background: "rgba(255, 255, 255, 0.02)",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.05)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#a855f7" }}></span>
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-primary)" }}>Marketing</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Promoções, ofertas e novidades</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.95rem", fontWeight: "700", color: "#c084fc" }}>
                  ~R$ 0,36 <span style={{ fontSize: "0.75rem", fontWeight: "400", color: "var(--text-muted)" }}>($0.0625)</span>
                </div>
              </div>
            </div>

            {/* Categoria Utilidade */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px",
                background: "rgba(255, 255, 255, 0.02)",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.05)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#06b6d4" }}></span>
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-primary)" }}>Utilidade / Notificação</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Confirmação de pedido, rastreio, avisos</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.95rem", fontWeight: "700", color: "#22d3ee" }}>
                  ~R$ 0,20 <span style={{ fontSize: "0.75rem", fontWeight: "400", color: "var(--text-muted)" }}>($0.0350)</span>
                </div>
              </div>
            </div>

            {/* Categoria Autenticação */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px",
                background: "rgba(255, 255, 255, 0.02)",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.05)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#eab308" }}></span>
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-primary)" }}>Autenticação (OTP)</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Códigos 2FA e validação única</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.95rem", fontWeight: "700", color: "#facc15" }}>
                  ~R$ 0,18 <span style={{ fontSize: "0.75rem", fontWeight: "400", color: "var(--text-muted)" }}>($0.0315)</span>
                </div>
              </div>
            </div>

            {/* Categoria Serviço (Receptivo) */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px",
                background: "rgba(37, 211, 102, 0.04)",
                borderRadius: "8px",
                border: "1px solid rgba(37, 211, 102, 0.15)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--primary)" }}></span>
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--primary)" }}>Atendimento (Service)</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Iniciado pelo cliente (SAC)</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--primary)" }}>
                  1.000 / mês GRÁTIS
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>depois ~R$ 0,17 ($0.030)</div>
              </div>
            </div>
          </div>
        </div>

        {/* Lado Direito: Simulador & Calculadora de Disparo em Tempo Real */}
        <div
          style={{
            background: "rgba(0, 0, 0, 0.2)",
            border: "1px solid var(--border-color)",
            borderRadius: "14px",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h4 style={{ margin: 0, fontSize: "0.98rem", fontWeight: "700", color: "var(--text-primary)" }}>
              🧮 Simulador de Custos de Disparo
            </h4>
            <span style={{ fontSize: "0.72rem", padding: "2px 8px", background: "rgba(37, 211, 102, 0.1)", color: "var(--primary)", borderRadius: "10px", fontWeight: "600" }}>
              Cálculo em Tempo Real
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Escolha da Categoria */}
            <div>
              <label style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                Tipo de Mensagem / Template
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                {(["MARKETING", "UTILITY", "AUTHENTICATION"] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSimulatorCategory(cat)}
                    style={{
                      padding: "8px 6px",
                      borderRadius: "6px",
                      fontSize: "0.75rem",
                      fontWeight: simulatorCategory === cat ? "700" : "500",
                      background: simulatorCategory === cat ? "var(--primary)" : "rgba(255, 255, 255, 0.05)",
                      color: simulatorCategory === cat ? "#0d0e11" : "var(--text-secondary)",
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {cat === "MARKETING" ? "Marketing" : cat === "UTILITY" ? "Utilidade" : "Autenticação"}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantidade de Contatos */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <label style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  Quantidade de Contatos / Disparos
                </label>
                <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--text-primary)" }}>
                  {simulatorContacts.toLocaleString("pt-BR")} destinatários
                </span>
              </div>
              <input
                type="range"
                min={100}
                max={50000}
                step={100}
                value={simulatorContacts}
                onChange={(e) => setSimulatorContacts(parseInt(e.target.value) || 100)}
                style={{ width: "100%", accentColor: "var(--primary)", cursor: "pointer" }}
              />
              <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
                {[500, 1000, 2500, 5000, 10000, 25000].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setSimulatorContacts(num)}
                    style={{
                      padding: "3px 8px",
                      borderRadius: "4px",
                      fontSize: "0.72rem",
                      background: simulatorContacts === num ? "rgba(37, 211, 102, 0.2)" : "rgba(255, 255, 255, 0.04)",
                      color: simulatorContacts === num ? "var(--primary)" : "var(--text-muted)",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                      cursor: "pointer",
                    }}
                  >
                    {num.toLocaleString("pt-BR")}
                  </button>
                ))}
              </div>
            </div>

            {/* Resultado do Simulador */}
            <div
              style={{
                marginTop: "6px",
                padding: "14px 16px",
                background: "rgba(37, 211, 102, 0.07)",
                border: "1px solid rgba(37, 211, 102, 0.25)",
                borderRadius: "10px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>
                  Custo Estimado deste Disparo:
                </span>
                <span style={{ fontSize: "1.45rem", fontWeight: "800", color: "var(--primary)" }}>
                  {formatBRL(totalSimulatedBrl)}
                </span>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "0.82rem", fontWeight: "600", color: "var(--text-secondary)", display: "block" }}>
                  {formatUSD(totalSimulatedUsd)}
                </span>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  (~{formatBRL(unitRateSimulatedBrl)} por envio)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Custos Detalhada por Template */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div>
            <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: "700", color: "var(--text-primary)" }}>
              📊 Custos Consolidados por Template
            </h4>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              Apenas mensagens entregues no aparelho geram custo. Números sem WhatsApp e falhas custam R$ 0,00.
            </span>
          </div>
        </div>

        {templateCostsList.length === 0 ? (
          <div
            style={{
              padding: "24px",
              textAlign: "center",
              color: "var(--text-muted)",
              background: "rgba(0, 0, 0, 0.15)",
              borderRadius: "10px",
              fontSize: "0.9rem",
            }}
          >
            Nenhum disparo de template registrado neste período.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%", fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  <th>Nome do Template</th>
                  <th>Categoria</th>
                  <th>Tarifa Meta</th>
                  <th>Entregues (Cobrados)</th>
                  <th>Falhas (R$ 0,00)</th>
                  <th>Total Faturado</th>
                  <th style={{ width: "120px" }}>% do Gasto</th>
                </tr>
              </thead>
              <tbody>
                {templateCostsList.map((t: any, idx: number) => {
                  const isMarketing = t.category === "MARKETING";
                  const isUtility = t.category === "UTILITY";
                  const deliveredCount = t.delivered || 0;
                  const totalCostBrl = t.totalCostBrl || (deliveredCount * (isUtility ? 0.20 : 0.36));
                  const percentage = t.percentageOfTotal ?? (periodSpentBrl > 0 ? Math.round((totalCostBrl / periodSpentBrl) * 100) : 0);

                  return (
                    <tr key={idx}>
                      <td style={{ fontWeight: "600", color: "var(--text-primary)" }}>
                        {t.templateName}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            padding: "3px 8px",
                            borderRadius: "12px",
                            fontWeight: "600",
                            background: isMarketing ? "rgba(168, 85, 247, 0.15)" : isUtility ? "rgba(6, 182, 212, 0.15)" : "rgba(234, 179, 8, 0.15)",
                            color: isMarketing ? "#c084fc" : isUtility ? "#22d3ee" : "#facc15",
                          }}
                        >
                          {t.category === "MARKETING" ? "Marketing" : t.category === "UTILITY" ? "Utilidade" : "Autenticação"}
                        </span>
                      </td>
                      <td style={{ color: "var(--text-secondary)" }}>
                        {formatBRL(t.unitCostBrl || (isUtility ? 0.20 : 0.36))}
                      </td>
                      <td style={{ color: "var(--primary)", fontWeight: "600" }}>
                        {deliveredCount.toLocaleString("pt-BR")}
                      </td>
                      <td>
                        <span style={{ color: t.failed > 0 ? "#f87171" : "var(--text-muted)" }}>
                          {t.failed.toLocaleString("pt-BR")}{" "}
                          <span style={{ fontSize: "0.7rem", color: "var(--success)" }}>(Isento)</span>
                        </span>
                      </td>
                      <td style={{ fontWeight: "700", color: "var(--text-primary)" }}>
                        {formatBRL(totalCostBrl)}
                        <span style={{ display: "block", fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: "400" }}>
                          {formatUSD(t.totalCostUsd || (totalCostBrl / 5.75))}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "0.75rem", minWidth: "32px", fontWeight: "600" }}>{percentage}%</span>
                          <div style={{ flex: 1, height: "6px", background: "rgba(255, 255, 255, 0.05)", borderRadius: "3px", overflow: "hidden" }}>
                            <div
                              style={{
                                width: `${percentage}%`,
                                height: "100%",
                                background: isMarketing ? "#a855f7" : "var(--primary)",
                                borderRadius: "3px",
                              }}
                            />
                          </div>
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

      {/* Accordion / Guia Didático de Faturamento da Meta */}
      <div
        style={{
          borderTop: "1px solid rgba(255, 255, 255, 0.06)",
          paddingTop: "16px",
        }}
      >
        <button
          type="button"
          onClick={() => setShowMetaRules(!showMetaRules)}
          style={{
            background: "none",
            border: "none",
            color: "var(--primary)",
            fontSize: "0.85rem",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: 0,
          }}
        >
          <span>{showMetaRules ? "▼" : "▶"}</span>
          <span>Como funciona a cobrança da Meta? Entenda o ciclo de faturamento e regras de isenção</span>
        </button>

        {showMetaRules && (
          <div
            style={{
              marginTop: "12px",
              padding: "16px 20px",
              background: "rgba(0, 0, 0, 0.25)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              borderRadius: "10px",
              fontSize: "0.82rem",
              lineHeight: "1.6",
              color: "var(--text-secondary)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <p>
              • <strong>Forma de Cobrança:</strong> A Meta Cloud API debita os consumos diretamente no cartão de crédito cadastrado na sua conta do <em>Meta Business Manager</em> (WhatsApp Business Platform).
            </p>
            <p>
              • <strong>Ciclo de Faturamento:</strong> O fechamento ocorre mensalmente no último dia do mês corrente OU sempre que seu saldo atinge o <em>Limite de Faturamento automático (Threshold)</em> configurado na Meta.
            </p>
            <p>
              • <strong>Isenção em Falhas:</strong> Ao contrário de provedores de SMS tradicionais, o WhatsApp Oficial <strong>NÃO cobra disparos que não forem entregues</strong> (ex: números inexistentes, telefones fixos ou bloqueios temporários de frequência).
            </p>
            <p>
              • <strong>Janela de Atendimento Gratuito:</strong> Toda conta de WhatsApp Business tem direito a <strong>1.000 conversas de atendimento gratuitas por mês</strong> para responder clientes que chamam primeiro.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
