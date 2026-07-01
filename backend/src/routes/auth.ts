import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import axios from "axios";
import { prisma } from "../db";
import { sendVerificationEmail, sendPasswordResetEmail } from "../utils/email";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("FATAL: JWT_SECRET environment variable is not set.");

const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")[0].trim().replace(/\/$/, "");

const BACKEND_URL = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`)
  .replace(/\/$/, "");

// Rate limiter for sensitive auth endpoints only (not /me, /verify-email, /google/*)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: "Muitas tentativas. Tente novamente em 1 minuto." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeUser(user: any) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    emailVerified: user.emailVerified,
    onboardingCompleted: user.onboardingCompleted,
    planTier: user.planTier,
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt,
  };
}

// In-memory state cache for Google OAuth CSRF protection (single-instance only)
const oauthStateCache = new Map<string, number>();
setInterval(() => {
  const ttl = 10 * 60 * 1000;
  const now = Date.now();
  for (const [state, ts] of oauthStateCache) {
    if (now - ts > ttl) oauthStateCache.delete(state);
  }
}, 60_000);

// ── Schemas ───────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email("Formato de e-mail inválido.").trim().toLowerCase(),
  password: z.string().min(6, "A senha deve conter no mínimo 6 caracteres."),
  name: z.string().trim().optional().nullable(),
});

const loginSchema = z.object({
  email: z.string().email("Formato de e-mail inválido.").trim().toLowerCase(),
  password: z.string().min(1, "A senha é obrigatória."),
});

// ── REGISTRO ─────────────────────────────────────────────────────────────────

router.post("/register", authLimiter, async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || "Dados inválidos." });
  }

  const { email, password, name } = parsed.data;

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "Este e-mail já está cadastrado." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userCount = await prisma.user.count();
    const role = userCount === 0 ? "SUPERUSER" : "USER";

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
        role,
        verificationToken,
        verificationTokenExpiry,
      },
    });

    // Send verification email (non-blocking — don't fail registration if email fails)
    sendVerificationEmail(email, user.name || "", verificationToken).catch((err) =>
      console.error("[Email] Falha ao enviar e-mail de verificação:", err.message)
    );

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });
    return res.status(201).json({ token, user: safeUser(user) });
  } catch (error: any) {
    console.error("Erro no registro:", error);
    return res.status(500).json({ error: "Erro interno no servidor ao registrar usuário." });
  }
});

// ── LOGIN ─────────────────────────────────────────────────────────────────────

router.post("/login", authLimiter, async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || "Dados inválidos." });
  }

  const { email, password } = parsed.data;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: "E-mail ou senha incorretos." });
    }

    if (!user.password) {
      return res.status(400).json({ error: 'Esta conta usa login pelo Google. Use o botão "Entrar com Google".' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: "E-mail ou senha incorretos." });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });
    return res.json({ token, user: safeUser(user) });
  } catch (error: any) {
    console.error("Erro no login:", error);
    return res.status(500).json({ error: "Erro interno no servidor ao fazer login." });
  }
});

// ── ME (dados do usuário autenticado) ─────────────────────────────────────────

router.get("/me", async (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Token não fornecido." });
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET) as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(404).json({ error: "Usuário não encontrado." });
    return res.json(safeUser(user));
  } catch {
    return res.status(401).json({ error: "Token inválido." });
  }
});

// ── VERIFICAÇÃO DE E-MAIL ─────────────────────────────────────────────────────

router.get("/verify-email", async (req: Request, res: Response) => {
  const { token } = req.query as { token: string };
  if (!token) return res.status(400).json({ error: "Token não fornecido." });

  try {
    const user = await prisma.user.findUnique({ where: { verificationToken: token } });

    if (!user) return res.status(400).json({ error: "Token inválido ou já utilizado." });

    if (user.verificationTokenExpiry && user.verificationTokenExpiry < new Date()) {
      return res.status(400).json({ error: "Token expirado. Faça login para receber um novo link." });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verificationToken: null, verificationTokenExpiry: null },
    });

    return res.json({ message: "E-mail verificado com sucesso!" });
  } catch (error: any) {
    console.error("Erro na verificação de e-mail:", error);
    return res.status(500).json({ error: "Erro interno." });
  }
});

// ── ESQUECI A SENHA ───────────────────────────────────────────────────────────

router.post("/forgot-password", authLimiter, async (req: Request, res: Response) => {
  const { email } = z.object({ email: z.string().email().trim().toLowerCase() }).parse(req.body);

  // Always return success to avoid user enumeration
  const user = await prisma.user.findUnique({ where: { email } }).catch(() => null);

  if (user && user.password) {
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await prisma.user.update({
      where: { id: user.id },
      data: { resetPasswordToken: resetToken, resetPasswordTokenExpiry: resetExpiry },
    });

    sendPasswordResetEmail(email, user.name || "", resetToken).catch((err) =>
      console.error("[Email] Falha ao enviar e-mail de redefinição:", err.message)
    );
  }

  return res.json({ message: "Se este e-mail estiver cadastrado, você receberá as instruções em breve." });
});

// ── REDEFINIR SENHA ───────────────────────────────────────────────────────────

router.post("/reset-password", authLimiter, async (req: Request, res: Response) => {
  const schema = z.object({
    token: z.string().min(1),
    password: z.string().min(6, "A senha deve conter no mínimo 6 caracteres."),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || "Dados inválidos." });
  }

  const { token, password } = parsed.data;

  try {
    const user = await prisma.user.findUnique({ where: { resetPasswordToken: token } });

    if (!user) return res.status(400).json({ error: "Token inválido ou já utilizado." });

    if (user.resetPasswordTokenExpiry && user.resetPasswordTokenExpiry < new Date()) {
      return res.status(400).json({ error: "Token expirado. Solicite um novo link." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordTokenExpiry: null,
      },
    });

    return res.json({ message: "Senha redefinida com sucesso! Faça login com a nova senha." });
  } catch (error: any) {
    console.error("Erro na redefinição de senha:", error);
    return res.status(500).json({ error: "Erro interno." });
  }
});

// ── GOOGLE OAUTH ──────────────────────────────────────────────────────────────

router.get("/google", (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(503).json({ error: "Login com Google não configurado no servidor." });
  }

  const state = crypto.randomBytes(16).toString("hex");
  oauthStateCache.set(state, Date.now());

  const redirectUri = `${BACKEND_URL}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });

  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get("/google/callback", async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) return res.redirect(`${FRONTEND_URL}/?oauth_error=cancelled`);

  if (!state || !oauthStateCache.has(state)) {
    return res.redirect(`${FRONTEND_URL}/?oauth_error=invalid_state`);
  }
  oauthStateCache.delete(state);

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.redirect(`${FRONTEND_URL}/?oauth_error=not_configured`);
  }

  try {
    const redirectUri = `${BACKEND_URL}/api/auth/google/callback`;

    // Exchange authorization code for access token
    const tokenRes = await axios.post<{ access_token: string }>(
      "https://oauth2.googleapis.com/token",
      {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }
    );
    const accessToken = tokenRes.data.access_token;

    // Get user profile from Google
    const profileRes = await axios.get<{
      id: string;
      email: string;
      name: string;
      picture: string;
      verified_email: boolean;
    }>("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const { id: googleId, email, name, picture, verified_email } = profileRes.data;

    // Find existing user by googleId or email
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId }, { email: email.toLowerCase() }] },
    });

    if (user) {
      // Merge Google fields into existing account
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId,
          avatarUrl: picture,
          emailVerified: verified_email || user.emailVerified,
          verificationToken: null,
          verificationTokenExpiry: null,
        },
      });
    } else {
      const userCount = await prisma.user.count();
      user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          name,
          googleId,
          avatarUrl: picture,
          emailVerified: verified_email,
          role: userCount === 0 ? "SUPERUSER" : "USER",
        },
      });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });
    return res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (err: any) {
    console.error("[Google OAuth] Erro:", err?.response?.data || err.message);
    return res.redirect(`${FRONTEND_URL}/?oauth_error=failed`);
  }
});

export default router;
