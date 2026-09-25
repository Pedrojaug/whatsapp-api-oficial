import { Request, Response, NextFunction } from "express";

export interface RequestRecord {
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

export interface RouteStats {
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

export interface MinuteMetric {
  minute: string; // ISO minute e.g. "2026-09-25T17:40"
  requestCount: number;
  errorCount: number;
  avgDurationMs: number;
}

class TelemetryManager {
  private static instance: TelemetryManager;
  private readonly MAX_RECORDS = 300;
  private records: RequestRecord[] = [];
  private routeMap: Map<string, { durations: number[]; errorCount: number; lastCalledAt: string }> = new Map();
  private minuteMap: Map<string, { count: number; errors: number; totalDuration: number }> = new Map();

  private totalRequests = 0;
  private totalErrors = 0;
  private statusCodes: Record<string, number> = {
    "2xx": 0,
    "3xx": 0,
    "4xx": 0,
    "5xx": 0
  };

  private startTime = Date.now();

  private constructor() {
    // Limpeza periódica de métricas por minuto com mais de 3 horas
    setInterval(() => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 16);
      for (const minute of this.minuteMap.keys()) {
        if (minute < threeHoursAgo) {
          this.minuteMap.delete(minute);
        }
      }
    }, 15 * 60 * 1000);
  }

  public static getInstance(): TelemetryManager {
    if (!TelemetryManager.instance) {
      TelemetryManager.instance = new TelemetryManager();
    }
    return TelemetryManager.instance;
  }

  public trackRequest(
    method: string,
    originalUrl: string,
    routePattern: string,
    statusCode: number,
    durationMs: number,
    ip: string,
    userAgent?: string,
    errorMessage?: string
  ): void {
    // Ignorar requisições de liveness ping ou assets estáticos frequentes para não poluir
    if (originalUrl === "/health" || originalUrl.startsWith("/uploads/")) {
      return;
    }

    this.totalRequests++;

    const category = `${Math.floor(statusCode / 100)}xx`;
    if (this.statusCodes[category] !== undefined) {
      this.statusCodes[category]++;
    }

    if (statusCode >= 400) {
      this.totalErrors++;
    }

    const now = new Date();
    const timestamp = now.toISOString();
    const minuteKey = timestamp.slice(0, 16);

    // Registro da requisição individual no buffer circular
    const record: RequestRecord = {
      id: Math.random().toString(36).substring(2, 9),
      method,
      path: originalUrl.split("?")[0],
      route: routePattern || originalUrl.split("?")[0],
      statusCode,
      durationMs: Math.round(durationMs * 10) / 10,
      timestamp,
      ip: ip.replace("::ffff:", ""),
      userAgent: userAgent ? userAgent.slice(0, 80) : undefined,
      errorMessage: errorMessage ? errorMessage.slice(0, 200) : undefined
    };

    this.records.unshift(record);
    if (this.records.length > this.MAX_RECORDS) {
      this.records.pop();
    }

    // Agrupamento por rota
    const routeKey = `${method} ${record.route}`;
    let rData = this.routeMap.get(routeKey);
    if (!rData) {
      rData = { durations: [], errorCount: 0, lastCalledAt: timestamp };
      this.routeMap.set(routeKey, rData);
    }
    rData.durations.push(durationMs);
    if (rData.durations.length > 200) {
      rData.durations.shift();
    }
    if (statusCode >= 400) {
      rData.errorCount++;
    }
    rData.lastCalledAt = timestamp;

    // Agrupamento por minuto
    let mData = this.minuteMap.get(minuteKey);
    if (!mData) {
      mData = { count: 0, errors: 0, totalDuration: 0 };
      this.minuteMap.set(minuteKey, mData);
    }
    mData.count++;
    if (statusCode >= 400) mData.errors++;
    mData.totalDuration += durationMs;
  }

