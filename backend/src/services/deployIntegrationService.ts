import https from "https";
import fs from "fs";
import path from "path";

export interface GitHubCommitItem {
  sha: string;
  shortSha: string;
  message: string;
  authorName: string;
  authorEmail: string;
  authorAvatarUrl?: string;
  authorUsername?: string;
  date: string;
  htmlUrl: string;
  parents: string[];
}

export interface RenderDeployItem {
  id: string;
  status: "live" | "in_progress" | "build_failed" | "canceled" | string;
  commitHash: string;
  commitMessage: string;
  createdAt: string;
  finishedAt?: string;
  durationSeconds?: number;
  trigger: string;
}

export interface VercelDeployItem {
  id: string;
  name: string;
  url: string;
  state: "READY" | "BUILDING" | "ERROR" | "CANCELED" | string;
  createdAt: string;
  creatorName?: string;
  branch?: string;
  commitMessage?: string;
  commitHash?: string;
}

export interface CiCdConfig {
  githubRepo: string; // e.g. "Pedrojaug/whatsapp-api-oficial"
  githubToken?: string;
  renderApiKey?: string;
  renderServiceId?: string; // e.g. "srv-xxx"
  vercelToken?: string;
  vercelProjectId?: string;
}

class DeployIntegrationService {
  private static instance: DeployIntegrationService;
  private configPath = path.join(__dirname, "../../data/ci_cd_config.json");
  private config: CiCdConfig = {
    githubRepo: process.env.GITHUB_REPOSITORY || "Pedrojaug/whatsapp-api-oficial",
    githubToken: process.env.GITHUB_TOKEN || "",
    renderApiKey: process.env.RENDER_API_KEY || "",
    renderServiceId: process.env.RENDER_SERVICE_ID || "srv-cv7cndre9etc73c9q7jg",
    vercelToken: process.env.VERCEL_TOKEN || "",
    vercelProjectId: process.env.VERCEL_PROJECT_ID || ""
  };

  private constructor() {
    this.loadConfig();
  }

  public static getInstance(): DeployIntegrationService {
    if (!DeployIntegrationService.instance) {
      DeployIntegrationService.instance = new DeployIntegrationService();
    }
    return DeployIntegrationService.instance;
  }

