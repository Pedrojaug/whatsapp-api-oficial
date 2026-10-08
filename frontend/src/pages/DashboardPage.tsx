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
import { formatBRL } from "../utils/pricing";
import { RefreshCw } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utilidade",
  AUTHENTICATION: "Autenticação",
  SERVICE: "Atendimento",
};

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

  const totalDelivered = metricsData.totals.delivered;
  const totalRead = metricsData.totals.read;
  const totalFailed = metricsData.totals.failed;
  const totalAll = metricsData.totals.total;
  const totalReplies = metricsData.totals.uniqueReplies ?? metricsData.totals.replies ?? 0;

  const countAll = useCountup(totalAll);
  const countDelivered = useCountup(totalDelivered);
  const countRead = useCountup(totalRead);
  const countReplies = useCountup(totalReplies);

  // Taxas com o mesmo denominador do WhatsApp: entrega sobre enviadas; leitura e resposta sobre entregues.
  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
  const deliveryRate = pct(totalDelivered, totalAll);
  const readRate = pct(totalRead, totalDelivered);
  const responseRate = metricsData.totals.responseRate ?? pct(totalReplies, totalDelivered);

  // Sem diagnóstico do backend, as falhas ficam como "não classificadas" (nada de divisão estimada).
  const failureDiagnosis = metricsData.failureDiagnosis ?? {
    invalidNumbers: 0,
    frequencyCapped: 0,
    metaExperiment: 0,
    other: totalFailed,
  };
  const optOutsCount = metricsData.totals.optOuts ?? 0;
  const optOutRate = metricsData.totals.optOutRate ?? 0;

  const costs = metricsData.costs;
  const periodSpentBrl: number = costs?.period?.totalSpentBrl ?? 0;
  const monthSpentBrl: number = costs?.billingForecast?.currentMonthSpentBrl ?? periodSpentBrl;
  const monthForecastBrl: number = costs?.billingForecast?.totalForecastMonthBrl ?? monthSpentBrl;
  const nextBilling: string = (costs?.billingForecast?.nextBillingEstimate || "Fechamento mensal da Meta").replace(/\s*\(.*\)\s*$/, "");
  const costByTemplate = new Map<string, { category: string; totalCostBrl: number }>(
    (costs?.templateCosts || []).map((t: { templateName: string; category: string; totalCostBrl: number }) => [t.templateName, { category: t.category, totalCostBrl: t.totalCostBrl }])
  );

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

  const exportXlsx = async () => {
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
        a.download = `metricas_${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        showAlert("Relatório de métricas exportado.", "success");
      }
    } catch {
      showAlert("Erro ao exportar a planilha.", "error");
    } finally {
      setExportingXlsx(false);
    }
  };

  const kpis = [
    { label: "Enviadas", value: countAll.toLocaleString("pt-BR"), detail: totalFailed > 0 ? `${totalFailed.toLocaleString("pt-BR")} falharam` : "Nenhuma falha", detailTone: totalFailed > 0 ? "error" : undefined },
    { label: "Entregues", value: countDelivered.toLocaleString("pt-BR"), detail: `${deliveryRate}% das enviadas` },
    { label: "Lidas", value: countRead.toLocaleString("pt-BR"), detail: `${readRate}% das entregues` },
    { label: "Responderam", value: countReplies.toLocaleString("pt-BR"), detail: `${responseRate}% das entregues` },
    { label: "Investimento", value: formatBRL(periodSpentBrl), detail: `Previsão do mês: ${formatBRL(monthForecastBrl)}` },
  ];

  const deliveryHealth = [
    { label: "Números sem WhatsApp", value: failureDiagnosis.invalidNumbers, hint: "Erro 131026 da Meta. Remova esses contatos das listas." },
    { label: "Limite de frequência da Meta", value: failureDiagnosis.frequencyCapped, hint: "O contato já recebeu marketing demais nas últimas 24 h." },
    { label: "Experimento da Meta", value: failureDiagnosis.metaExperiment, hint: "Contato em grupo de controle da Meta." },
    { label: "Outras falhas", value: failureDiagnosis.other ?? 0, hint: "Falhas sem motivo classificado." },
  ];

  const formatAxisDate = (date: string) =>
    date.includes("T")
      ? date.split("T")[1].slice(0, 5)
      : new Date(date + "T00:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
  const formatTick = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v));

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      {/* ── Cabeçalho: título, período e exportação ── */}
      <div className="page-header" style={{ alignItems: "center" }}>
        <div>
          <h1 className="page-heading">Painel de métricas</h1>
          <p className="page-subheading">{accountDisplay} · {periodLabel}</p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
          <div className="segmented" role="radiogroup" aria-label="Período">
            {(["today", "yesterday", "7days", "30days", "custom"] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={metricsPeriod === p}
                className="segmented__option"
                onClick={() => setMetricsPeriod(p)}
              >
                {{ today: "Hoje", yesterday: "Ontem", "7days": "7 dias", "30days": "30 dias", custom: "Período" }[p]}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setShowExecutiveReport(true)} className="btn btn-secondary btn-sm">
            Relatório PDF
          </button>
          <button type="button" disabled={exportingXlsx} onClick={exportXlsx} className="btn btn-secondary btn-sm">
            {exportingXlsx ? "Exportando..." : "Planilha"}
          </button>
          <button
            type="button"
            className="icon-action"
            aria-label="Atualizar métricas"
            title="Atualizar métricas"
            onClick={() => {
              if (isDemoAccount) showAlert("Métricas atualizadas.", "success");
              else if (selectedAccount) fetchMetrics(selectedAccount.id);
            }}
          >
            <RefreshCw size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      {metricsPeriod === "custom" && (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <label htmlFor="metrics-start" style={{ fontSize: "var(--fs-sm)", color: "var(--text-secondary)" }}>De</label>
          <input id="metrics-start" type="date" value={metricsStartDate} onChange={(e) => setMetricsStartDate(e.target.value)} className="field-input" style={{ width: "auto" }} />
          <label htmlFor="metrics-end" style={{ fontSize: "var(--fs-sm)", color: "var(--text-secondary)" }}>até</label>
          <input id="metrics-end" type="date" value={metricsEndDate} onChange={(e) => setMetricsEndDate(e.target.value)} className="field-input" style={{ width: "auto" }} />
        </div>
      )}

      {/* ── Indicadores ── */}
      <div className="kpi-grid" aria-busy={isLoadingMetrics}>
        {kpis.map((k) =>
          isLoadingMetrics ? (
            <div key={k.label} className="skeleton" style={{ height: "96px", borderRadius: "var(--radius-lg)" }} />
          ) : (
            <div key={k.label} className="glass kpi">
              <span className="kpi__label">{k.label}</span>
              <span className="kpi__value">{k.value}</span>
              <span className={`kpi__detail${k.detailTone === "error" ? " kpi__detail--error" : ""}`}>{k.detail}</span>
            </div>
          )
        )}
      </div>

      {/* ── Envios por dia ── */}
      <section className="glass panel" aria-labelledby="chart-title">
        <div className="panel__header">
          <h2 id="chart-title" className="panel__title">Envios por {metricsPeriod === "today" || metricsPeriod === "yesterday" ? "horário" : "dia"}</h2>
          <div className="chart-legend" aria-hidden="true">
            <span><i style={{ background: "var(--primary)" }} /> Enviadas</span>
            <span><i style={{ background: "var(--info)" }} /> Lidas</span>
            <span><i style={{ background: "var(--error)" }} /> Falhas</span>
          </div>
        </div>

        {metricsData.chartData.length === 0 ? (
          <p className="panel__empty">Nenhum envio neste período.</p>
        ) : (() => {
          const maxRaw = Math.max(...metricsData.chartData.map(d => Math.max(d.sent, d.failed)), 10);
          const maxVal = maxRaw <= 10 ? 10 : Math.ceil(maxRaw / 5) * 5;
          const ticks = [1, 0.75, 0.5, 0.25, 0].map((f) => Math.round(maxVal * f));
          const mid = Math.floor(metricsData.chartData.length / 2);

          return (
            <div className="bar-chart">
              <div className="bar-chart__plot">
                <div className="bar-chart__ticks" aria-hidden="true">
                  {ticks.map((t) => <span key={t}>{formatTick(t)}</span>)}
                </div>
                <div className="bar-chart__area">
                  <div className="bar-chart__grid" aria-hidden="true">
                    {ticks.map((t) => <div key={t} />)}
                  </div>
                  <div className="bar-chart__bars">
                    {metricsData.chartData.map((d, index) => {
                      const dayMax = Math.max(d.sent, d.failed);
                      const heightPercent = dayMax > 0 ? (dayMax / maxVal) * 100 : 0;
                      const readPercent = d.sent > 0 ? (d.read / d.sent) * 100 : 0;
                      const label = `${formatAxisDate(d.date)}: ${d.sent.toLocaleString("pt-BR")} enviadas, ${d.read.toLocaleString("pt-BR")} lidas, ${d.failed} falhas`;
                      return (
                        <div key={index} className="bar-chart__group" style={{ height: `${heightPercent}%` }} title={label} aria-label={label} role="img">
                          {d.sent > 0 && (
                            <div className="bar-chart__bar bar-chart__bar--sent">
                              {d.read > 0 && <div className="bar-chart__bar bar-chart__bar--read" style={{ height: `${readPercent}%` }} />}
                            </div>
                          )}
                          {d.failed > 0 && <div className="bar-chart__bar bar-chart__bar--failed" style={{ height: `${(d.failed / dayMax) * 100}%` }} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="bar-chart__axis" aria-hidden="true">
                <span>{formatAxisDate(metricsData.chartData[0].date)}</span>
                {metricsData.chartData.length > 2 && <span>{formatAxisDate(metricsData.chartData[mid].date)}</span>}
                <span>{formatAxisDate(metricsData.chartData[metricsData.chartData.length - 1].date)}</span>
              </div>
            </div>
          );
        })()}
      </section>

      {/* ── Custos e saúde da entrega ── */}
      <div className="panel-grid">
        <section className="glass panel" aria-labelledby="costs-title">
          <div className="panel__header">
            <h2 id="costs-title" className="panel__title">Custos na Meta</h2>
            <span className="panel__hint">Falhas não são cobradas</span>
          </div>
          <dl className="stat-list">
            <div><dt>{periodLabel}</dt><dd>{formatBRL(periodSpentBrl)}</dd></div>
            <div><dt>Gasto no mês</dt><dd>{formatBRL(monthSpentBrl)}</dd></div>
            <div><dt>Previsão do mês</dt><dd>{formatBRL(monthForecastBrl)}</dd></div>
            <div><dt>Próxima cobrança</dt><dd>{nextBilling}</dd></div>
          </dl>
        </section>

        <section className="glass panel" aria-labelledby="health-title">
          <div className="panel__header">
            <h2 id="health-title" className="panel__title">Saúde da entrega</h2>
            <span className="panel__hint">{totalFailed.toLocaleString("pt-BR")} falhas</span>
          </div>
          <dl className="stat-list">
            {deliveryHealth.map((h) => (
              <div key={h.label} title={h.hint}>
                <dt>{h.label}</dt>
                <dd>{h.value.toLocaleString("pt-BR")}</dd>
              </div>
            ))}
            <div title="Contatos que pediram para não receber mais mensagens (PARAR, SAIR).">
              <dt>Descadastros</dt>
              <dd>{optOutsCount.toLocaleString("pt-BR")} <small>({optOutRate}%)</small></dd>
            </div>
          </dl>
        </section>
      </div>

      {/* ── Templates ── */}
      <section className="glass panel" aria-labelledby="templates-title" style={{ padding: 0 }}>
        <div className="panel__header" style={{ padding: "var(--space-5) var(--space-6) 0" }}>
          <h2 id="templates-title" className="panel__title">Templates</h2>
        </div>
        {!metricsData.templateMetrics || metricsData.templateMetrics.length === 0 ? (
          <p className="panel__empty" style={{ padding: "var(--space-6)" }}>Nenhum template enviado neste período.</p>
        ) : (
          <div className="table-container" style={{ borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Template</th>
                  <th scope="col">Categoria</th>
                  <th scope="col" className="num">Entregues</th>
                  <th scope="col" className="num">Leitura</th>
                  <th scope="col" className="num">Falhas</th>
                  <th scope="col" className="num">Custo</th>
                </tr>
              </thead>
              <tbody>
                {metricsData.templateMetrics.map((t) => {
                  const delivered = t.delivered || t.sent || 0;
                  const rate = pct(t.read, delivered);
                  const cost = costByTemplate.get(t.templateName);
                  return (
                    <tr key={t.templateName}>
                      <td style={{ fontWeight: 600 }}>{t.templateName}</td>
                      <td style={{ color: "var(--text-muted)" }}>{cost ? CATEGORY_LABELS[cost.category] ?? cost.category : "—"}</td>
                      <td className="num">{delivered.toLocaleString("pt-BR")}</td>
                      <td className="num">
                        <span className="inline-meter" aria-label={`${rate}% lidas`}>
                          <span className="inline-meter__track"><span style={{ width: `${rate}%` }} /></span>
                          {rate}%
                        </span>
                      </td>
                      <td className="num" style={{ color: t.failed > 0 ? "var(--error)" : "var(--text-muted)" }}>{t.failed.toLocaleString("pt-BR")}</td>
                      <td className="num">{cost ? formatBRL(cost.totalCostBrl) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Referência (recolhida): tarifas, simulador e regras de cobrança ── */}
      <details className="glass panel disclosure">
        <summary>Tarifas da Meta, simulador de custo e regras de cobrança</summary>
        <FinancialMetricsSection
          costs={metricsData.costs}
          periodLabel={periodLabel}
          templateMetrics={metricsData.templateMetrics}
          isLoading={isLoadingMetrics}
          referenceOnly
        />
      </details>

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