  public getSummary() {
    const uptimeSec = Math.floor((Date.now() - this.startTime) / 1000);
    const rpm = uptimeSec > 0 ? Math.round((this.totalRequests / (uptimeSec / 60)) * 10) / 10 : 0;
    const errorRate = this.totalRequests > 0 ? Math.round((this.totalErrors / this.totalRequests) * 1000) / 10 : 0;

    // Calcular percentis gerais de latência nas últimas 300 requisições
    const recentDurations = this.records.map((r) => r.durationMs).sort((a, b) => a - b);
    const avgDuration =
      recentDurations.length > 0
        ? Math.round((recentDurations.reduce((acc, d) => acc + d, 0) / recentDurations.length) * 10) / 10
        : 0;

    const p50 = recentDurations.length > 0 ? recentDurations[Math.floor(recentDurations.length * 0.5)] || 0 : 0;
    const p95 = recentDurations.length > 0 ? recentDurations[Math.floor(recentDurations.length * 0.95)] || 0 : 0;
    const p99 = recentDurations.length > 0 ? recentDurations[Math.floor(recentDurations.length * 0.99)] || 0 : 0;

    // Formatar rotas mais lentas e mais chamadas
    const routeStats: RouteStats[] = [];
    this.routeMap.forEach((data, key) => {
      const [method, ...pathParts] = key.split(" ");
      const route = pathParts.join(" ");
      const sorted = [...data.durations].sort((a, b) => a - b);
      const total = sorted.reduce((sum, d) => sum + d, 0);
      const avg = sorted.length > 0 ? Math.round((total / sorted.length) * 10) / 10 : 0;
      const min = sorted.length > 0 ? sorted[0] : 0;
      const max = sorted.length > 0 ? sorted[sorted.length - 1] : 0;
      const p95Val = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] || max : 0;

      routeStats.push({
        route,
        method,
        totalCalls: data.durations.length,
        totalDurationMs: Math.round(total),
        avgDurationMs: avg,
        minDurationMs: Math.round(min * 10) / 10,
        maxDurationMs: Math.round(max * 10) / 10,
        p95DurationMs: Math.round(p95Val * 10) / 10,
        errorCalls: data.errorCount,
        lastCalledAt: data.lastCalledAt
      });
    });

    // Ordenar rotas por duração média descrescente (Top lentas)
    const slowestRoutes = [...routeStats].sort((a, b) => b.avgDurationMs - a.avgDurationMs).slice(0, 10);
    const mostCalledRoutes = [...routeStats].sort((a, b) => b.totalCalls - a.totalCalls).slice(0, 10);

    // Linha do tempo dos últimos 30 minutos
    const minuteTimeline: MinuteMetric[] = [];
    const nowTime = Date.now();
    for (let i = 29; i >= 0; i--) {
      const minKey = new Date(nowTime - i * 60 * 1000).toISOString().slice(0, 16);
      const mData = this.minuteMap.get(minKey);
      minuteTimeline.push({
        minute: minKey.slice(11), // "HH:MM"
        requestCount: mData ? mData.count : 0,
        errorCount: mData ? mData.errors : 0,
        avgDurationMs: mData && mData.count > 0 ? Math.round((mData.totalDuration / mData.count) * 10) / 10 : 0
      });
    }

    return {
      overview: {
        totalRequests: this.totalRequests,
        totalErrors: this.totalErrors,
        errorRatePercent: errorRate,
        rpm,
        uptimeSeconds: uptimeSec,
        latencies: {
          avgMs: avgDuration,
          p50Ms: p50,
          p95Ms: p95,
          p99Ms: p99
        },
        statusCodes: this.statusCodes
      },
      minuteTimeline,
      slowestRoutes,
      mostCalledRoutes,
      recentRequests: this.records.slice(0, 80),
      recentErrors: this.records.filter((r) => r.statusCode >= 400).slice(0, 30)
    };
  }

  public clearStats() {
    this.records = [];
    this.routeMap.clear();
    this.minuteMap.clear();
    this.totalRequests = 0;
    this.totalErrors = 0;
    this.statusCodes = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 };
    this.startTime = Date.now();
  }
}

export const telemetry = TelemetryManager.getInstance();

export function telemetryMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime();

  res.on("finish", () => {
    const diff = process.hrtime(start);
    const durationMs = diff[0] * 1000 + diff[1] / 1e6;

    // Identificar a rota Express registrada (com parâmetros :id em vez de ID numérico)
    const routePattern = req.route ? `${req.baseUrl || ""}${req.route.path}` : req.baseUrl || req.path;

    telemetry.trackRequest(
      req.method,
      req.originalUrl || req.url,
      routePattern,
      res.statusCode,
      durationMs,
      req.ip || req.socket.remoteAddress || "127.0.0.1",
      req.get("user-agent"),
      (res as any).locals?.errorMessage
    );
  });

  next();
}
