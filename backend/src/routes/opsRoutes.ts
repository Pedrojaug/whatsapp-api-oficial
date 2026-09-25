import { Router, Response } from "express";
import { prisma } from "../db";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth";
import { telemetry } from "../utils/telemetry";
import { infraHealth, MonitoredProject } from "../services/infraHealthService";
import { deployService } from "../services/deployIntegrationService";

const router = Router();

// Middleware interno para garantir SUPERUSER
async function requireSuperUser(req: AuthenticatedRequest, res: Response, next: () => void) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Não autenticado." });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "SUPERUSER") {
      return res.status(403).json({ error: "Acesso negado. Apenas superusuários têm permissão ao Mission Control." });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: "Erro ao validar permissões de superusuário." });
  }
}

// 1. VISÃO GERAL COMPLETA (Consolidado de Telemetria, BD, Projetos, Deploys e Sistema)
router.get("/overview", authMiddleware, requireSuperUser, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [dbHealth, projects] = await Promise.all([
      infraHealth.probeDatabase(),
      infraHealth.probeAllProjects()
    ]);

    const telemetryData = telemetry.getSummary();
    const processStats = infraHealth.getProcessStats();
    const deploys = infraHealth.getDeployHistory();

    // Calcular Índice de Saúde Geral do Sistema (0 - 100%)
    let healthScore = 100;
    if (dbHealth.status === "DEGRADED") healthScore -= 15;
    if (dbHealth.status === "DOWN") healthScore -= 50;

    const offlineProjects = projects.filter((p) => p.status === "OFFLINE").length;
    healthScore -= offlineProjects * 15;

    const errorRate = telemetryData.overview.errorRatePercent;
    if (errorRate > 5) healthScore -= 15;
    else if (errorRate > 1) healthScore -= 5;

    healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

    res.json({
      systemHealthScore: healthScore,
      database: dbHealth,
      projects,
      telemetry: telemetryData,
      process: processStats,
      deploys,
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("[Ops] Erro ao gerar overview:", error);
    res.status(500).json({ error: error.message });
  }
});

