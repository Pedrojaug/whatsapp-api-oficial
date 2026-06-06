import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import whatsappRouter from "./routes/whatsapp";
import authRouter from "./routes/auth";
import adminRouter from "./routes/admin";

// Carregar variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Rotas
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api", whatsappRouter);

// Rota de Status
app.get("/status", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
