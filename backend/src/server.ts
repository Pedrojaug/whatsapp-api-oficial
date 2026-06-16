import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import whatsappRouter from "./routes/whatsapp";
import authRouter from "./routes/auth";
import adminRouter from "./routes/admin";
import { startBackgroundDispatcher } from "./workers/dispatcher";
import { prisma } from "./db";

// Carregar variáveis de ambiente
dotenv.config();

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

// Rotas
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

// Middleware de tratamento de erro global
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Erro não tratado na aplicação:", err);
  res.status(err.status || 500).json({
    error: "Ocorreu um erro interno no servidor.",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Iniciar worker de background
startBackgroundDispatcher();

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
