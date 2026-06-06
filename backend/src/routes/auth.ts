import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../db";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "minha-chave-secreta-super-segura-do-hub";

// REGISTRO DE USUÁRIO
router.post("/register", async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
  }

  try {
    const trimmedEmail = email.trim().toLowerCase();
    
    // Verifica se já existe o e-mail
    const existingUser = await prisma.user.findUnique({
      where: { email: trimmedEmail }
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
        email: trimmedEmail,
        password: hashedPassword,
        name: name?.trim() || null,
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
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
  }

  try {
    const trimmedEmail = email.trim().toLowerCase();

    // Busca o usuário
    const user = await prisma.user.findUnique({
      where: { email: trimmedEmail }
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
