import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API_BASE_URL } from "../contexts/AuthContext";
import { useAlert } from "../contexts/AlertContext";
import {
  Activity,
  Server,
  Database,
  Globe,
  Terminal,
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
  Cpu,
  Radio,
  Flame,
  KeyRound,
  GitCommit,
  Settings2,
  FileText,
  Copy,
  Download,
  Check
} from "lucide-react";

interface MonitoredProject {
  id: string;
  name: string;
  category: "API" | "FRONTEND" | "DATABASE" | "WORKER" | "WEBHOOK" | "EXTERNAL";
  url: string;
  domain?: string;
  status: "ONLINE" | "DEGRADED" | "OFFLINE" | "CHECKING";
  latencyMs: number;
  lastCheckedAt?: string;
  statusCode?: number;
  ssl?: {
    valid: boolean;
    issuer: string;
    validTo: string;
    daysRemaining: number;
  };
  details?: string;
  isCore?: boolean;
}

interface TelemetryOverview {
  totalRequests: number;
  totalErrors: number;
  errorRatePercent: number;
  rpm: number;
  uptimeSeconds: number;
  latencies: {
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
  };
  statusCodes: Record<string, number>;
}

interface RouteStat {
  route: string;
  method: string;
  totalCalls: number;
  totalDurationMs: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  p95DurationMs: number;
  errorCalls: number;
  lastCalledAt: string;
}

interface RequestRecord {
  id: string;
  method: string;
  path: string;
  route: string;
  statusCode: number;
  durationMs: number;
  timestamp: string;
  ip: string;
  userAgent?: string;
  errorMessage?: string;
}

interface DbHealth {
  status: "HEALTHY" | "DEGRADED" | "DOWN";
  latencyMs: number;
  serverTime: string;
  tables: { name: string; estimatedRows: number }[];
  connectionPool: {
    status: string;
    databaseName: string;
  };
}

interface DeployRecord {
  id: string;
  projectName: string;
  environment: string;
  commitHash: string;
  commitMessage: string;
  branch: string;
  status: "SUCCESS" | "BUILDING" | "FAILED";
  deployedAt: string;
  durationSeconds?: number;
  author?: string;
}

interface ProcessStats {
  nodeVersion: string;
  platform: string;
  arch: string;
  pid: number;
  uptimeSeconds: number;
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
    externalMb: number;
  };
  env: string;
}

