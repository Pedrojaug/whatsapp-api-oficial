import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import whatsappRouter from "./routes/whatsapp";
import authRouter from "./routes/auth";
import adminRouter from "./routes/admin";
import { startBackgroundDispatcher } from "./workers/dispatcher";

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
const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";
app.use(cors({
  origin: allowedOrigin,
  credentials: true
}));
app.use(express.json());

// Servir arquivos de upload estaticamente
app.use("/uploads", express.static(uploadsDir));

// Rotas
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api", whatsappRouter);

// Rota de Status
app.get("/status", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});

// Iniciar worker de background
startBackgroundDispatcher();

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
