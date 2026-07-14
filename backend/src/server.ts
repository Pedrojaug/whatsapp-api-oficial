import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Carregar variáveis de ambiente antes de qualquer módulo que as consuma
dotenv.config();

// Validação de variáveis obrigatórias — falha rápido com mensagem clara
const REQUIRED_ENV_VARS = ["JWT_SECRET", "ENCRYPTION_KEY", "DATABASE_URL"];
const missingVars = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
if (missingVars.length > 0) {
  console.error(
    `\n❌ ERRO FATAL: As seguintes variáveis de ambiente são obrigatórias e não estão definidas:\n` +
    missingVars.map((v) => `   - ${v}`).join("\n") +
    `\n\nConsulte o arquivo backend/.env.example para configurar corretamente.\n`
  );
  process.exit(1);
}

import whatsappRouter from "./routes/whatsapp";
import authRouter from "./routes/auth";
import adminRouter from "./routes/admin";
import webhookRouter from "./routes/webhookRoutes"; // Deve ser importado separadamente para registro antes do whatsappRouter
import n8nRouter from "./routes/n8nRoutes";
import { handleTrackingRedirect } from "./routes/trackingRoutes";
import publicApiRouter from "./routes/publicApiRoutes";
import { startBackgroundDispatcher } from "./workers/dispatcher";
import { startCampaignWorker } from "./workers/campaignWorker";
import { prisma } from "./db";

const app = express();
const PORT = process.env.PORT || 3001;

// Garantir a existência do diretório de uploads
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middlewares
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""));

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no Origin (server-to-server, curl, mobile)
    if (!origin) return callback(null, true);
    const trimmed = origin.replace(/\/$/, "");
    if (
      allowedOrigins.includes(trimmed) ||
      /^https:\/\/[a-z0-9-]+-[a-z0-9]+-[a-z0-9]+\.vercel\.app$/.test(trimmed) ||
      /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(trimmed)
    ) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin not allowed — ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));
app.use(express.json({
  limit: "50mb",
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ limit: "50mb", extended: true }));


// Interceptador para restaurar imagens apagadas (Render free tier cache reset)
app.get("/uploads/:filename", async (req, res, next) => {
  const { filename } = req.params;
  const filePath = path.join(uploadsDir, filename);

  // Se o arquivo já existe no disco, passa para o express.static servir
  if (fs.existsSync(filePath)) {
    return next();
  }

  // Se sumiu física do disco (ex: reinicialização do Render), busca e recupera do banco Postgres
  try {
    const mediaAsset = await prisma.mediaAsset.findFirst({
      where: { filename }
    });

    if (mediaAsset && mediaAsset.fileData) {
      // Remover prefixo de base64 se houver
      const base64Data = mediaAsset.fileData.replace(/^data:.*?;base64,/, "");
      const fileBuffer = Buffer.from(base64Data, "base64");
      
      // Escrever de volta no disco rígido para requisições futuras rápidas
      fs.writeFileSync(filePath, fileBuffer);
      console.log(`[Media Cache] Arquivo ${filename} restaurado do banco de dados com sucesso.`);
      
      return res.sendFile(filePath);
    }
  } catch (error) {
    console.error(`[Media Cache] Erro ao tentar restaurar arquivo ${filename} do banco:`, error);
  }

  next();
});

// Servir arquivos de upload estaticamente
app.use("/uploads", express.static(uploadsDir));

// Redirect público de links rastreados (sem autenticação)
app.get("/t/:shortCode", handleTrackingRedirect);

// API Pública por chave (sem JWT)
app.use("/api/v1", publicApiRouter);

// CRÍTICO: Rotas de webhook da Meta DEVEM ser registradas ANTES do whatsappRouter.
// O whatsappRouter contém subroteadores com router.use(authMiddleware) que, no Express,
// atuam como catch-all e interceptariam requisições da Meta (sem JWT) antes de chegar
// ao webhookRouter dentro do agregador. Registrar aqui garante que as rotas
// /api/webhooks (GET e POST) sejam sempre públicas e acessíveis pela Meta.
app.use("/api", webhookRouter);
app.use("/api", n8nRouter);

// Rotas autenticadas
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api", whatsappRouter);

// Rota de Status
app.get("/status", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected", time: new Date() });
  } catch (error) {
    res.status(503).json({ status: "degraded", database: "disconnected", time: new Date() });
  }
});

// Rota de Versão — confirma qual build está em execução no Render
app.get("/version", (req, res) => {
  res.json({
    commit: process.env.RENDER_GIT_COMMIT || "local",
    deployedAt: new Date().toISOString(),
    // webhookRouter registrado diretamente no app (linha ~122), antes do whatsappRouter
    webhookFix: "registered-before-whatsappRouter",
  });
});

// Middleware de tratamento de erro global
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Erro não tratado na aplicação:", err);
  res.status(err.status || 500).json({
    error: "Ocorreu um erro interno no servidor.",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Recuperar mensagens travadas em PROCESSING por restart anterior
prisma.message.updateMany({ where: { status: "PROCESSING" }, data: { status: "PENDING" } })
  .then(({ count }) => {
    if (count > 0) console.log(`[Startup] ${count} mensagem(ns) travadas em PROCESSING recuperadas para PENDING.`);
  })
  .catch((err: Error) => console.error("[Startup] Erro ao recuperar mensagens PROCESSING:", err.message));

// Rede de segurança: uma promise rejeitada fora de try/catch (ex.: num emit
// de SSE ou numa lib) não deve derrubar o processo inteiro no free tier.
process.on("unhandledRejection", (reason) => {
  console.error("[Process] unhandledRejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[Process] uncaughtException:", err);
});

// Iniciar workers de background
startBackgroundDispatcher();
startCampaignWorker();

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);

  // Keep-alive: previne hibernação do Render free tier (timeout de 15 min sem tráfego)
  // Faz um self-ping a cada 13 minutos para manter o servidor acordado
  const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${PORT}`;
  if (process.env.NODE_ENV !== "test") {
    setInterval(async () => {
      try {
        const pingUrl = `${BACKEND_URL}/status`;
        const protocol = pingUrl.startsWith("https") ? await import("https") : await import("http");
        protocol.get(pingUrl, (res) => {
          res.resume(); // Consumir a resposta para não vazar memória
        }).on("error", (err: Error) => {
          console.warn("[KeepAlive] Falha no self-ping:", err.message);
        });
      } catch (err: any) {
        console.warn("[KeepAlive] Erro no keep-alive:", err.message);
      }
    }, 13 * 60 * 1000); // 13 minutos
    console.log("[KeepAlive] Self-ping ativado para prevenir hibernação do servidor.");
  }
});
