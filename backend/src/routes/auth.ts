import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../db";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is not set.");
}

// Rate Limiter para rotas de autenticação (limite de 5 requisições por minuto por IP)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: "Muitas tentativas de login/registro a partir deste IP, por favor tente novamente após 1 minuto." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authLimiter);

// Schemas de validação Zod
const registerSchema = z.object({
  email: z.string().email("Formato de e-mail inválido.").trim().toLowerCase(),
  password: z.string().min(6, "A senha deve conter no mínimo 6 caracteres."),
  name: z.string().trim().optional().nullable(),
});

const loginSchema = z.object({
  email: z.string().email("Formato de e-mail inválido.").trim().toLowerCase(),
  password: z.string().min(1, "A senha é obrigatória."),
});

// REGISTRO DE USUÁRIO
router.post("/register", async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message || "Dados inválidos.";
    return res.status(400).json({ error: errorMsg });
  }

  const { email, password, name } = parsed.data;

  try {
    // Verifica se já existe o e-mail
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: "Este e-mail já está cadastrado." });
    }

    // Criptografa a senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Verifica a quantidade de usuários para tornar o primeiro um SUPERUSER
    const userCount = await prisma.user.count();
    const role = userCount === 0 ? "SUPERUSER" : "USER";

    // Cria o usuário
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
        role: role
      }
    });

    // Gera o token JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error: any) {
    console.error("Erro no registro:", error);
    return res.status(500).json({ error: "Erro interno no servidor ao registrar usuário." });
  }
});

// LOGIN DE USUÁRIO
router.post("/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message || "Dados inválidos.";
    return res.status(400).json({ error: errorMsg });
  }

  const { email, password } = parsed.data;

  try {
    // Busca o usuário
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(400).json({ error: "E-mail ou senha incorretos." });
    }

    // Compara as senhas
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: "E-mail ou senha incorretos." });
    }

    // Gera o token JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error: any) {
    console.error("Erro no login:", error);
    return res.status(500).json({ error: "Erro interno no servidor ao fazer login." });
  }
});

export default router;
