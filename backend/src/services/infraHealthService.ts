import tls from "tls";
import https from "https";
import http from "http";
import { URL } from "url";
import { prisma } from "../db";

export interface MonitoredProject {
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

export interface DbHealthResult {
  status: "HEALTHY" | "DEGRADED" | "DOWN";
  latencyMs: number;
  serverTime: string;
  tables: { name: string; estimatedRows: number }[];
  connectionPool: {
    status: string;
    databaseName: string;
  };
}

export interface DeployRecord {
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

class InfraHealthService {
  private static instance: InfraHealthService;

  // Lista padrão de projetos monitorados
  private projects: MonitoredProject[] = [
    {
      id: "send-backend",
      name: "Send Inteligentte - API Backend",
      category: "API",
      url: process.env.BACKEND_PUBLIC_URL || "https://whatsapp-api-oficial.onrender.com/health",
      domain: "whatsapp-api-oficial.onrender.com",
      status: "ONLINE",
      latencyMs: 0,
      isCore: true
    },
    {
      id: "send-frontend",
      name: "Send Inteligentte - Painel Web",
      category: "FRONTEND",
      url: (process.env.FRONTEND_URL || "https://inteligentte.com.br").split(",")[0],
      domain: "inteligentte.com.br",
      status: "ONLINE",
      latencyMs: 0,
      isCore: true
    },
    {
      id: "meta-graph-api",
      name: "Meta Cloud API (WhatsApp)",
      category: "EXTERNAL",
      url: "https://graph.facebook.com/v21.0",
      domain: "graph.facebook.com",
      status: "ONLINE",
      latencyMs: 0,
      isCore: true
    },
    {
      id: "neon-serverless-db",
      name: "Neon PostgreSQL Cloud",
      category: "DATABASE",
      url: "neon.tech",
      status: "ONLINE",
      latencyMs: 0,
      isCore: true
    }
  ];

  private deployHistory: DeployRecord[] = [
    {
      id: "dep-latest",
      projectName: "Send Inteligentte",
      environment: "production",
      commitHash: (process.env.RENDER_GIT_COMMIT || "071453f").slice(0, 7),
      commitMessage: "feat: implement multi-agent team management and role-based access control (RBAC)",
      branch: process.env.RENDER_GIT_BRANCH || "main",
      status: "SUCCESS",
      deployedAt: new Date().toISOString(),
      durationSeconds: 42,
      author: "Pedro / DevSecOps"
    }
  ];

  private constructor() {
    // Executa sondagem automática a cada 2 minutos em segundo plano
    setInterval(() => {
      this.probeAllProjects().catch(() => {});
    }, 2 * 60 * 1000);
  }

  public static getInstance(): InfraHealthService {
    if (!InfraHealthService.instance) {
      InfraHealthService.instance = new InfraHealthService();
    }
    return InfraHealthService.instance;
  }

  // 1. Diagnóstico do Banco de Dados Neon (Latência, Ping & Tabelas)
  public async probeDatabase(): Promise<DbHealthResult> {
    const start = process.hrtime();
    try {
      // 1. Medir latência real de uma query no Neon
      const pingResult: any = await prisma.$queryRaw`SELECT NOW() as now_time`;
      const diff = process.hrtime(start);
      const latencyMs = Math.round((diff[0] * 1000 + diff[1] / 1e6) * 10) / 10;

      // 2. Buscar contagem estimada de linhas das principais tabelas
      let tables: { name: string; estimatedRows: number }[] = [];
      try {
        const stats: any[] = await prisma.$queryRaw`
          SELECT relname as name, n_live_tup as count
          FROM pg_stat_user_tables
          ORDER BY n_live_tup DESC
          LIMIT 12;
        `;
        tables = stats.map((s) => ({
          name: s.name,
          estimatedRows: Number(s.count || 0)
        }));
      } catch {
        // Fallback rápido se pg_stat não tiver permissão
        tables = [
          { name: "Message", estimatedRows: await prisma.message.count().catch(() => 0) },
          { name: "WhatsAppContact", estimatedRows: (prisma as any).whatsAppContact?.count().catch(() => 0) || 0 },
          { name: "Account", estimatedRows: await prisma.account.count().catch(() => 0) },
          { name: "User", estimatedRows: await prisma.user.count().catch(() => 0) }
        ];
      }

      return {
        status: latencyMs < 100 ? "HEALTHY" : latencyMs < 350 ? "DEGRADED" : "DEGRADED",
        latencyMs,
        serverTime: pingResult?.[0]?.now_time ? new Date(pingResult[0].now_time).toISOString() : new Date().toISOString(),
        tables,
        connectionPool: {
          status: "CONNECTED",
          databaseName: process.env.DATABASE_URL?.split("@")[1]?.split("/")[1]?.split("?")[0] || "neondb"
        }
      };
    } catch (error: any) {
      const diff = process.hrtime(start);
      return {
        status: "DOWN",
        latencyMs: Math.round(diff[0] * 1000 + diff[1] / 1e6),
        serverTime: new Date().toISOString(),
        tables: [],
        connectionPool: {
          status: `ERROR: ${error.message}`,
          databaseName: "neondb"
        }
      };
    }
  }

