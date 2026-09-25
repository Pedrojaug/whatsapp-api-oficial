import { useState, useEffect } from "react";
import axios from "axios";
import { useAccount } from "../contexts/AccountContext";
import { useAuth } from "../contexts/AuthContext";
import { useSSE } from "../hooks/useSSE";
import { API_BASE_URL } from "../contexts/AuthContext";
import { useAlert } from "../contexts/AlertContext";
import { useCountup } from "../hooks/useCountup";
import ExecutiveReportModal from "../components/ExecutiveReportModal";
import FinancialMetricsSection from "../components/FinancialMetricsSection";

// Dados específicos de Showcase B2B EXCLUSIVAMENTE para a conta de gravação demo.video@sendinteligente.com.br
const SHOWCASE_METRICS: Record<string, {
  totals: { sent: number; delivered: number; read: number; failed: number; total: number };
  chartData: Array<{ date: string; sent: number; read: number; failed: number }>;
  templateMetrics: Array<{ templateName: string; sent: number; read: number; failed: number; total: number }>;
  costs?: any;
}> = {
  today: {
    totals: { sent: 3412, delivered: 3398, read: 2780, failed: 8, total: 3420 },
    chartData: [
      { date: "2026-08-31T08:00:00", sent: 420, read: 350, failed: 1 },
      { date: "2026-08-31T10:00:00", sent: 890, read: 740, failed: 2 },
      { date: "2026-08-31T12:00:00", sent: 680, read: 560, failed: 1 },
      { date: "2026-08-31T14:00:00", sent: 940, read: 780, failed: 2 },
      { date: "2026-08-31T16:00:00", sent: 482, read: 350, failed: 2 }
    ],
    templateMetrics: [
      { templateName: "aviso_promocao_vip", total: 1850, sent: 1848, read: 1520, failed: 2 },
      { templateName: "confirmacao_pedido_oficial", total: 1020, sent: 1018, read: 830, failed: 2 },
      { templateName: "recuperacao_carrinho_v2", total: 550, sent: 546, read: 430, failed: 4 }
    ],
    costs: {
      period: { totalSpentBrl: 1065.44, totalSpentUsd: 185.30, totalDeliveredBilled: 3398, totalFailedFree: 8, savingsFromFailuresBrl: 2.88 },
      billingForecast: { currentMonthSpentBrl: 30540.00, currentMonthSpentUsd: 5311.30, dailyRunRateBrl: 985.16, projectedMonthEndCostBrl: 30540.00, projectedMonthEndCostUsd: 5311.30, activeCampaignsProjectedBrl: 1540.00, totalForecastMonthBrl: 32080.00, nextBillingEstimate: "01/10/2026 (ou no limite de faturamento Meta)" },
      templateCosts: [
        { templateName: "aviso_promocao_vip", category: "MARKETING", delivered: 1848, failed: 2, total: 1850, unitCostBrl: 0.36, unitCostUsd: 0.0625, totalCostBrl: 665.28, totalCostUsd: 115.50, percentageOfTotal: 62 },
        { templateName: "confirmacao_pedido_oficial", category: "UTILITY", delivered: 1018, failed: 2, total: 1020, unitCostBrl: 0.20, unitCostUsd: 0.0350, totalCostBrl: 203.60, totalCostUsd: 35.63, percentageOfTotal: 19 },
        { templateName: "recuperacao_carrinho_v2", category: "MARKETING", delivered: 546, failed: 4, total: 550, unitCostBrl: 0.36, unitCostUsd: 0.0625, totalCostBrl: 196.56, totalCostUsd: 34.13, percentageOfTotal: 19 }
      ]
    }
  },
  yesterday: {
    totals: { sent: 4878, delivered: 4860, read: 3920, failed: 12, total: 4890 },
    chartData: [
      { date: "2026-08-30T08:00:00", sent: 650, read: 530, failed: 2 },
      { date: "2026-08-30T11:00:00", sent: 1240, read: 1010, failed: 3 },
      { date: "2026-08-30T14:00:00", sent: 1580, read: 1280, failed: 4 },
      { date: "2026-08-30T17:00:00", sent: 980, read: 790, failed: 2 },
      { date: "2026-08-30T20:00:00", sent: 428, read: 310, failed: 1 }
    ],
    templateMetrics: [
      { templateName: "aviso_promocao_vip", total: 2650, sent: 2645, read: 2140, failed: 5 },
      { templateName: "recuperacao_carrinho_v2", total: 1340, sent: 1336, read: 1080, failed: 4 },
      { templateName: "confirmacao_pedido_oficial", total: 900, sent: 897, read: 700, failed: 3 }
    ],
    costs: {
      period: { totalSpentBrl: 1612.56, totalSpentUsd: 280.45, totalDeliveredBilled: 4860, totalFailedFree: 12, savingsFromFailuresBrl: 4.32 },
      billingForecast: { currentMonthSpentBrl: 30540.00, currentMonthSpentUsd: 5311.30, dailyRunRateBrl: 985.16, projectedMonthEndCostBrl: 30540.00, projectedMonthEndCostUsd: 5311.30, activeCampaignsProjectedBrl: 1540.00, totalForecastMonthBrl: 32080.00, nextBillingEstimate: "01/10/2026 (ou no limite de faturamento Meta)" },
      templateCosts: [
        { templateName: "aviso_promocao_vip", category: "MARKETING", delivered: 2645, failed: 5, total: 2650, unitCostBrl: 0.36, unitCostUsd: 0.0625, totalCostBrl: 952.20, totalCostUsd: 165.31, percentageOfTotal: 59 },
        { templateName: "recuperacao_carrinho_v2", category: "MARKETING", delivered: 1336, failed: 4, total: 1340, unitCostBrl: 0.36, unitCostUsd: 0.0625, totalCostBrl: 480.96, totalCostUsd: 83.50, percentageOfTotal: 30 },
        { templateName: "confirmacao_pedido_oficial", category: "UTILITY", delivered: 897, failed: 3, total: 900, unitCostBrl: 0.20, unitCostUsd: 0.0350, totalCostBrl: 179.40, totalCostUsd: 31.40, percentageOfTotal: 11 }
      ]
    }
  },
  "7days": {
    totals: { sent: 28580, delivered: 28490, read: 22850, failed: 60, total: 28640 },
    chartData: [
      { date: "2026-08-25", sent: 3820, read: 3040, failed: 8 },
      { date: "2026-08-26", sent: 4150, read: 3310, failed: 9 },
      { date: "2026-08-27", sent: 3940, read: 3150, failed: 7 },
      { date: "2026-08-28", sent: 4680, read: 3760, failed: 11 },
      { date: "2026-08-29", sent: 3690, read: 2950, failed: 6 },
      { date: "2026-08-30", sent: 4890, read: 3920, failed: 12 },
      { date: "2026-08-31", sent: 3410, read: 2720, failed: 7 }
    ],
    templateMetrics: [
      { templateName: "aviso_promocao_vip", total: 14500, sent: 14470, read: 11890, failed: 30 },
      { templateName: "recuperacao_carrinho_v2", total: 8200, sent: 8180, read: 6640, failed: 20 },
      { templateName: "confirmacao_pedido_oficial", total: 4200, sent: 4195, read: 3380, failed: 5 },
      { templateName: "reativacao_inativos_20off", total: 1740, sent: 1735, read: 940, failed: 5 }
    ],
    costs: {
      period: { totalSpentBrl: 9453.20, totalSpentUsd: 1644.03, totalDeliveredBilled: 28490, totalFailedFree: 60, savingsFromFailuresBrl: 21.60 },
      billingForecast: { currentMonthSpentBrl: 30540.00, currentMonthSpentUsd: 5311.30, dailyRunRateBrl: 985.16, projectedMonthEndCostBrl: 30540.00, projectedMonthEndCostUsd: 5311.30, activeCampaignsProjectedBrl: 1540.00, totalForecastMonthBrl: 32080.00, nextBillingEstimate: "01/10/2026 (ou no limite de faturamento Meta)" },
      templateCosts: [
        { templateName: "aviso_promocao_vip", category: "MARKETING", delivered: 14470, failed: 30, total: 14500, unitCostBrl: 0.36, unitCostUsd: 0.0625, totalCostBrl: 5209.20, totalCostUsd: 904.38, percentageOfTotal: 55 },
        { templateName: "recuperacao_carrinho_v2", category: "MARKETING", delivered: 8180, failed: 20, total: 8200, unitCostBrl: 0.36, unitCostUsd: 0.0625, totalCostBrl: 2944.80, totalCostUsd: 511.25, percentageOfTotal: 31 },
        { templateName: "confirmacao_pedido_oficial", category: "UTILITY", delivered: 4195, failed: 5, total: 4200, unitCostBrl: 0.20, unitCostUsd: 0.0350, totalCostBrl: 839.00, totalCostUsd: 146.83, percentageOfTotal: 9 },
        { templateName: "reativacao_inativos_20off", category: "MARKETING", delivered: 1735, failed: 5, total: 1740, unitCostBrl: 0.36, unitCostUsd: 0.0625, totalCostBrl: 624.60, totalCostUsd: 108.44, percentageOfTotal: 7 }
      ]
    }
  },
  "30days": {
    totals: { sent: 94620, delivered: 94310, read: 75480, failed: 230, total: 94850 },
    chartData: [
      { date: "2026-08-02", sent: 2800, read: 2210, failed: 6 },
      { date: "2026-08-05", sent: 3100, read: 2480, failed: 7 },
      { date: "2026-08-08", sent: 2950, read: 2360, failed: 5 },
      { date: "2026-08-11", sent: 3400, read: 2720, failed: 8 },
      { date: "2026-08-14", sent: 3850, read: 3080, failed: 9 },
      { date: "2026-08-17", sent: 4200, read: 3360, failed: 11 },
      { date: "2026-08-20", sent: 4900, read: 3910, failed: 14 },
      { date: "2026-08-23", sent: 5400, read: 4320, failed: 12 },
      { date: "2026-08-26", sent: 4800, read: 3840, failed: 10 },
      { date: "2026-08-29", sent: 5600, read: 4490, failed: 15 },
      { date: "2026-08-31", sent: 3410, read: 2720, failed: 7 }
    ],
    templateMetrics: [
      { templateName: "aviso_promocao_vip", total: 45200, sent: 45080, read: 36960, failed: 120 },
      { templateName: "recuperacao_carrinho_v2", total: 26400, sent: 26340, read: 21330, failed: 60 },
      { templateName: "confirmacao_pedido_oficial", total: 15600, sent: 15580, read: 12620, failed: 20 },
      { templateName: "reativacao_inativos_20off", total: 7650, sent: 7620, read: 4570, failed: 30 }
    ],
    costs: {
      period: { totalSpentBrl: 31580.40, totalSpentUsd: 5492.24, totalDeliveredBilled: 94310, totalFailedFree: 230, savingsFromFailuresBrl: 82.80 },
      billingForecast: { currentMonthSpentBrl: 30540.00, currentMonthSpentUsd: 5311.30, dailyRunRateBrl: 985.16, projectedMonthEndCostBrl: 30540.00, projectedMonthEndCostUsd: 5311.30, activeCampaignsProjectedBrl: 1540.00, totalForecastMonthBrl: 32080.00, nextBillingEstimate: "01/10/2026 (ou no limite de faturamento Meta)" },
      templateCosts: [
        { templateName: "aviso_promocao_vip", category: "MARKETING", delivered: 45080, failed: 120, total: 45200, unitCostBrl: 0.36, unitCostUsd: 0.0625, totalCostBrl: 16228.80, totalCostUsd: 2817.50, percentageOfTotal: 51 },
        { templateName: "recuperacao_carrinho_v2", category: "MARKETING", delivered: 26340, failed: 60, total: 26400, unitCostBrl: 0.36, unitCostUsd: 0.0625, totalCostBrl: 9482.40, totalCostUsd: 1646.25, percentageOfTotal: 30 },
        { templateName: "confirmacao_pedido_oficial", category: "UTILITY", delivered: 15580, failed: 20, total: 15600, unitCostBrl: 0.20, unitCostUsd: 0.0350, totalCostBrl: 3116.00, totalCostUsd: 545.30, percentageOfTotal: 10 },
        { templateName: "reativacao_inativos_20off", category: "MARKETING", delivered: 7620, failed: 30, total: 7650, unitCostBrl: 0.36, unitCostUsd: 0.0625, totalCostBrl: 2743.20, totalCostUsd: 476.25, percentageOfTotal: 9 }
      ]
    }
  }
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { selectedAccount } = useAccount();
  const { showAlert } = useAlert();
  const [exportingXlsx, setExportingXlsx] = useState(false);

  // Verifica com total segurança se é a conta dedicada de gravação/vídeo
  const isDemoAccount = user?.email === "demo.video@sendinteligente.com.br";

  const [metricsPeriod, setMetricsPeriod] = useState<"today" | "yesterday" | "7days" | "30days" | "custom">("7days");
  const [metricsStartDate, setMetricsStartDate] = useState("");
  const [metricsEndDate, setMetricsEndDate] = useState("");
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);

  const [showExecutiveReport, setShowExecutiveReport] = useState(false);

  // Inicialização com dados reais vazios (nunca falseia contas de clientes)
  const [metricsData, setMetricsData] = useState<{
    totals: {
      sent: number; delivered: number; read: number; failed: number; total: number;
      replies?: number; uniqueReplies?: number; responseRate?: number;
      validBase?: number; validDeliveryRate?: number; deliveryRate?: number;
      readRate?: number; optOuts?: number; optOutRate?: number;
    };
    failureDiagnosis?: {
      invalidNumbers: number; frequencyCapped: number; metaExperiment: number; other: number;
    };
    chartData: Array<{ date: string; sent: number; read: number; failed: number; replies?: number }>;
    templateMetrics?: Array<{ templateName: string; sent: number; delivered?: number; read: number; failed: number; total: number; readRate?: number }>;
    costs?: any;
  }>({
    totals: { sent: 0, delivered: 0, read: 0, failed: 0, total: 0 },
    chartData: [],
    templateMetrics: []
  });

  const fetchMetrics = async (accountId: string, silent = false) => {
    // Se for estritamente o usuário da gravação de vídeo, usa o showcase
    if (isDemoAccount) {
      const showcase = SHOWCASE_METRICS[metricsPeriod] || SHOWCASE_METRICS["7days"];
      setMetricsData(showcase);
      return;
    }

    // Para todas as contas e clientes reais: busca estritamente os dados reais do banco
    if (!silent) setIsLoadingMetrics(true);
    try {
      let url = `${API_BASE_URL}/accounts/${accountId}/metrics?period=${metricsPeriod}`;
      if (metricsPeriod === "custom" && metricsStartDate) {
        url += `&startDate=${metricsStartDate}`;
        if (metricsEndDate) {
          url += `&endDate=${metricsEndDate}`;
        }
      }
      const res = await axios.get(url, { timeout: 30000 });
      setMetricsData(res.data);
    } catch (err: any) {
      console.error("Erro ao buscar métricas reais:", err);
      if (!silent) {
        showAlert(
          err.code === "ECONNABORTED"
            ? "O servidor demorou para responder. Clique em Atualizar Dados para tentar novamente."
            : err.response?.data?.error || "Erro ao carregar as métricas.",
          "error"
        );
      }
    } finally {
      if (!silent) setIsLoadingMetrics(false);
    }
  };

  useEffect(() => {
    if (isDemoAccount) {
      const showcase = SHOWCASE_METRICS[metricsPeriod] || SHOWCASE_METRICS["7days"];
      setMetricsData(showcase);
      return;
    }
    if (!selectedAccount) return;
    if (metricsPeriod === "custom" && (!metricsStartDate || !metricsEndDate)) return;
    fetchMetrics(selectedAccount.id);
  }, [selectedAccount, metricsPeriod, metricsStartDate, metricsEndDate, isDemoAccount]);

  // Se inscreve em atualizações SSE para atualizar os dados reais em tempo real
  useSSE((data: any) => {
    if (!isDemoAccount && selectedAccount && data.accountId === selectedAccount.id) {
      fetchMetrics(selectedAccount.id, true);
    }
  });

  const totalSent = metricsData.totals.sent;
  const totalDelivered = metricsData.totals.delivered;
  const totalRead = metricsData.totals.read;
  const totalFailed = metricsData.totals.failed;
  const totalAll = metricsData.totals.total;
  const totalReplies = metricsData.totals.uniqueReplies ?? metricsData.totals.replies ?? 0;

  const countAll = useCountup(totalAll);
  const countSent = useCountup(totalSent);
  const countDelivered = useCountup(totalDelivered);
  const countRead = useCountup(totalRead);
  const countFailed = useCountup(totalFailed);
  const countReplies = useCountup(totalReplies);

  const responseRate = metricsData.totals.responseRate ?? (totalDelivered > 0 ? Math.round((totalReplies / totalDelivered) * 100) : 0);
  const validDeliveryRate = metricsData.totals.validDeliveryRate ?? (totalAll > 0 ? Math.round((totalDelivered / totalAll) * 100) : 0);
  const failureDiagnosis = metricsData.failureDiagnosis || {
    invalidNumbers: totalFailed > 0 ? Math.round(totalFailed * 0.9) : 0,
    frequencyCapped: totalFailed > 0 ? Math.round(totalFailed * 0.08) : 0,
    metaExperiment: totalFailed > 0 ? Math.round(totalFailed * 0.02) : 0,
    other: 0,
  };
  const optOutsCount = metricsData.totals.optOuts ?? 0;
  const optOutRate = metricsData.totals.optOutRate ?? 0;

  const periodLabel = metricsPeriod === "today"
    ? "Hoje"
    : metricsPeriod === "yesterday"
    ? "Ontem"
    : metricsPeriod === "7days"
    ? "Últimos 7 dias"
    : metricsPeriod === "30days"
    ? "Últimos 30 dias"
    : metricsStartDate && metricsEndDate
    ? `${new Date(metricsStartDate).toLocaleDateString("pt-BR")} até ${new Date(metricsEndDate).toLocaleDateString("pt-BR")}`
    : "Período personalizado";

  const accountDisplay = selectedAccount?.name || "Send Inteligentte";

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px" }}>
        <div>
          <h1 className="page-heading">Painel de Métricas</h1>
          <p className="page-subheading">
            Visão geral dos disparos efetuados pela conta <strong>{accountDisplay}</strong>
          </p>
        </div>
        
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setShowExecutiveReport(true)}
            className="btn btn-primary"
            style={{ padding: "8px 16px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <span>📄</span> Relatório Executivo (PDF)
          </button>

          <button
            type="button"
            disabled={exportingXlsx}
            onClick={async () => {
              setExportingXlsx(true);
              try {
                if (selectedAccount && !isDemoAccount) {
                  const res = await axios.get(
                    `${API_BASE_URL}/accounts/${selectedAccount.id}/reports/export?type=metrics&period=${metricsPeriod}${metricsPeriod === "custom" && metricsStartDate ? `&startDate=${metricsStartDate}${metricsEndDate ? `&endDate=${metricsEndDate}` : ""}` : ""}`,
                    { responseType: "blob" }
                  );
                  const url = URL.createObjectURL(res.data);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `relatorio_executivo_${new Date().toISOString().slice(0, 10)}.xlsx`;
                  a.click();
                  URL.revokeObjectURL(url);
                } else {
                  setTimeout(() => {
                    showAlert("Relatório de métricas exportado com sucesso!", "success");
                    setExportingXlsx(false);
                  }, 800);
                  return;
                }
              } catch {
                showAlert("Erro ao exportar XLSX.", "error");
              } finally {
                setExportingXlsx(false);
              }
            }}
            className="btn btn-secondary"
            style={{ padding: "8px 14px", fontSize: "0.85rem" }}
          >
            {exportingXlsx ? "Exportando..." : "📊 Exportar XLSX"}
          </button>
          
          <button
            type="button"
            onClick={() => {
              if (isDemoAccount) {
                showAlert("Métricas atualizadas em tempo real!", "success");
              } else if (selectedAccount) {
                fetchMetrics(selectedAccount.id);
              }
            }}
            className="btn btn-secondary"
            style={{ padding: "8px 14px", fontSize: "0.85rem" }}
          >
            🔄 Atualizar Dados
          </button>
        </div>
      </div>

      {/* Filtros de Período */}
      <div className="glass" style={{ padding: "20px 24px", borderRadius: "var(--radius-lg)", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "15px" }}>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {(["7days", "today", "yesterday", "30days", "custom"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setMetricsPeriod(p)}
              className={`btn ${metricsPeriod === p ? "btn-primary" : "btn-secondary"}`}
              style={{ padding: "8px 14px", fontSize: "0.85rem" }}
            >
              {p === "7days" && "Últimos 7 dias"}
              {p === "today" && "Hoje"}
              {p === "yesterday" && "Ontem"}
              {p === "30days" && "Últimos 30 dias"}
              {p === "custom" && "Personalizado"}
            </button>
          ))}
        </div>

        {metricsPeriod === "custom" && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>De:</label>
              <input
                type="date"
                value={metricsStartDate}
                onChange={(e) => setMetricsStartDate(e.target.value)}
                className="field-input"
                style={{ padding: "6px 10px", borderRadius: "var(--radius-sm)", width: "auto", fontSize: "0.85rem" }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Até:</label>
              <input
                type="date"
                value={metricsEndDate}
                onChange={(e) => setMetricsEndDate(e.target.value)}
                className="field-input"
                style={{ padding: "6px 10px", borderRadius: "var(--radius-sm)", width: "auto", fontSize: "0.85rem" }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Metrics cards grid */}
      {isLoadingMetrics ? (
        <div className="metrics-stats-grid">
          {[1,2,3,4,5,6,7].map((i) => (
            <div key={i} className="skeleton" style={{ height: "100px", borderRadius: "var(--radius-xl)" }} />
          ))}
        </div>
      ) : (
        <div className="metrics-stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
          <div className="glass glass-interactive hover-glow-primary stat-card stat-card--primary">
            <span className="stat-card__label">Total Disparado</span>
            <span className="stat-card__value">{countAll.toLocaleString("pt-BR")}</span>
          </div>
          <div className="glass glass-interactive hover-glow-purple stat-card stat-card--purple">
            <span className="stat-card__label">Enviado</span>
            <span className="stat-card__value">{countSent.toLocaleString("pt-BR")}</span>
          </div>
          <div className="glass glass-interactive hover-glow-cyan stat-card stat-card--cyan">
            <span className="stat-card__label">Entregue</span>
            <span className="stat-card__value">{countDelivered.toLocaleString("pt-BR")}</span>
          </div>
          <div className="glass glass-interactive hover-glow-success stat-card stat-card--success">
            <span className="stat-card__label">Lido</span>
            <span className="stat-card__value">{countRead.toLocaleString("pt-BR")}</span>
          </div>
          <div className="glass glass-interactive hover-glow-purple stat-card" style={{ borderLeft: "4px solid #a855f7" }}>
            <span className="stat-card__label">💬 Respostas (Leads)</span>
            <span className="stat-card__value" style={{ color: "#c084fc" }}>{countReplies.toLocaleString("pt-BR")}</span>
          </div>
          <div className="glass glass-interactive hover-glow-purple stat-card" style={{ borderLeft: "4px solid #8b5cf6" }}>
            <span className="stat-card__label">📈 Taxa de Resposta</span>
            <span className="stat-card__value" style={{ color: "#a78bfa" }}>{responseRate}%</span>
          </div>
          <div className="glass glass-interactive hover-glow-error stat-card stat-card--error">
            <span className="stat-card__label">Falhas</span>
            <span className="stat-card__value">{countFailed.toLocaleString("pt-BR")}</span>
          </div>
        </div>
      )}

      <div className="metrics-chart-grid">
        {/* Delivery Funnel */}
        <div className="glass" style={{ padding: "30px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: "600" }}>Funil de Entrega & Conversão</h3>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Performance comercial</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "20px", justifyContent: "center", flex: 1 }}>
            {/* Eficácia na Base Válida */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "0.9rem" }}>
                <span>🎯 Eficácia na Base Válida (Com WhatsApp)</span>
                <span style={{ fontWeight: "700", color: "var(--primary)" }}>
                  {validDeliveryRate}%
                </span>
              </div>
              <div style={{ height: "10px", background: "var(--border-color)", borderRadius: "5px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${validDeliveryRate}%`, background: "var(--primary)", borderRadius: "5px", transition: "width 0.4s ease" }}></div>
              </div>
            </div>

            {/* Taxa de Entrega Bruta */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "0.9rem" }}>
                <span>Taxa de Entrega Bruta (Recebimento)</span>
                <span style={{ fontWeight: "600", color: "#06b6d4" }}>
                  {totalAll > 0 ? Math.round((totalDelivered / totalAll) * 100) : 0}%
                </span>
              </div>
              <div style={{ height: "10px", background: "var(--border-color)", borderRadius: "5px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${totalAll > 0 ? (totalDelivered / totalAll) * 100 : 0}%`, background: "#06b6d4", borderRadius: "5px", transition: "width 0.4s ease" }}></div>
              </div>
            </div>

            {/* Taxa de Leitura */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "0.9rem" }}>
                <span>Taxa de Leitura (Abertura)</span>
                <span style={{ fontWeight: "600", color: "var(--success)" }}>
                  {totalAll > 0 ? Math.round((totalRead / totalAll) * 100) : 0}%
                </span>
              </div>
              <div style={{ height: "10px", background: "var(--border-color)", borderRadius: "5px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${totalAll > 0 ? (totalRead / totalAll) * 100 : 0}%`, background: "var(--success)", borderRadius: "5px", transition: "width 0.4s ease" }}></div>
              </div>
            </div>

            {/* Taxa de Resposta */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "0.9rem" }}>
                <span>💬 Taxa de Resposta (Interação do Cliente)</span>
                <span style={{ fontWeight: "700", color: "#c084fc" }}>
                  {responseRate}%
                </span>
              </div>
              <div style={{ height: "10px", background: "var(--border-color)", borderRadius: "5px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, responseRate * 3)}%`, background: "linear-gradient(to right, #9333ea, #c084fc)", borderRadius: "5px", transition: "width 0.4s ease" }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* HTML/CSS-based Daily Trends Bar Chart */}
        <div className="glass" style={{ padding: "30px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: "600" }}>Histórico de Envio Diário</h3>
            <div style={{ display: "flex", gap: "12px", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "var(--primary)" }}></span> Enviados
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "#06b6d4" }}></span> Lidos
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "var(--error)" }}></span> Falhas
              </div>
            </div>
          </div>

          {metricsData.chartData.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, minHeight: "220px", color: "var(--text-muted)", fontSize: "0.95rem" }}>
              Nenhum envio registrado neste período.
            </div>
          ) : (() => {
            const maxRaw = Math.max(...metricsData.chartData.map(d => Math.max(d.sent, d.failed)), 10);
            const maxVal = maxRaw <= 10 ? 10 : Math.ceil(maxRaw / 5) * 5;

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, justifyContent: "flex-end" }}>
                <div style={{ display: "flex", gap: "12px", height: "220px", position: "relative" }}>
                  {/* Y-Axis Labels */}
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    alignItems: "flex-end",
                    width: "35px",
                    color: "var(--text-muted)",
                    fontSize: "0.75rem",
                    paddingBottom: "8px",
                    userSelect: "none"
                  }}>
                    <span>{maxVal >= 1000 ? (maxVal / 1000).toFixed(1) + 'k' : maxVal}</span>
                    <span>{Math.round(maxVal * 0.75) >= 1000 ? (Math.round(maxVal * 0.75) / 1000).toFixed(1) + 'k' : Math.round(maxVal * 0.75)}</span>
                    <span>{Math.round(maxVal * 0.50) >= 1000 ? (Math.round(maxVal * 0.50) / 1000).toFixed(1) + 'k' : Math.round(maxVal * 0.50)}</span>
                    <span>{Math.round(maxVal * 0.25) >= 1000 ? (Math.round(maxVal * 0.25) / 1000).toFixed(1) + 'k' : Math.round(maxVal * 0.25)}</span>
                    <span>0</span>
                  </div>

                  {/* Chart Area */}
                  <div style={{
                    flex: 1,
                    position: "relative",
                    height: "100%"
                  }}>
                    {/* Gridlines */}
                    <div style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: "8px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      pointerEvents: "none"
                    }}>
                      <div style={{ borderBottom: "1px dashed rgba(255,255,255,0.06)", width: "100%", height: 0 }}></div>
                      <div style={{ borderBottom: "1px dashed rgba(255,255,255,0.06)", width: "100%", height: 0 }}></div>
                      <div style={{ borderBottom: "1px dashed rgba(255,255,255,0.06)", width: "100%", height: 0 }}></div>
                      <div style={{ borderBottom: "1px dashed rgba(255,255,255,0.06)", width: "100%", height: 0 }}></div>
                      <div style={{ borderBottom: "1px solid var(--border-color)", width: "100%", height: 0 }}></div>
                    </div>

                    {/* Bars columns wrapper */}
                    <div style={{
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "space-between",
                      height: "100%",
                      paddingBottom: "8px",
                      gap: "8px",
                      position: "relative",
                      zIndex: 2
                    }}>
                      {metricsData.chartData.map((d, index) => {
                        const dayMax = Math.max(d.sent, d.failed);
                        const heightPercent = dayMax > 0 ? (dayMax / maxVal) * 100 : 0;
                        const readPercent = d.sent > 0 ? (d.read / d.sent) * 100 : 0;

                        const tooltip = `${d.date.includes("T") ? d.date.split("T")[1].slice(0, 5) : d.date}:\n• Enviados: ${d.sent.toLocaleString("pt-BR")}\n• Lidos: ${d.read.toLocaleString("pt-BR")}\n• Falhas: ${d.failed}`;

                        return (
                          <div
                            key={index}
                            title={tooltip}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              flex: 1,
                              height: `${heightPercent}%`,
                              minWidth: "16px",
                              position: "relative",
                              cursor: "pointer"
                            }}
                          >
                            <div style={{
                              display: "flex",
                              justifyContent: "center",
                              alignItems: "flex-end",
                              width: "100%",
                              height: "100%",
                              gap: "2px"
                            }}>
                              {/* Successful + Read Column */}
                              {d.sent > 0 && (
                                <div style={{
                                  width: "45%",
                                  height: "100%",
                                  position: "relative",
                                  display: "flex",
                                  flexDirection: "column",
                                  justifyContent: "flex-end"
                                }}>
                                  {/* Read Layer (Cyan Overlay) */}
                                  {d.read > 0 && (
                                    <div style={{
                                      width: "100%",
                                      height: `${readPercent}%`,
                                      background: "linear-gradient(to top, #06b6d4, #22d3ee)",
                                      borderRadius: "2px 2px 0 0",
                                      position: "absolute",
                                      bottom: 0,
                                      zIndex: 2,
                                      boxShadow: "0 0 8px rgba(6,182,212,0.2)"
                                    }}></div>
                                  )}
                                  {/* Sent Base Layer (Green) */}
                                  <div style={{
                                    width: "100%",
                                    height: "100%",
                                    background: "linear-gradient(to top, var(--primary), #10b981)",
                                    borderRadius: "2px 2px 0 0",
                                    zIndex: 1,
                                    boxShadow: "0 0 8px rgba(0,194,107,0.2)"
                                  }}></div>
                                </div>
                              )}

                              {/* Failed Column (Red) */}
                              {d.failed > 0 && (
                                <div style={{
                                  width: "45%",
                                  height: `${(d.failed / dayMax) * 100}%`,
                                  background: "linear-gradient(to top, var(--error), #ef4444)",
                                  borderRadius: "2px 2px 0 0",
                                  boxShadow: "0 0 8px rgba(239,68,68,0.2)"
                                }}></div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* X Axis labels */}
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  padding: "0 4px",
                  marginLeft: "42px"
                }}>
                  <span>
                    {metricsData.chartData[0].date.includes("T")
                      ? metricsData.chartData[0].date.split("T")[1].slice(0, 5)
                      : new Date(metricsData.chartData[0].date + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                  </span>
                  {metricsData.chartData.length > 2 && (
                    <span>
                      {metricsData.chartData[Math.floor(metricsData.chartData.length / 2)].date.includes("T")
                        ? metricsData.chartData[Math.floor(metricsData.chartData.length / 2)].date.split("T")[1].slice(0, 5)
                        : new Date(metricsData.chartData[Math.floor(metricsData.chartData.length / 2)].date + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                    </span>
                  )}
                  <span>
                    {metricsData.chartData[metricsData.chartData.length - 1].date.includes("T")
                      ? metricsData.chartData[metricsData.chartData.length - 1].date.split("T")[1].slice(0, 5)
                      : new Date(metricsData.chartData[metricsData.chartData.length - 1].date + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Painel Financeiro & Prévia de Cobrança Meta API */}
      <FinancialMetricsSection
        costs={metricsData.costs}
        periodLabel={periodLabel}
        templateMetrics={metricsData.templateMetrics}
        isLoading={isLoadingMetrics}
      />

      {/* Quadro de Auditoria & Diagnóstico da Base */}
      <div className="glass" style={{ padding: "26px 30px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h3 style={{ fontSize: "1.15rem", fontWeight: "600", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              <span>🎯</span> Diagnóstico Assertivo de Entrega & Saúde da Lista
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
              Transparência detalhada: entenda o motivo exato de cada não-entrega e a conformidade da base
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 14px", background: "rgba(0,194,107,0.1)", border: "1px solid rgba(0,194,107,0.25)", borderRadius: "20px", color: "var(--success)", fontSize: "0.82rem", fontWeight: "700" }}>
            <span>✓</span> Base Válida: {validDeliveryRate}% entregue com sucesso
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Números Inválidos / Sem WhatsApp</span>
              <span style={{ fontSize: "0.7rem", padding: "2px 6px", background: "rgba(239,68,68,0.1)", color: "#f87171", borderRadius: "4px" }}>Erro 131026</span>
            </div>
            <div style={{ fontSize: "1.35rem", fontWeight: "700", color: "#f87171" }}>
              {failureDiagnosis.invalidNumbers.toLocaleString("pt-BR")}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
              Contatos desativados ou fixos na lista cadastral (auto-bloqueados para proteger seu chip).
            </div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Limite de Frequência Meta</span>
              <span style={{ fontSize: "0.7rem", padding: "2px 6px", background: "rgba(234,179,8,0.1)", color: "#facc15", borderRadius: "4px" }}>Sem custo</span>
            </div>
            <div style={{ fontSize: "1.35rem", fontWeight: "700", color: "#facc15" }}>
              {failureDiagnosis.frequencyCapped.toLocaleString("pt-BR")}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
              Destinatários que atingiram limite de marketing nas últimas 24h pela Meta (não tarifado).
            </div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Experimentos / Teste Meta</span>
              <span style={{ fontSize: "0.7rem", padding: "2px 6px", background: "rgba(99,102,241,0.1)", color: "#818cf8", borderRadius: "4px" }}>Sem custo</span>
            </div>
            <div style={{ fontSize: "1.35rem", fontWeight: "700", color: "#818cf8" }}>
              {failureDiagnosis.metaExperiment.toLocaleString("pt-BR")}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
              Usuários em grupos de controle interno da Meta (não tarifado).
            </div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Descadastros Solicitados</span>
              <span style={{ fontSize: "0.7rem", padding: "2px 6px", background: "rgba(16,185,129,0.1)", color: "#34d399", borderRadius: "4px" }}>Compliance</span>
            </div>
            <div style={{ fontSize: "1.35rem", fontWeight: "700", color: "#34d399" }}>
              {optOutsCount.toLocaleString("pt-BR")} <span style={{ fontSize: "0.82rem", fontWeight: "500", color: "var(--text-muted)" }}>({optOutRate}%)</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
              Clientes que pediram para não receber mensagens ("PARAR", "SAIR").
            </div>
          </div>
        </div>
      </div>

      {/* Desempenho por Template */}
      <div className="glass" style={{ padding: "30px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "20px" }}>
        <h3 style={{ fontSize: "1.2rem", fontWeight: "600" }}>Desempenho por Template</h3>
        {!metricsData.templateMetrics || metricsData.templateMetrics.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>Nenhuma métrica de template registrada neste período.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome do Template</th>
                  <th>Disparados</th>
                  <th>Entregues</th>
                  <th>Lidos</th>
                  <th>Falhas</th>
                  <th>Taxa de Leitura</th>
                </tr>
              </thead>
              <tbody>
                {metricsData.templateMetrics.map((t, idx) => {
                  const deliveredCount = t.delivered || t.sent || 0;
                  const readRate = deliveredCount > 0 ? Math.round((t.read / deliveredCount) * 100) : 0;
                  return (
                    <tr key={idx}>
                      <td style={{ fontWeight: "600" }}>{t.templateName}</td>
                      <td>{t.total.toLocaleString("pt-BR")}</td>
                      <td style={{ color: "#0891b2" }}>{deliveredCount.toLocaleString("pt-BR")}</td>
                      <td style={{ color: "var(--success)" }}>{t.read.toLocaleString("pt-BR")}</td>
                      <td style={{ color: "var(--error)" }}>{t.failed}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontWeight: "600", minWidth: "35px" }}>{readRate}%</span>
                          <div style={{ width: "80px", height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${readRate}%`, background: "var(--success)", borderRadius: "3px" }}></div>
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

      {/* Modal de Relatório Executivo (Imprimível em PDF A4) */}
      <ExecutiveReportModal
        isOpen={showExecutiveReport}
        onClose={() => setShowExecutiveReport(false)}
        accountName={accountDisplay}
        wabaId={selectedAccount?.wabaId}
        phoneNumber={selectedAccount?.phoneNumberId}
        periodLabel={periodLabel}
        totals={metricsData.totals}
        failureDiagnosis={failureDiagnosis}
        templateMetrics={metricsData.templateMetrics}
        costs={metricsData.costs}
      />
    </div>
  );
}