// 2. DETALHES DE TELEMETRIA & REQUISIÇÕES (APM)
router.get("/requests", authMiddleware, requireSuperUser, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const data = telemetry.getSummary();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. DIAGNÓSTICO DO BANCO DE DADOS NEON
router.get("/database", authMiddleware, requireSuperUser, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await infraHealth.probeDatabase();
    res.json(db);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. FORÇAR SONDAGEM IMEDIATA (PING MANUAL)
router.post("/probe", authMiddleware, requireSuperUser, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [dbHealth, projects] = await Promise.all([
      infraHealth.probeDatabase(),
      infraHealth.probeAllProjects()
    ]);
    res.json({ success: true, database: dbHealth, projects });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. LISTAR PROJETOS MONITORADOS
router.get("/projects", authMiddleware, requireSuperUser, (_req: AuthenticatedRequest, res: Response) => {
  res.json(infraHealth.getProjects());
});

// 6. ADICIONAR NOVO PROJETO PARA MONITORAMENTO
router.post("/projects", authMiddleware, requireSuperUser, async (req: AuthenticatedRequest, res: Response) => {
  const { name, category = "API", url, domain } = req.body;
  if (!name || !url) {
    return res.status(400).json({ error: "Nome e URL do projeto são obrigatórios." });
  }

  try {
    const newProject = infraHealth.addProject({
      name,
      category,
      url,
      domain: domain || url.replace(/^https?:\/\//, "").split("/")[0]
    });
    res.status(201).json(newProject);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. REMOVER PROJETO MONITORADO
router.delete("/projects/:projectId", authMiddleware, requireSuperUser, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const removed = infraHealth.removeProject(projectId);
  if (!removed) {
    return res.status(400).json({ error: "Não foi possível remover este projeto (projetos padrão do sistema não podem ser excluídos)." });
  }
  res.json({ success: true, message: "Projeto removido do monitoramento." });
});

// 8. RESETAR MÉTRICAS DE TELEMETRIA
router.post("/clear-telemetry", authMiddleware, requireSuperUser, (_req: AuthenticatedRequest, res: Response) => {
  telemetry.clearStats();
  res.json({ success: true, message: "Métricas de telemetria zeradas com sucesso." });
});

// 9. WEBHOOK DE DEPLOY (Render / GitHub Actions / Vercel)
router.post("/deploy-webhook", (req, res) => {
  try {
    const body = req.body || {};
    const projectName = body.project || body.serviceName || "Send Inteligentte";
    const commitHash = body.commit || body.head_commit?.id || body.sha || "HEAD";
    const commitMessage = body.message || body.head_commit?.message || "Deploy acionado via CI/CD";
    const branch = body.branch || body.ref?.replace("refs/heads/", "") || "main";
    const status = body.status === "failed" ? "FAILED" : "SUCCESS";
    const author = body.author || body.head_commit?.author?.name || "CI/CD Pipeline";

    const record = infraHealth.recordDeploy({
      projectName,
      environment: body.environment || "production",
      commitHash: commitHash.slice(0, 7),
      commitMessage: commitMessage.slice(0, 100),
      branch,
      status,
      author
    });

    console.log(`[Ops Webhook] Novo deploy registrado: ${projectName} (${commitHash.slice(0, 7)}) por ${author}`);
    res.json({ success: true, record });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 10. DADOS CONSOLIDADOS DE CI/CD (GitHub Commits, Render Deploys, Vercel Deployments)
router.get("/ci-cd", authMiddleware, requireSuperUser, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [githubCommits, renderData, vercelData] = await Promise.all([
      deployService.getGitHubCommits(15),
      deployService.getRenderDeploys(10),
      deployService.getVercelDeployments(10)
    ]);

    res.json({
      github: {
        connected: githubCommits.length > 0,
        commits: githubCommits
      },
      render: renderData,
      vercel: vercelData,
      config: deployService.getConfig()
    });
  } catch (error: any) {
    console.error("[Ops CI/CD] Erro ao consolidar status de deploys:", error);
    res.status(500).json({ error: error.message });
  }
});

// 11. ATUALIZAR CREDENCIAIS E CONFIGURAÇÕES DE CI/CD
router.post("/ci-cd/config", authMiddleware, requireSuperUser, (req: AuthenticatedRequest, res: Response) => {
  const { githubRepo, githubToken, renderApiKey, renderServiceId, vercelToken, vercelProjectId } = req.body;
  try {
    deployService.updateConfig({
      githubRepo,
      githubToken,
      renderApiKey,
      renderServiceId,
      vercelToken,
      vercelProjectId
    });
    res.json({ success: true, config: deployService.getConfig() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 12. GERAR RELATÓRIO CONSOLIDADO DE SAÚDE (Markdown ou JSON)
router.get("/report", authMiddleware, requireSuperUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [dbHealth, projects, commits, renderData, vercelData] = await Promise.all([
      infraHealth.probeDatabase(),
      infraHealth.probeAllProjects(),
      deployService.getGitHubCommits(5),
      deployService.getRenderDeploys(3),
      deployService.getVercelDeployments(3)
    ]);

    const telemetryData = telemetry.getSummary();
    const processStats = infraHealth.getProcessStats();

    // Calcular índice geral
    let healthScore = 100;
    if (dbHealth.status === "DEGRADED") healthScore -= 15;
    if (dbHealth.status === "DOWN") healthScore -= 50;
    const offlineProjects = projects.filter((p) => p.status === "OFFLINE").length;
    healthScore -= offlineProjects * 15;
    const errorRate = telemetryData.overview.errorRatePercent;
    if (errorRate > 5) healthScore -= 15;
    else if (errorRate > 1) healthScore -= 5;
    healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

    const statusBadge = healthScore >= 90 ? "🟢 EXCELENTE" : healthScore >= 70 ? "🟡 ESTÁVEL" : "🔴 ATENÇÃO";

    const nowFormatted = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    // Format Markdown
    const markdown = `# 🩺 Relatório de Diagnóstico & Saúde do Ecossistema
**Projeto:** Send Inteligentte (WhatsApp API Oficial)
**Gerado em:** ${nowFormatted} (Horário de Brasília)
**Score Geral de Saúde:** **${healthScore}/100 (${statusBadge})**

---

## 1. 🗄️ Banco de Dados (Neon PostgreSQL)
- **Status:** ${dbHealth.status === "HEALTHY" ? "🟢 Saudável" : dbHealth.status === "DEGRADED" ? "🟡 Lento / Degradado" : "🔴 Fora do Ar"}
- **Latência SQL (Ping):** ${dbHealth.latencyMs} ms
- **Base:** ${dbHealth.connectionPool.databaseName || "Conectado"}
- **Tabelas & Registros Estimados:**
${dbHealth.tables.length > 0 ? dbHealth.tables.map(t => `  - \`${t.name}\`: ~${t.estimatedRows.toLocaleString("pt-BR")} registros`).join("\n") : "  - (Nenhuma contagem de tabela disponível)"}

---

## 2. ⚡ APM & Telemetria de Requisições
- **Total de Requisições:** ${telemetryData.overview.totalRequests.toLocaleString("pt-BR")}
- **Requisições / Minuto (RPM):** ${telemetryData.overview.rpm}
- **Tempo Médio de Resposta:** ${telemetryData.overview.latencies.avgMs} ms
- **Percentil 95 (p95):** ${telemetryData.overview.latencies.p95Ms} ms
- **Taxa de Erro:** ${telemetryData.overview.errorRatePercent}% (${telemetryData.overview.totalErrors} erros)
- **Status Codes:** 2xx: ${telemetryData.overview.statusCodes["2xx"] || 0} | 4xx: ${telemetryData.overview.statusCodes["4xx"] || 0} | 5xx: ${telemetryData.overview.statusCodes["5xx"] || 0}

### ⏱️ Top Rotas Mais Lentas
${telemetryData.slowestRoutes.length > 0 
  ? telemetryData.slowestRoutes.slice(0, 5).map((r, i) => `${i + 1}. \`[${r.method}] ${r.route}\` — Média: **${r.avgDurationMs} ms** | p95: ${r.p95DurationMs} ms | Chamadas: ${r.totalCalls} | Erros: ${r.errorCalls}`).join("\n")
  : "_Nenhuma rota lenta registrada._"}

### 🔥 Rotas Mais Requisitadas
${telemetryData.mostCalledRoutes.length > 0
  ? telemetryData.mostCalledRoutes.slice(0, 5).map((r, i) => `${i + 1}. \`[${r.method}] ${r.route}\` — ${r.totalCalls} chamadas | Média: ${r.avgDurationMs} ms`).join("\n")
  : "_Nenhuma rota registrada ainda._"}

---

## 3. 🌐 Endpoints & Infraestrutura Monitorada
${projects.map(p => {
  const statusIcon = p.status === "ONLINE" ? "🟢" : p.status === "DEGRADED" ? "🟡" : "🔴";
  const sslInfo = p.ssl?.valid ? ` | SSL: Válido (${p.ssl.daysRemaining} dias)` : (p.ssl ? " | SSL: Inválido" : "");
  return `- ${statusIcon} **${p.name}** (\`${p.category}\`): ${p.status} | Latência: ${p.latencyMs} ms | HTTP ${p.statusCode || "N/A"}${sslInfo}\n  URL: \`${p.url}\``;
}).join("\n")}

---

## 4. 🚀 CI/CD & Últimos Deploys
- **GitHub:** ${commits.length > 0 ? `Branch \`main\` — Último commit: \`${commits[0].shortSha}\` (${commits[0].message}) por ${commits[0].authorName}` : "Não conectado"}
- **Render Backend:** ${renderData.connected ? (renderData.deploys[0] ? `Status: **${renderData.deploys[0].status}** | Commit: \`${(renderData.deploys[0].commitHash || "").slice(0, 7)}\` | Gatilho: ${renderData.deploys[0].trigger} | Duração: ${renderData.deploys[0].durationSeconds || "?"}s` : "Conectado") : "Não conectado via API Key"}
- **Vercel Frontend:** ${vercelData.connected ? (vercelData.deployments[0] ? `Status: **${vercelData.deployments[0].state}** | Commit: \`${(vercelData.deployments[0].commitHash || "").slice(0, 7)}\` | URL: ${vercelData.deployments[0].url}` : "Conectado") : "Não conectado via Vercel Token"}

---

## 5. 💻 Recursos do Processo Node.js
- **Tempo de Atividade (Uptime):** ${Math.floor(processStats.uptimeSeconds / 3600)}h ${Math.floor((processStats.uptimeSeconds % 3600) / 60)}m
- **Memória RSS:** ${processStats.memory.rssMb} MB
- **Heap Usado:** ${processStats.memory.heapUsedMb} MB / ${processStats.memory.heapTotalMb} MB
- **Versão Node.js:** ${processStats.nodeVersion} (${processStats.platform})
`;

    if (req.query.format === "text" || req.query.format === "markdown") {
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      return res.send(markdown);
    }

    res.json({
      healthScore,
      markdown,
      data: {
        database: dbHealth,
        projects,
        telemetry: telemetryData,
        process: processStats,
        ciCd: { commits, render: renderData, vercel: vercelData }
      },
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("[Ops Report] Erro ao gerar relatório:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