export default function OpsDashboardPage() {
  const { showAlert } = useAlert();
  const [activeTab, setActiveTab] = useState<"projects" | "routes" | "database" | "deploys">("projects");
  const [loading, setLoading] = useState(true);
  const [isProbing, setIsProbing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Dados consolidados
  const [healthScore, setHealthScore] = useState<number>(100);
  const [projects, setProjects] = useState<MonitoredProject[]>([]);
  const [dbHealth, setDbHealth] = useState<DbHealth | null>(null);
  const [telemetry, setTelemetry] = useState<{
    overview: TelemetryOverview;
    minuteTimeline: { minute: string; requestCount: number; errorCount: number; avgDurationMs: number }[];
    slowestRoutes: RouteStat[];
    mostCalledRoutes: RouteStat[];
    recentRequests: RequestRecord[];
    recentErrors: RequestRecord[];
  } | null>(null);
  const [processStats, setProcessStats] = useState<ProcessStats | null>(null);
  const [deploys, setDeploys] = useState<DeployRecord[]>([]);

  // Modal para adicionar projeto
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [newProject, setNewProject] = useState({
    name: "",
    category: "API" as const,
    url: "",
    domain: ""
  });
  const [isSavingProject, setIsSavingProject] = useState(false);

  // Integração CI/CD (GitHub, Render, Vercel)
  const [ciCdData, setCiCdData] = useState<{
    github: { connected: boolean; commits: any[] };
    render: { connected: boolean; deploys: any[]; message?: string };
    vercel: { connected: boolean; deployments: any[]; message?: string };
    config: {
      githubRepo: string;
      hasGithubToken: boolean;
      hasRenderKey: boolean;
      renderServiceId: string;
      hasVercelToken: boolean;
      vercelProjectId: string;
    };
  } | null>(null);

  const [showCiCdModal, setShowCiCdModal] = useState(false);
  const [ciCdForm, setCiCdForm] = useState({
    githubRepo: "Pedrojaug/whatsapp-api-oficial",
    githubToken: "",
    renderApiKey: "",
    renderServiceId: "srv-cv7cndre9etc73c9q7jg",
    vercelToken: "",
    vercelProjectId: ""
  });
  const [isSavingCiCd, setIsSavingCiCd] = useState(false);

  const fetchCiCdData = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE_URL}/admin/ops/ci-cd`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data) {
        setCiCdData(res.data);
        if (res.data.config) {
          setCiCdForm((prev) => ({
            ...prev,
            githubRepo: res.data.config.githubRepo || prev.githubRepo,
            renderServiceId: res.data.config.renderServiceId || prev.renderServiceId,
            vercelProjectId: res.data.config.vercelProjectId || prev.vercelProjectId
          }));
        }
      }
    } catch (e) {
      console.warn("Erro ao buscar CI/CD:", e);
    }
  }, []);

  const handleSaveCiCdConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCiCd(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API_BASE_URL}/admin/ops/ci-cd/config`, ciCdForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowCiCdModal(false);
      showAlert("Configurações de CI/CD atualizadas com sucesso!", "success");
      fetchCiCdData();
    } catch (err: any) {
      showAlert(`Erro ao salvar configurações: ${err.message}`, "error");
    } finally {
      setIsSavingCiCd(false);
    }
  };

  // Estados e Ações para o Relatório Consolidado de Diagnóstico
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMarkdown, setReportMarkdown] = useState("");
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isReportCopied, setIsReportCopied] = useState(false);

  const handleOpenReport = async () => {
    setIsLoadingReport(true);
    setShowReportModal(true);
    setIsReportCopied(false);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE_URL}/admin/ops/report`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data && res.data.markdown) {
        setReportMarkdown(res.data.markdown);
      }
    } catch (err: any) {
      showAlert("Erro ao gerar relatório: " + (err.response?.data?.error || err.message), "error");
    } finally {
      setIsLoadingReport(false);
    }
  };

  const handleCopyReport = async () => {
    if (!reportMarkdown) return;
    try {
      await navigator.clipboard.writeText(reportMarkdown);
      setIsReportCopied(true);
      showAlert("Relatório copiado para a área de transferência! Cole aqui na conversa.", "success");
      setTimeout(() => setIsReportCopied(false), 3000);
    } catch {
      showAlert("Erro ao copiar automaticamente para a área de transferência.", "error");
    }
  };

  const handleDownloadReport = () => {
    if (!reportMarkdown) return;
    const blob = new Blob([reportMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `relatorio-saude-send-${dateStr}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showAlert("Download do relatório concluído!", "success");
  };

  const fetchOpsData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE_URL}/admin/ops/overview`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data) {
        setHealthScore(res.data.systemHealthScore || 100);
        setProjects(res.data.projects || []);
        setDbHealth(res.data.database || null);
        setTelemetry(res.data.telemetry || null);
        setProcessStats(res.data.process || null);
        setDeploys(res.data.deploys || []);
        setLastUpdated(new Date());
      }
    } catch (err: any) {
      if (!silent) {
        showAlert(`Erro ao carregar telemetria: ${err.response?.data?.error || err.message}`, "error");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    fetchOpsData();
  }, [fetchOpsData]);

  useEffect(() => {
    if (activeTab === "deploys") {
      fetchCiCdData();
    }
  }, [activeTab, fetchCiCdData]);

  // Polling automático a cada 6 segundos se autoRefresh estiver ativado
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchOpsData(true);
    }, 6000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchOpsData]);

  // Forçar sondagem e ping imediato
  const handleProbeAll = async () => {
    setIsProbing(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API_BASE_URL}/admin/ops/probe`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchOpsData(true);
      showAlert("Sondagem completa executada com sucesso!", "success");
    } catch (err: any) {
      showAlert(`Falha ao executar sondagem: ${err.message}`, "error");
    } finally {
      setIsProbing(false);
    }
  };

  // Criar novo projeto monitorado
  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name.trim() || !newProject.url.trim()) {
      showAlert("Preencha o nome e a URL do projeto.", "error");
      return;
    }

    setIsSavingProject(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API_BASE_URL}/admin/ops/projects`, newProject, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowAddProjectModal(false);
      setNewProject({ name: "", category: "API", url: "", domain: "" });
      showAlert("Projeto adicionado ao monitoramento!", "success");
      fetchOpsData(true);
    } catch (err: any) {
      showAlert(`Erro ao adicionar projeto: ${err.response?.data?.error || err.message}`, "error");
    } finally {
      setIsSavingProject(false);
    }
  };

  // Remover projeto customizado
  const handleDeleteProject = async (id: string, name: string) => {
    if (!confirm(`Deseja remover "${name}" do monitoramento de projetos?`)) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE_URL}/admin/ops/projects/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showAlert(`Projeto "${name}" removido.`, "success");
      fetchOpsData(true);
    } catch (err: any) {
      showAlert(err.response?.data?.error || err.message, "error");
    }
  };

  // Limpar telemetria
  const handleClearTelemetry = async () => {
    if (!confirm("Tem certeza que deseja zerar os contadores e estatísticas de telemetria das rotas?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API_BASE_URL}/admin/ops/clear-telemetry`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showAlert("Métricas de rotas reiniciadas.", "success");
      fetchOpsData(true);
    } catch (err: any) {
      showAlert(err.message, "error");
    }
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  return (
    <div className="page-container" style={{ maxWidth: "1400px", margin: "0 auto", padding: "20px 24px" }}>
      {/* Header com Status Global e Controles */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span style={{ fontSize: "1.6rem" }}>⚡</span>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
              Mission Control <span style={{ color: "var(--primary)", fontWeight: 400 }}>| Dev & Infra Ops</span>
            </h1>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", margin: 0 }}>
            Central de Observabilidade, Telemetria APM de Rotas, Banco de Dados, Domínios e Deploys de Projetos.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {/* Toggle Auto-Refresh */}
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="btn btn-secondary"
            style={{
              fontSize: "0.8rem",
              padding: "7px 12px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              borderColor: autoRefresh ? "rgba(16, 185, 129, 0.4)" : undefined,
              color: autoRefresh ? "var(--primary)" : "var(--text-muted)"
            }}
            title={autoRefresh ? "Atualização ao vivo ativa (a cada 6s)" : "Atualização pausada"}
          >
            <Radio size={14} className={autoRefresh ? "pulse" : ""} />
            {autoRefresh ? "Ao Vivo (6s)" : "Pausado"}
          </button>

          {/* Botão Sondagem / Ping Imediato */}
          <button
            type="button"
            onClick={handleProbeAll}
            disabled={isProbing || loading}
            className="btn btn-primary"
            style={{ fontSize: "0.82rem", padding: "7px 14px", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <RefreshCw size={14} className={isProbing ? "spin" : ""} />
            {isProbing ? "Testando Serviços..." : "Executar Ping Geral"}
          </button>

          {/* Botão Gerar Relatório de Diagnóstico */}
          <button
            type="button"
            onClick={handleOpenReport}
            className="btn btn-secondary"
            style={{
              fontSize: "0.82rem",
              padding: "7px 14px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              borderColor: "rgba(99, 102, 241, 0.4)",
              background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15))",
              color: "#c7d2fe",
              fontWeight: 600
            }}
            title="Gerar relatório consolidado de saúde em Markdown para enviar à IA ou equipe"
          >
            <FileText size={15} color="#818cf8" />
            Gerar Relatório Técnico
          </button>

          {/* Última atualização */}
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
            Atualizado: {lastUpdated.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* 4 Cards de Métricas Principais (Health Score, Neon Ping, APM RPM, Domínios) */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: "16px",
        marginBottom: "24px"
      }}>
        {/* Card 1: Índice de Saúde Geral */}
        <div style={{
          background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(17, 24, 39, 0.6) 100%)",
          border: `1px solid ${healthScore > 90 ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
          borderRadius: "14px",
          padding: "18px 20px",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Saúde do Ecossistema
            </span>
            <Activity size={18} color={healthScore > 90 ? "var(--primary)" : "#f59e0b"} />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "10px" }}>
            <span style={{ fontSize: "2rem", fontWeight: 800, color: healthScore > 90 ? "var(--primary)" : "#f59e0b" }}>
              {healthScore}%
            </span>
            <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
              {healthScore > 90 ? "Todos os sistemas operacionais" : "Atenção a serviços degradados"}
            </span>
          </div>
          {/* Barra de progresso */}
          <div style={{ width: "100%", height: "6px", background: "rgba(255, 255, 255, 0.1)", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{
              width: `${healthScore}%`,
              height: "100%",
              background: healthScore > 90 ? "linear-gradient(90deg, #10b981, #059669)" : "linear-gradient(90deg, #f59e0b, #ef4444)",
              transition: "width 0.4s ease"
            }} />
          </div>
        </div>

        {/* Card 2: Banco de Dados Neon */}
        <div style={{
          background: "linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(17, 24, 39, 0.6) 100%)",
          border: `1px solid ${dbHealth?.status === "HEALTHY" ? "rgba(59, 130, 246, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
          borderRadius: "14px",
          padding: "18px 20px",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Neon PostgreSQL Ping
            </span>
            <Database size={18} color="#60a5fa" />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "8px" }}>
            <span style={{ fontSize: "2rem", fontWeight: 800, color: "#60a5fa" }}>
              {dbHealth ? `${dbHealth.latencyMs} ms` : "..."}
            </span>
            <span style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: "12px",
              background: dbHealth?.status === "HEALTHY" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
              color: dbHealth?.status === "HEALTHY" ? "#34d399" : "#f87171"
            }}>
              {dbHealth?.status === "HEALTHY" ? "Excelente" : dbHealth?.status || "Conectando"}
            </span>
          </div>
          <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
            <span>Pool: {dbHealth?.connectionPool.status || "Ativo"}</span>
            <span>Banco: {dbHealth?.connectionPool.databaseName || "neondb"}</span>
          </div>
        </div>

        {/* Card 3: Backend & Throughput (APM) */}
        <div style={{
          background: "linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(17, 24, 39, 0.6) 100%)",
          border: "1px solid rgba(168, 85, 247, 0.3)",
          borderRadius: "14px",
          padding: "18px 20px",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Requisições / Minuto (RPM)
            </span>
            <Flame size={18} color="#c084fc" />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "8px" }}>
            <span style={{ fontSize: "2rem", fontWeight: 800, color: "#c084fc" }}>
              {telemetry ? telemetry.overview.rpm : 0}
            </span>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              p95: {telemetry ? `${telemetry.overview.latencies.p95Ms}ms` : "0ms"}
            </span>
          </div>
          <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
            <span>Total: {telemetry?.overview.totalRequests.toLocaleString() || 0} reqs</span>
            <span style={{ color: (telemetry?.overview.errorRatePercent || 0) > 1 ? "#f87171" : "var(--primary)" }}>
              Erros: {telemetry?.overview.errorRatePercent || 0}%
            </span>
          </div>
        </div>

        {/* Card 4: Runtime & Host Node.js */}
        <div style={{
          background: "linear-gradient(135deg, rgba(234, 179, 8, 0.08) 0%, rgba(17, 24, 39, 0.6) 100%)",
          border: "1px solid rgba(234, 179, 8, 0.3)",
          borderRadius: "14px",
          padding: "18px 20px",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Processo / Host Node.js
            </span>
            <Cpu size={18} color="#facc15" />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "8px" }}>
            <span style={{ fontSize: "2rem", fontWeight: 800, color: "#facc15" }}>
              {processStats ? `${processStats.memory.heapUsedMb} MB` : "..."}
            </span>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              RSS: {processStats?.memory.rssMb || 0} MB
            </span>
          </div>
          <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
            <span>Uptime: {processStats ? formatUptime(processStats.uptimeSeconds) : "..."}</span>
            <span>{processStats?.nodeVersion} ({processStats?.platform})</span>
          </div>
        </div>
      </div>

      {/* Navegação por Abas (Projetos & Domínios, Backend & Rotas APM, Banco Neon, Deploys) */}
      <div style={{
        display: "flex",
        gap: "8px",
        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        marginBottom: "20px",
        overflowX: "auto"
      }}>
        <button
          type="button"
          onClick={() => setActiveTab("projects")}
          style={{
            padding: "10px 18px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "projects" ? "3px solid var(--primary)" : "3px solid transparent",
            color: activeTab === "projects" ? "var(--primary)" : "var(--text-secondary)",
            fontWeight: 700,
            fontSize: "0.88rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <Globe size={16} /> Projetos & Domínios ({projects.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("routes")}
          style={{
            padding: "10px 18px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "routes" ? "3px solid var(--primary)" : "3px solid transparent",
            color: activeTab === "routes" ? "var(--primary)" : "var(--text-secondary)",
            fontWeight: 700,
            fontSize: "0.88rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <Terminal size={16} /> Backend & Rotas (APM)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("database")}
          style={{
            padding: "10px 18px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "database" ? "3px solid var(--primary)" : "3px solid transparent",
            color: activeTab === "database" ? "var(--primary)" : "var(--text-secondary)",
            fontWeight: 700,
            fontSize: "0.88rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <Database size={16} /> Banco Neon PostgreSQL
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("deploys")}
          style={{
            padding: "10px 18px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "deploys" ? "3px solid var(--primary)" : "3px solid transparent",
            color: activeTab === "deploys" ? "var(--primary)" : "var(--text-secondary)",
            fontWeight: 700,
            fontSize: "0.88rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <Server size={16} /> Deploys & CI/CD ({deploys.length})
        </button>
      </div>

      {/* ABA 1: PROJETOS & DOMÍNIOS */}
      {activeTab === "projects" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 4px 0" }}>Projetos e Endpoints Monitorados</h2>
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: 0 }}>
                Status em tempo real de latência, códigos HTTP e validade dos certificados SSL.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddProjectModal(true)}
              className="btn btn-primary"
              style={{ fontSize: "0.82rem", padding: "6px 14px", display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Plus size={15} /> Adicionar Novo Projeto
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
            {projects.map((proj) => {
              const isOnline = proj.status === "ONLINE";
              const isDegraded = proj.status === "DEGRADED";

              return (
                <div
                  key={proj.id}
                  style={{
                    background: "rgba(17, 24, 39, 0.7)",
                    border: `1px solid ${isOnline ? "rgba(16, 185, 129, 0.25)" : isDegraded ? "rgba(245, 158, 11, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                    borderRadius: "12px",
                    padding: "16px 18px",
                    position: "relative",
                    backdropFilter: "blur(8px)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{
                          width: "9px",
                          height: "9px",
                          borderRadius: "50%",
                          background: isOnline ? "#10b981" : isDegraded ? "#f59e0b" : "#ef4444",
                          boxShadow: `0 0 10px ${isOnline ? "#10b981" : isDegraded ? "#f59e0b" : "#ef4444"}`
                        }} />
                        <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>{proj.name}</h3>
                      </div>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginLeft: "17px" }}>
                        {proj.category}
                      </span>
                    </div>

                    <span style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "10px",
                      background: isOnline ? "rgba(16, 185, 129, 0.15)" : isDegraded ? "rgba(245, 158, 11, 0.15)" : "rgba(239, 68, 68, 0.15)",
                      color: isOnline ? "#34d399" : isDegraded ? "#fde047" : "#fca5a5"
                    }}>
                      {proj.status}
                    </span>
                  </div>

                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "12px", wordBreak: "break-all" }}>
                    <a
                      href={proj.url.startsWith("http") ? proj.url : `https://${proj.url}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: "4px", textDecoration: "none" }}
                    >
                      {proj.domain || proj.url} <ExternalLink size={12} />
                    </a>
                  </div>

                  {/* Informações de Latência e Detalhes */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255, 255, 255, 0.03)", padding: "8px 12px", borderRadius: "8px", marginBottom: "10px", fontSize: "0.76rem" }}>
                    <span>Latência de Ping:</span>
                    <strong style={{ color: proj.latencyMs < 150 ? "var(--primary)" : "#f59e0b" }}>
                      {proj.latencyMs > 0 ? `${proj.latencyMs} ms` : "..."}
                    </strong>
                  </div>

                  {/* Certificado SSL */}
                  {proj.ssl && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.74rem", color: "var(--text-muted)", marginBottom: "10px", padding: "0 4px" }}>
                      <span>SSL ({proj.ssl.issuer.split(" ")[0]}):</span>
                      <span style={{ color: proj.ssl.daysRemaining > 15 ? "#34d399" : "#f87171", fontWeight: 600 }}>
                        🔒 {proj.ssl.daysRemaining} dias restantes
                      </span>
                    </div>
                  )}

                  {/* Rodapé do Card */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", paddingTop: "8px", borderTop: "1px solid rgba(255, 255, 255, 0.06)", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                    <span>{proj.details || "Operação nominal"}</span>
                    {!proj.isCore && (
                      <button
                        type="button"
                        onClick={() => handleDeleteProject(proj.id, proj.name)}
                        style={{ background: "none", border: "none", color: "var(--error)", cursor: "pointer", padding: "2px 6px" }}
                        title="Remover projeto"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ABA 2: BACKEND & ROTAS (APM TELEMETRY) */}
      {activeTab === "routes" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 4px 0" }}>Desempenho de Rotas & Tráfego (APM)</h2>
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: 0 }}>
                Métricas em tempo real de latência por endpoint, percentis P95/P99 e feed de requisições.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearTelemetry}
              className="btn btn-secondary"
              style={{ fontSize: "0.8rem", padding: "5px 12px" }}
            >
              🧹 Zerar Métricas de Rotas
            </button>
          </div>

          {/* Gráfico de Linha do Tempo dos Últimos 30 Minutos */}
          {telemetry && telemetry.minuteTimeline.length > 0 && (
            <div style={{
              background: "rgba(17, 24, 39, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "12px",
              padding: "16px 20px",
              marginBottom: "20px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>
                  Volume de Requisições por Minuto (Últimos 30m)
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Pico: {Math.max(...telemetry.minuteTimeline.map(m => m.requestCount), 1)} req/min
                </span>
              </div>

              {/* Visualização de barras de minutos */}
              <div style={{ display: "flex", alignItems: "flex-end", height: "80px", gap: "4px", padding: "4px 0" }}>
                {telemetry.minuteTimeline.map((item, idx) => {
                  const max = Math.max(...telemetry.minuteTimeline.map(m => m.requestCount), 1);
                  const heightPercent = Math.max(6, Math.round((item.requestCount / max) * 100));
                  const hasErrors = item.errorCount > 0;

                  return (
                    <div
                      key={idx}
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        height: "100%",
                        justifyContent: "flex-end"
                      }}
                      title={`${item.minute}: ${item.requestCount} requisições (${item.errorCount} erros) | Média: ${item.avgDurationMs}ms`}
                    >
                      <div style={{
                        width: "100%",
                        height: `${heightPercent}%`,
                        background: hasErrors
                          ? "linear-gradient(180deg, #ef4444 0%, rgba(239,68,68,0.3) 100%)"
                          : item.requestCount > 0
                            ? "linear-gradient(180deg, #10b981 0%, rgba(16,185,129,0.2) 100%)"
                            : "rgba(255,255,255,0.05)",
                        borderRadius: "2px",
                        transition: "height 0.3s ease"
                      }} />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "4px" }}>
                <span>-30m</span>
                <span>-15m</span>
                <span>Agora</span>
              </div>
            </div>
          )}

          {/* Tabela de Rotas Mais Lentas (Top 10) */}
          <div style={{
            background: "rgba(17, 24, 39, 0.7)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            padding: "16px 20px",
            marginBottom: "20px"
          }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 12px 0" }}>
              Top 10 Rotas Mais Lentas & Frequência
            </h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", textAlign: "left" }}>
                    <th style={{ padding: "8px 10px" }}>Método</th>
                    <th style={{ padding: "8px 10px" }}>Rota</th>
                    <th style={{ padding: "8px 10px" }}>Chamadas</th>
                    <th style={{ padding: "8px 10px" }}>Latência Média</th>
                    <th style={{ padding: "8px 10px" }}>P95</th>
                    <th style={{ padding: "8px 10px" }}>Erros</th>
                  </tr>
                </thead>
                <tbody>
                  {telemetry?.slowestRoutes.map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: r.method === "GET" ? "rgba(16, 185, 129, 0.15)" : r.method === "POST" ? "rgba(59, 130, 246, 0.15)" : "rgba(245, 158, 11, 0.15)",
                          color: r.method === "GET" ? "#34d399" : r.method === "POST" ? "#60a5fa" : "#fde047"
                        }}>
                          {r.method}
                        </span>
                      </td>
                      <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "var(--text-primary)" }}>{r.route}</td>
                      <td style={{ padding: "8px 10px" }}>{r.totalCalls}</td>
                      <td style={{ padding: "8px 10px", fontWeight: 600, color: r.avgDurationMs > 300 ? "#f87171" : r.avgDurationMs > 100 ? "#fde047" : "var(--primary)" }}>
                        {r.avgDurationMs} ms
                      </td>
                      <td style={{ padding: "8px 10px", color: "var(--text-secondary)" }}>{r.p95DurationMs} ms</td>
                      <td style={{ padding: "8px 10px", color: r.errorCalls > 0 ? "#f87171" : "var(--text-muted)" }}>
                        {r.errorCalls}
                      </td>
                    </tr>
                  ))}
                  {(!telemetry || telemetry.slowestRoutes.length === 0) && (
                    <tr>
                      <td colSpan={6} style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)" }}>
                        Nenhuma rota registrada ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Terminal / Live Request Feed */}
          <div style={{
            background: "#090d16",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "12px",
            padding: "16px 20px",
            fontFamily: "monospace"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ef4444" }} />
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f59e0b" }} />
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981" }} />
                <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginLeft: "6px" }}>
                  Live Request Stream ({telemetry?.recentRequests.length || 0} eventos)
                </span>
              </div>
              <span style={{ fontSize: "0.72rem", color: "var(--primary)" }}>● Streaming ativo</span>
            </div>

            <div style={{ maxHeight: "320px", overflowY: "auto", fontSize: "0.78rem", lineHeight: "1.6" }}>
              {telemetry?.recentRequests.map((req) => {
                const is2xx = req.statusCode >= 200 && req.statusCode < 300;
                const is4xx = req.statusCode >= 400 && req.statusCode < 500;
                const is5xx = req.statusCode >= 500;

                return (
                  <div key={req.id} style={{ display: "flex", gap: "10px", padding: "2px 0", borderBottom: "1px solid rgba(255, 255, 255, 0.02)" }}>
                    <span style={{ color: "rgba(255, 255, 255, 0.4)", minWidth: "75px" }}>
                      {new Date(req.timestamp).toLocaleTimeString()}
                    </span>
                    <span style={{
                      fontWeight: 700,
                      color: is2xx ? "#34d399" : is4xx ? "#f59e0b" : is5xx ? "#f87171" : "#94a3b8",
                      minWidth: "35px"
                    }}>
                      {req.statusCode}
                    </span>
                    <span style={{ color: req.method === "GET" ? "#38bdf8" : "#a855f7", minWidth: "45px" }}>
                      {req.method}
                    </span>
                    <span style={{ color: "#f8fafc", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {req.path}
                    </span>
                    <span style={{ color: req.durationMs > 250 ? "#f59e0b" : "rgba(255, 255, 255, 0.5)", minWidth: "60px", textAlign: "right" }}>
                      {req.durationMs}ms
                    </span>
                  </div>
                );
              })}
              {(!telemetry || telemetry.recentRequests.length === 0) && (
                <div style={{ color: "var(--text-muted)", padding: "10px 0" }}>Aguardando requisições...</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: BANCO DE DADOS NEON */}
      {activeTab === "database" && (
        <div>
          <div style={{ marginBottom: "16px" }}>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 4px 0" }}>Diagnóstico de Banco de Dados Neon PostgreSQL</h2>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: 0 }}>
              Latência de rede, pool de conexões e volumetria de tabelas.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px", marginBottom: "20px" }}>
            {/* Medidor de Latência Neon */}
            <div style={{ background: "rgba(17, 24, 39, 0.7)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "18px 20px" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Latência de Query (`SELECT NOW()`)</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: "10px", margin: "10px 0" }}>
                <span style={{ fontSize: "2.2rem", fontWeight: 800, color: "var(--primary)" }}>
                  {dbHealth?.latencyMs || 0} ms
                </span>
                <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  {dbHealth?.latencyMs && dbHealth.latencyMs < 100 ? "Excelente (Baixa Latência)" : "Normal"}
                </span>
              </div>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0 }}>
                Conectado ao cluster serverless Neon com pooling gerenciado.
              </p>
            </div>

            {/* Status do Pool & Host */}
            <div style={{ background: "rgba(17, 24, 39, 0.7)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "18px 20px" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Instância & Conexão</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px", fontSize: "0.82rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Status do Pool:</span>
                  <strong style={{ color: "var(--primary)" }}>{dbHealth?.connectionPool.status}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Database:</span>
                  <span>{dbHealth?.connectionPool.databaseName}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Horário do Servidor:</span>
                  <span>{dbHealth?.serverTime ? new Date(dbHealth.serverTime).toLocaleTimeString() : "..."}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabela de Contagem Estimada de Linhas */}
          <div style={{ background: "rgba(17, 24, 39, 0.7)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "18px 20px" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 12px 0" }}>
              Volumetria de Tabelas Principais (Linhas Estimadas)
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
              {dbHealth?.tables.map((t, idx) => (
                <div key={idx} style={{ background: "rgba(255, 255, 255, 0.03)", padding: "12px 14px", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "4px" }}>{t.name}</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    {t.estimatedRows.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ABA 4: DEPLOYS & CI/CD (GITHUB, RENDER, VERCEL) */}
      {activeTab === "deploys" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
            <div>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 4px 0" }}>Pipeline de Deploys & CI/CD Unificado</h2>
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: 0 }}>
                Acompanhe em tempo real a árvore de commits do GitHub e o status de publicação no Render e na Vercel.
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                type="button"
                onClick={fetchCiCdData}
                className="btn btn-secondary"
                style={{ fontSize: "0.8rem", padding: "6px 12px", display: "flex", alignItems: "center", gap: "6px" }}
              >
                <RefreshCw size={13} /> Atualizar Deploys
              </button>
              <button
                type="button"
                onClick={() => setShowCiCdModal(true)}
                className="btn btn-primary"
                style={{ fontSize: "0.8rem", padding: "6px 14px", display: "flex", alignItems: "center", gap: "6px" }}
              >
                <Settings2 size={14} /> Conectar Chaves (Render / Vercel)
              </button>
            </div>
          </div>

          {/* 3 Colunas: GitHub (Commits), Render (Backend), Vercel (Frontend) */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
            gap: "20px",
            marginBottom: "24px"
          }}>
            {/* COLUNA 1: GITHUB (ÁRVORE DE COMMITS) */}
            <div style={{
              background: "rgba(17, 24, 39, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "14px",
              padding: "18px 20px",
              display: "flex",
              flexDirection: "column"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <GitCommit size={18} color="#a855f7" />
                  <strong style={{ fontSize: "0.95rem" }}>GitHub — Árvore de Commits</strong>
                </div>
                <span style={{ fontSize: "0.72rem", background: "rgba(168, 85, 247, 0.15)", color: "#c084fc", padding: "2px 8px", borderRadius: "10px", fontWeight: 600 }}>
                  branch: main
                </span>
              </div>

              {/* Lista com Árvore de Commits */}
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", maxHeight: "480px", overflowY: "auto", position: "relative", paddingLeft: "10px" }}>
                {ciCdData?.github.commits.map((c, i) => (
                  <div key={c.sha || i} style={{ display: "flex", gap: "12px", position: "relative" }}>
                    {/* Linha vertical conectando a árvore */}
                    {i < (ciCdData?.github.commits.length || 0) - 1 && (
                      <div style={{
                        position: "absolute",
                        left: "6px",
                        top: "16px",
                        bottom: "-14px",
                        width: "2px",
                        background: "rgba(255, 255, 255, 0.1)"
                      }} />
                    )}

                    {/* Ponto na árvore */}
                    <div style={{
                      width: "14px",
                      height: "14px",
                      borderRadius: "50%",
                      background: i === 0 ? "#10b981" : "#a855f7",
                      boxShadow: i === 0 ? "0 0 8px #10b981" : "none",
                      border: "2px solid #111827",
                      zIndex: 2,
                      flexShrink: 0,
                      marginTop: "3px"
                    }} />

                    {/* Detalhes do commit */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "3px" }}>
                        <a
                          href={c.htmlUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: "0.74rem",
                            fontFamily: "monospace",
                            background: "rgba(255, 255, 255, 0.08)",
                            color: "var(--primary)",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            textDecoration: "none",
                            fontWeight: 700
                          }}
                          title="Ver commit no GitHub"
                        >
                          #{c.shortSha} ↗
                        </a>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                          {new Date(c.date).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      <div style={{ fontSize: "0.82rem", color: "var(--text-primary)", fontWeight: 500, lineHeight: "1.35", wordBreak: "break-word" }}>
                        {c.message.split("\n")[0]}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                        {c.authorAvatarUrl && (
                          <img src={c.authorAvatarUrl} alt={c.authorName} style={{ width: "16px", height: "16px", borderRadius: "50%" }} />
                        )}
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                          {c.authorName}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {(!ciCdData || ciCdData.github.commits.length === 0) && (
                  <div style={{ color: "var(--text-muted)", fontSize: "0.82rem", textAlign: "center", padding: "20px 0" }}>
                    Carregando commits do repositório...
                  </div>
                )}
              </div>
            </div>

            {/* COLUNA 2: RENDER (BACKEND DEPLOYS) */}
            <div style={{
              background: "rgba(17, 24, 39, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "14px",
              padding: "18px 20px",
              display: "flex",
              flexDirection: "column"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Server size={18} color="#60a5fa" />
                  <strong style={{ fontSize: "0.95rem" }}>Render — Backend Web Service</strong>
                </div>
                <span style={{
                  fontSize: "0.72rem",
                  background: ciCdData?.render.connected ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                  color: ciCdData?.render.connected ? "#34d399" : "#fde047",
                  padding: "2px 8px",
                  borderRadius: "10px",
                  fontWeight: 600
                }}>
                  {ciCdData?.render.connected ? "● Render API Conectada" : "Webhook / Manual"}
                </span>
              </div>

              {/* Lista de Deploys Render */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "480px", overflowY: "auto" }}>
                {ciCdData?.render.deploys && ciCdData.render.deploys.length > 0 ? (
                  ciCdData.render.deploys.map((dep, idx) => (
                    <div key={dep.id || idx} style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "8px", padding: "10px 12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <span style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: "6px",
                          background: dep.status === "live" ? "rgba(16, 185, 129, 0.15)" : dep.status === "in_progress" ? "rgba(245, 158, 11, 0.15)" : "rgba(239, 68, 68, 0.15)",
                          color: dep.status === "live" ? "#34d399" : dep.status === "in_progress" ? "#fde047" : "#f87171",
                          textTransform: "uppercase"
                        }}>
                          {dep.status === "live" ? "🟢 Live (Ativo)" : dep.status}
                        </span>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                          {new Date(dep.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "4px" }}>
                        {dep.commitMessage}
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                        <span>Commit: #{dep.commitHash || "HEAD"}</span>
                        <span>{dep.durationSeconds ? `Duração: ${dep.durationSeconds}s` : `Gatilho: ${dep.trigger}`}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{
                    background: "rgba(59, 130, 246, 0.05)",
                    border: "1px dashed rgba(59, 130, 246, 0.25)",
                    borderRadius: "8px",
                    padding: "16px",
                    textAlign: "center"
                  }}>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "0 0 10px 0" }}>
                      Para listar o histórico oficial de builds da Render diretamente na tela, conecte sua Chave de API da Render.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowCiCdModal(true)}
                      className="btn btn-secondary"
                      style={{ fontSize: "0.76rem", padding: "4px 10px" }}
                    >
                      Configurar Chave da Render
                    </button>
                  </div>
                )}

                {/* Histórico Registrado via Webhook */}
                {deploys.length > 0 && (!ciCdData?.render.deploys || ciCdData.render.deploys.length === 0) && (
                  <div>
                    <span style={{ fontSize: "0.74rem", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>Último Deploy Registrado:</span>
                    {deploys.slice(0, 3).map((dep) => (
                      <div key={dep.id} style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "8px", padding: "10px 12px", marginBottom: "6px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                          <strong style={{ fontSize: "0.82rem" }}>{dep.projectName}</strong>
                          <span style={{ fontSize: "0.72rem", color: "#34d399", fontWeight: 700 }}>🟢 {dep.status}</span>
                        </div>
                        <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>{dep.commitMessage}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* COLUNA 3: VERCEL (FRONTEND DEPLOYMENTS) */}
            <div style={{
              background: "rgba(17, 24, 39, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "14px",
              padding: "18px 20px",
              display: "flex",
              flexDirection: "column"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Globe size={18} color="#38bdf8" />
                  <strong style={{ fontSize: "0.95rem" }}>Vercel — Frontend Web</strong>
                </div>
                <span style={{
                  fontSize: "0.72rem",
                  background: ciCdData?.vercel.connected ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                  color: ciCdData?.vercel.connected ? "#34d399" : "#fde047",
                  padding: "2px 8px",
                  borderRadius: "10px",
                  fontWeight: 600
                }}>
                  {ciCdData?.vercel.connected ? "● Vercel API Conectada" : "Auto-Deploy GitHub"}
                </span>
              </div>

              {/* Lista de Deployments Vercel */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "480px", overflowY: "auto" }}>
                {ciCdData?.vercel.deployments && ciCdData.vercel.deployments.length > 0 ? (
                  ciCdData.vercel.deployments.map((dep, idx) => (
                    <div key={dep.id || idx} style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "8px", padding: "10px 12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <span style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: "6px",
                          background: dep.state === "READY" ? "rgba(16, 185, 129, 0.15)" : dep.state === "BUILDING" ? "rgba(245, 158, 11, 0.15)" : "rgba(239, 68, 68, 0.15)",
                          color: dep.state === "READY" ? "#34d399" : dep.state === "BUILDING" ? "#fde047" : "#f87171"
                        }}>
                          {dep.state === "READY" ? "🟢 Ready" : dep.state}
                        </span>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                          {new Date(dep.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      {dep.url && (
                        <div style={{ fontSize: "0.78rem", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <a href={dep.url} target="_blank" rel="noreferrer" style={{ color: "var(--primary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            {dep.url.replace("https://", "")} <ExternalLink size={11} />
                          </a>
                        </div>
                      )}

                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                        <span>Commit: #{dep.commitHash || "HEAD"}</span>
                        <span>Branch: {dep.branch}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{
                    background: "rgba(56, 189, 248, 0.05)",
                    border: "1px dashed rgba(56, 189, 248, 0.25)",
                    borderRadius: "8px",
                    padding: "16px",
                    textAlign: "center"
                  }}>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "0 0 10px 0" }}>
                      Deploy ativo vinculado ao repositório GitHub. Conecte seu token da Vercel para visualizar todos os builds e previews em tempo real.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowCiCdModal(true)}
                      className="btn btn-secondary"
                      style={{ fontSize: "0.76rem", padding: "4px 10px" }}
                    >
                      Configurar Token da Vercel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Webhook Endpoint Box */}
          <div style={{
            background: "linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(17, 24, 39, 0.7) 100%)",
            border: "1px solid rgba(59, 130, 246, 0.25)",
            borderRadius: "12px",
            padding: "16px 20px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <KeyRound size={16} color="#60a5fa" />
              <strong style={{ fontSize: "0.88rem", color: "#93c5fd" }}>Webhook de Notificação de Deploy</strong>
            </div>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "0 0 8px 0" }}>
              Qualquer plataforma externa (GitHub Actions, Render Webhook, Vercel Deploy Hook) pode notificar este endpoint para registrar publicações:
            </p>
            <div style={{
              background: "rgba(0, 0, 0, 0.4)",
              padding: "8px 12px",
              borderRadius: "6px",
              fontFamily: "monospace",
              fontSize: "0.8rem",
              color: "var(--primary)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <span>{`${API_BASE_URL}/admin/ops/deploy-webhook`}</span>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>POST (JSON)</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Configurações de Conexões CI/CD (GitHub, Render, Vercel) */}
      {showCiCdModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10000,
          padding: "16px"
        }}>
          <div style={{
            background: "#111827",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "14px",
            padding: "24px",
            width: "100%",
            maxWidth: "520px",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
                Conectar CI/CD (GitHub, Render, Vercel)
              </h3>
              <button
                type="button"
                onClick={() => setShowCiCdModal(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.1rem" }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 16px 0" }}>
              Insira suas chaves de API para carregar em tempo real o status de builds e deploys das plataformas.
            </p>

            <form onSubmit={handleSaveCiCdConfig} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Repositório GitHub</label>
                <input
                  type="text"
                  value={ciCdForm.githubRepo}
                  onChange={(e) => setCiCdForm({ ...ciCdForm, githubRepo: e.target.value })}
                  className="form-control"
                  placeholder="usuario/repositorio"
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                  Render API Key (dashboard.render.com &gt; Account Settings &gt; API Keys)
                </label>
                <input
                  type="password"
                  value={ciCdForm.renderApiKey}
                  onChange={(e) => setCiCdForm({ ...ciCdForm, renderApiKey: e.target.value })}
                  className="form-control"
                  placeholder="rnd_..."
                />
              </div>

              <div>
                <label style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                  Render Service ID (da URL do serviço na Render: srv-...)
                </label>
                <input
                  type="text"
                  value={ciCdForm.renderServiceId}
                  onChange={(e) => setCiCdForm({ ...ciCdForm, renderServiceId: e.target.value })}
                  className="form-control"
                  placeholder="srv-..."
                />
              </div>

              <div>
                <label style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                  Vercel Token (vercel.com &gt; Account Settings &gt; Tokens)
                </label>
                <input
                  type="password"
                  value={ciCdForm.vercelToken}
                  onChange={(e) => setCiCdForm({ ...ciCdForm, vercelToken: e.target.value })}
                  className="form-control"
                  placeholder="Token Vercel..."
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setShowCiCdModal(false)}
                  className="btn btn-secondary"
                  disabled={isSavingCiCd}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSavingCiCd}
                >
                  {isSavingCiCd ? "Salvando..." : "Salvar Conexões"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Adicionar Novo Projeto Monitorado */}
      {showAddProjectModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10000,
          padding: "16px"
        }}>
          <div style={{
            background: "#111827",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "14px",
            padding: "24px",
            width: "100%",
            maxWidth: "480px",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)"
          }}>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 6px 0" }}>
              Adicionar Projeto para Monitoramento
            </h3>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 16px 0" }}>
              Monitore a disponibilidade, tempo de resposta e certificado SSL de qualquer API, serviço ou site.
            </p>

            <form onSubmit={handleAddProject} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Nome do Projeto</label>
                <input
                  type="text"
                  placeholder="Ex: Landing Page Nova ou Webhook n8n"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  className="form-control"
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Categoria</label>
                <select
                  value={newProject.category}
                  onChange={(e: any) => setNewProject({ ...newProject, category: e.target.value })}
                  className="form-control"
                >
                  <option value="API">API Backend</option>
                  <option value="FRONTEND">Frontend Web</option>
                  <option value="DATABASE">Banco de Dados</option>
                  <option value="WEBHOOK">Webhook / Microserviço</option>
                  <option value="EXTERNAL">Serviço Externo</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>URL de Health Check</label>
                <input
                  type="text"
                  placeholder="https://exemplo.com.br/health"
                  value={newProject.url}
                  onChange={(e) => setNewProject({ ...newProject, url: e.target.value })}
                  className="form-control"
                  required
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setShowAddProjectModal(false)}
                  className="btn btn-secondary"
                  disabled={isSavingProject}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSavingProject}
                >
                  {isSavingProject ? "Adicionando..." : "Salvar e Monitorar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Relatório Técnico de Saúde */}
      {showReportModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px"
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowReportModal(false);
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: "850px",
              width: "100%",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              padding: "24px",
              borderRadius: "16px",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              background: "var(--card-bg, #161b22)"
            }}
          >
            {/* Header do Modal */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(99, 102, 241, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <FileText size={20} color="#818cf8" />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "var(--text)" }}>
                    Relatório de Diagnóstico & Saúde do Ecossistema
                  </h3>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                    Consolidado em Markdown pronto para copiar e fornecer à IA ou ao time técnico.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="btn btn-secondary"
                style={{ padding: "4px 8px", fontSize: "0.85rem", lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            {/* Banner de Dica */}
            <div
              style={{
                background: "rgba(99, 102, 241, 0.1)",
                border: "1px solid rgba(99, 102, 241, 0.25)",
                padding: "10px 14px",
                borderRadius: "8px",
                fontSize: "0.8rem",
                color: "#c7d2fe",
                marginBottom: "14px",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <span>💡</span>
              <span>
                <strong>Como usar:</strong> Clique em <em>"Copiar Relatório Completo"</em> e cole (Ctrl+V) diretamente no chat da IA. Todas as métricas de rotas, banco Neon, deploys e erros serão analisadas de imediato!
              </span>
            </div>

            {/* Conteúdo do Relatório */}
            <div style={{ flex: 1, minHeight: "260px", maxHeight: "450px", overflowY: "auto", position: "relative", marginBottom: "16px" }}>
              {isLoadingReport ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "260px", gap: "12px", color: "var(--text-muted)" }}>
                  <RefreshCw size={24} className="spin" color="var(--primary)" />
                  <span style={{ fontSize: "0.85rem" }}>Coletando telemetria, sondando banco e deploys...</span>
                </div>
              ) : (
                <pre
                  style={{
                    background: "#0d1117",
                    color: "#e6edf3",
                    padding: "16px",
                    borderRadius: "8px",
                    fontSize: "0.78rem",
                    lineHeight: "1.5",
                    fontFamily: "'Fira Code', 'Consolas', monospace",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    margin: 0,
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    height: "100%",
                    boxSizing: "border-box"
                  }}
                >
                  {reportMarkdown || "Nenhum dado retornado."}
                </pre>
              )}
            </div>

            {/* Ações do Rodapé */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", paddingTop: "12px", borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={handleCopyReport}
                  disabled={isLoadingReport || !reportMarkdown}
                  className="btn btn-primary"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "0.85rem",
                    padding: "8px 16px",
                    backgroundColor: isReportCopied ? "#059669" : undefined,
                    borderColor: isReportCopied ? "#10b981" : undefined
                  }}
                >
                  {isReportCopied ? <Check size={16} /> : <Copy size={16} />}
                  {isReportCopied ? "✓ Copiado com Sucesso!" : "Copiar Relatório Completo"}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadReport}
                  disabled={isLoadingReport || !reportMarkdown}
                  className="btn btn-secondary"
                  style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", padding: "8px 14px" }}
                  title="Baixar arquivo markdown .md"
                >
                  <Download size={15} />
                  Baixar Arquivo (.md)
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="btn btn-secondary"
                style={{ fontSize: "0.85rem", padding: "8px 16px" }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