  private loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, "utf8");
        const parsed = JSON.parse(raw);
        this.config = { ...this.config, ...parsed };
      }
    } catch (e) {
      // Ignora erro de leitura e usa padrão de env
    }
  }

  private saveConfig() {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (e) {
      console.warn("[DeployService] Falha ao persistir ci_cd_config.json:", e);
    }
  }

  public getConfig(): {
    githubRepo: string;
    hasGithubToken: boolean;
    hasRenderKey: boolean;
    renderServiceId: string;
    hasVercelToken: boolean;
    vercelProjectId: string;
  } {
    return {
      githubRepo: this.config.githubRepo,
      hasGithubToken: Boolean(this.config.githubToken),
      hasRenderKey: Boolean(this.config.renderApiKey),
      renderServiceId: this.config.renderServiceId || "",
      hasVercelToken: Boolean(this.config.vercelToken),
      vercelProjectId: this.config.vercelProjectId || ""
    };
  }

  public updateConfig(newConfig: Partial<CiCdConfig>) {
    if (newConfig.githubRepo !== undefined) this.config.githubRepo = newConfig.githubRepo;
    if (newConfig.githubToken !== undefined && newConfig.githubToken !== "") this.config.githubToken = newConfig.githubToken;
    if (newConfig.renderApiKey !== undefined && newConfig.renderApiKey !== "") this.config.renderApiKey = newConfig.renderApiKey;
    if (newConfig.renderServiceId !== undefined) this.config.renderServiceId = newConfig.renderServiceId;
    if (newConfig.vercelToken !== undefined && newConfig.vercelToken !== "") this.config.vercelToken = newConfig.vercelToken;
    if (newConfig.vercelProjectId !== undefined) this.config.vercelProjectId = newConfig.vercelProjectId;
    this.saveConfig();
  }

  // 1. Obter árvore de commits do GitHub
  public async getGitHubCommits(perPage = 15): Promise<GitHubCommitItem[]> {
    return new Promise((resolve) => {
      const headers: Record<string, string> = {
        "User-Agent": "SendInteligentte-Ops/1.0",
        Accept: "application/vnd.github.v3+json"
      };
      if (this.config.githubToken) {
        headers["Authorization"] = `token ${this.config.githubToken}`;
      }

      const req = https.get(
        {
          hostname: "api.github.com",
          path: `/repos/${this.config.githubRepo}/commits?per_page=${perPage}`,
          headers,
          timeout: 6000
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              if (res.statusCode !== 200) {
                return resolve([]);
              }
              const commits = JSON.parse(data);
              if (!Array.isArray(commits)) return resolve([]);

              const mapped: GitHubCommitItem[] = commits.map((c: any) => ({
                sha: c.sha,
                shortSha: c.sha.slice(0, 7),
                message: c.commit.message,
                authorName: c.commit.author?.name || c.author?.login || "Desconhecido",
                authorEmail: c.commit.author?.email || "",
                authorAvatarUrl: c.author?.avatar_url,
                authorUsername: c.author?.login,
                date: c.commit.author?.date || c.commit.committer?.date || new Date().toISOString(),
                htmlUrl: c.html_url,
                parents: Array.isArray(c.parents) ? c.parents.map((p: any) => p.sha.slice(0, 7)) : []
              }));

              resolve(mapped);
            } catch {
              resolve([]);
            }
          });
        }
      );

      req.on("error", () => resolve([]));
      req.on("timeout", () => {
        req.destroy();
        resolve([]);
      });
      req.end();
    });
  }

  // 2. Obter Deploys da Render
  public async getRenderDeploys(limit = 10): Promise<{ connected: boolean; deploys: RenderDeployItem[]; message?: string }> {
    if (!this.config.renderApiKey || !this.config.renderServiceId) {
      return {
        connected: false,
        deploys: [],
        message: "Chave de API ou Service ID da Render não configurados. Cadastre nas configurações de CI/CD."
      };
    }

    return new Promise((resolve) => {
      const req = https.get(
        {
          hostname: "api.render.com",
          path: `/v1/services/${this.config.renderServiceId}/deploys?limit=${limit}`,
          headers: {
            "User-Agent": "SendInteligentte-Ops/1.0",
            Authorization: `Bearer ${this.config.renderApiKey}`,
            Accept: "application/json"
          },
          timeout: 6000
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              if (res.statusCode !== 200) {
                return resolve({
                  connected: false,
                  deploys: [],
                  message: `Erro Render API (HTTP ${res.statusCode})`
                });
              }
              const list = JSON.parse(data);
              if (!Array.isArray(list)) return resolve({ connected: true, deploys: [] });

              const mapped: RenderDeployItem[] = list.map((item: any) => {
                const dep = item.deploy || item;
                const created = new Date(dep.createdAt || dep.updatedAt);
                const finished = dep.finishedAt ? new Date(dep.finishedAt) : null;
                const durationSeconds = finished ? Math.max(0, Math.floor((finished.getTime() - created.getTime()) / 1000)) : undefined;

                return {
                  id: dep.id,
                  status: dep.status || "unknown",
                  commitHash: (dep.commit?.id || "").slice(0, 7),
                  commitMessage: dep.commit?.message || "Deploy acionado",
                  createdAt: dep.createdAt,
                  finishedAt: dep.finishedAt,
                  durationSeconds,
                  trigger: dep.trigger || "push"
                };
              });

              resolve({ connected: true, deploys: mapped });
            } catch (err: any) {
              resolve({ connected: false, deploys: [], message: err.message });
            }
          });
        }
      );

      req.on("error", (err) => resolve({ connected: false, deploys: [], message: err.message }));
      req.on("timeout", () => {
        req.destroy();
        resolve({ connected: false, deploys: [], message: "Timeout ao consultar Render API" });
      });
      req.end();
    });
  }

  // 3. Obter Deploys da Vercel
  public async getVercelDeployments(limit = 10): Promise<{ connected: boolean; deployments: VercelDeployItem[]; message?: string }> {
    if (!this.config.vercelToken) {
      return {
        connected: false,
        deployments: [],
        message: "Token da Vercel não configurado. Cadastre nas configurações de CI/CD para ver builds ao vivo."
      };
    }

    const queryParams = new URLSearchParams({ limit: String(limit) });
    if (this.config.vercelProjectId) {
      queryParams.set("projectId", this.config.vercelProjectId);
    }

    return new Promise((resolve) => {
      const req = https.get(
        {
          hostname: "api.vercel.com",
          path: `/v6/deployments?${queryParams.toString()}`,
          headers: {
            "User-Agent": "SendInteligentte-Ops/1.0",
            Authorization: `Bearer ${this.config.vercelToken}`,
            Accept: "application/json"
          },
          timeout: 6000
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              if (res.statusCode !== 200) {
                return resolve({
                  connected: false,
                  deployments: [],
                  message: `Erro Vercel API (HTTP ${res.statusCode})`
                });
              }
              const parsed = JSON.parse(data);
              const list = parsed.deployments || [];
              if (!Array.isArray(list)) return resolve({ connected: true, deployments: [] });

              const mapped: VercelDeployItem[] = list.map((d: any) => ({
                id: d.uid || d.id,
                name: d.name,
                url: d.url ? `https://${d.url}` : "",
                state: d.state || d.status || "UNKNOWN",
                createdAt: new Date(d.created || d.createdAt).toISOString(),
                creatorName: d.creator?.username || d.creator?.name,
                branch: d.meta?.githubCommitRef || d.meta?.branch || "main",
                commitMessage: d.meta?.githubCommitMessage || d.meta?.commitMessage || "",
                commitHash: (d.meta?.githubCommitSha || d.meta?.commitSha || "").slice(0, 7)
              }));

              resolve({ connected: true, deployments: mapped });
            } catch (err: any) {
              resolve({ connected: false, deployments: [], message: err.message });
            }
          });
        }
      );

      req.on("error", (err) => resolve({ connected: false, deployments: [], message: err.message }));
      req.on("timeout", () => {
        req.destroy();
        resolve({ connected: false, deployments: [], message: "Timeout ao consultar Vercel API" });
      });
      req.end();
    });
  }
}

export const deployService = DeployIntegrationService.getInstance();