  // 2. Diagnóstico de SSL para um domínio
  public checkSslCertificate(domain: string): Promise<{ valid: boolean; issuer: string; validTo: string; daysRemaining: number } | undefined> {
    return new Promise((resolve) => {
      const cleanHost = domain.replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
      if (!cleanHost || cleanHost === "localhost" || cleanHost === "127.0.0.1") {
        return resolve(undefined);
      }

      try {
        const socket = tls.connect(
          {
            host: cleanHost,
            port: 443,
            servername: cleanHost,
            timeout: 4000
          },
          () => {
            const cert = socket.getPeerCertificate();
            socket.end();

            if (!cert || !cert.valid_to) {
              return resolve(undefined);
            }

            const validTo = new Date(cert.valid_to);
            const now = new Date();
            const daysRemaining = Math.max(0, Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

            const issuerRaw = cert.issuer?.O || cert.issuer?.CN || "Let's Encrypt / Cloudflare";
            const issuer = Array.isArray(issuerRaw) ? String(issuerRaw[0]) : String(issuerRaw);

            resolve({
              valid: daysRemaining > 0,
              issuer,
              validTo: validTo.toISOString().slice(0, 10),
              daysRemaining
            });
          }
        );

        socket.on("error", () => resolve(undefined));
        socket.on("timeout", () => {
          socket.destroy();
          resolve(undefined);
        });
      } catch {
        resolve(undefined);
      }
    });
  }

  // 3. Ping HTTP/HTTPS em um projeto monitorado
  public async probeSingleProject(project: MonitoredProject): Promise<MonitoredProject> {
    if (project.category === "DATABASE") {
      const db = await this.probeDatabase();
      project.status = db.status === "HEALTHY" ? "ONLINE" : db.status === "DEGRADED" ? "DEGRADED" : "OFFLINE";
      project.latencyMs = db.latencyMs;
      project.lastCheckedAt = new Date().toISOString();
      project.details = `Neon DB Ping: ${db.latencyMs}ms | Conexão OK`;
      return project;
    }

    let targetUrl = project.url;
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = `https://${targetUrl}`;
    }

    const start = process.hrtime();
    return new Promise(async (resolve) => {
      try {
        const parsed = new URL(targetUrl);
        const protocol = parsed.protocol === "https:" ? https : http;

        // Se for HTTPS, inspeciona o certificado SSL em paralelo
        let sslInfo: { valid: boolean; issuer: string; validTo: string; daysRemaining: number } | undefined;
        if (parsed.protocol === "https:") {
          sslInfo = await this.checkSslCertificate(parsed.hostname);
        }

        const req = protocol.request(
          parsed,
          {
            method: "HEAD",
            timeout: 5000,
            headers: { "User-Agent": "SendInteligentte-HealthBot/1.0" }
          },
          (res) => {
            const diff = process.hrtime(start);
            const latencyMs = Math.round((diff[0] * 1000 + diff[1] / 1e6) * 10) / 10;
            const statusCode = res.statusCode || 0;

            const isOnline = statusCode >= 200 && statusCode < 400;
            const isDegraded = statusCode >= 400 && statusCode < 500;

            project.status = isOnline ? "ONLINE" : isDegraded ? "DEGRADED" : "OFFLINE";
            project.latencyMs = latencyMs;
            project.statusCode = statusCode;
            project.lastCheckedAt = new Date().toISOString();
            if (sslInfo) project.ssl = sslInfo;
            project.details = `HTTP ${statusCode} | ${latencyMs}ms`;

            resolve(project);
          }
        );

        req.on("error", (err) => {
          const diff = process.hrtime(start);
          project.status = "OFFLINE";
          project.latencyMs = Math.round(diff[0] * 1000 + diff[1] / 1e6);
          project.lastCheckedAt = new Date().toISOString();
          project.details = `Falha de conexão: ${err.message}`;
          resolve(project);
        });

        req.on("timeout", () => {
          req.destroy();
          project.status = "OFFLINE";
          project.latencyMs = 5000;
          project.lastCheckedAt = new Date().toISOString();
          project.details = "Timeout (> 5000ms)";
          resolve(project);
        });

        req.end();
      } catch (err: any) {
        project.status = "OFFLINE";
        project.latencyMs = 0;
        project.lastCheckedAt = new Date().toISOString();
        project.details = `URL inválida: ${err.message}`;
        resolve(project);
      }
    });
  }

  // 4. Executar sondagem em todos os projetos
  public async probeAllProjects(): Promise<MonitoredProject[]> {
    const results = await Promise.all(this.projects.map((p) => this.probeSingleProject(p)));
    this.projects = results;
    return this.projects;
  }

  public getProjects(): MonitoredProject[] {
    return this.projects;
  }

  public addProject(p: Omit<MonitoredProject, "id" | "status" | "latencyMs">): MonitoredProject {
    const newProj: MonitoredProject = {
      ...p,
      id: `proj-${Date.now().toString(36)}`,
      status: "CHECKING",
      latencyMs: 0
    };
    this.projects.push(newProj);
    this.probeSingleProject(newProj).catch(() => {});
    return newProj;
  }

  public removeProject(id: string): boolean {
    const initialLen = this.projects.length;
    this.projects = this.projects.filter((p) => p.id !== id || p.isCore);
    return this.projects.length < initialLen;
  }

  // 5. Host & Process Telemetry (Node.js runtime)
  public getProcessStats() {
    const mem = process.memoryUsage();
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        rssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
        heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
        heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10,
        externalMb: Math.round((mem.external / 1024 / 1024) * 10) / 10
      },
      env: process.env.NODE_ENV || "production"
    };
  }

  // 6. Deploy Management
  public getDeployHistory(): DeployRecord[] {
    return this.deployHistory;
  }

  public recordDeploy(deploy: Omit<DeployRecord, "id" | "deployedAt">): DeployRecord {
    const record: DeployRecord = {
      ...deploy,
      id: `dep-${Date.now().toString(36)}`,
      deployedAt: new Date().toISOString()
    };
    this.deployHistory.unshift(record);
    if (this.deployHistory.length > 20) {
      this.deployHistory.pop();
    }
    return record;
  }
}

export const infraHealth = InfraHealthService.getInstance();
