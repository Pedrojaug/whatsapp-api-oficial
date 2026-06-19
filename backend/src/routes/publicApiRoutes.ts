import { Router, Response } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../db";
import { apiKeyMiddleware, ApiKeyRequest } from "../middlewares/apiKeyAuth";

const router = Router();

const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => (req as ApiKeyRequest).apiKeyId ?? req.ip ?? "unknown",
  message: { error: "Limite de taxa excedido. Máximo 60 requisições/min por chave." },
  validate: { trustProxy: false },
});

router.use(apiKeyMiddleware);
router.use(apiRateLimit);

/**
 * POST /api/v1/send
 * Envia uma mensagem via template aprovado.
 *
 * Headers: Authorization: Bearer sk_...
 * Body: { to, templateName, variables?, mediaUrl?, scheduledAt? }
 */
router.post("/send", async (req: ApiKeyRequest, res: Response) => {
  const { to, templateName, variables, mediaUrl, scheduledAt } = req.body;
  const accountId = req.accountId!;

  if (!to || !templateName) {
    return res.status(400).json({ error: "Campos 'to' e 'templateName' são obrigatórios." });
  }

  const cleanPhone = String(to).replace(/\D/g, "");
  if (cleanPhone.length < 10 || cleanPhone.length > 15) {
    return res.status(400).json({ error: "Número de telefone inválido. Use formato internacional (ex: 5511999999999)." });
  }

  const template = await prisma.template.findFirst({
    where: { accountId, name: String(templateName), status: "APPROVED" },
  });
  if (!template) {
    return res.status(404).json({ error: `Template '${templateName}' não encontrado ou não aprovado nesta conta.` });
  }

  const optedOut = await prisma.optOut.findUnique({
    where: { phone_accountId: { phone: cleanPhone, accountId } },
  });
  if (optedOut) {
    return res.status(422).json({ error: "Este número está na lista de opt-out.", code: "OPT_OUT" });
  }

  const message = await prisma.message.create({
    data: {
      to: cleanPhone,
      templateName: String(templateName),
      variables: Array.isArray(variables) ? variables : [],
      mediaUrl: mediaUrl ? String(mediaUrl) : null,
      accountId,
      status: "PENDING",
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    },
    select: { id: true, to: true, status: true, templateName: true, scheduledAt: true, createdAt: true },
  });

  res.status(201).json(message);
});

/**
 * GET /api/v1/messages/:id
 * Consulta o status de uma mensagem pelo ID interno.
 */
router.get("/messages/:id", async (req: ApiKeyRequest, res: Response) => {
  const { id } = req.params;
  const accountId = req.accountId!;

  const message = await prisma.message.findFirst({
    where: { id, accountId },
    select: {
      id: true, to: true, status: true, templateName: true,
      wamid: true, errorMessage: true, scheduledAt: true,
      createdAt: true, updatedAt: true,
    },
  });

  if (!message) return res.status(404).json({ error: "Mensagem não encontrada." });
  res.json(message);
});

/**
 * GET /api/v1/templates
 * Lista templates aprovados disponíveis nesta conta.
 */
router.get("/templates", async (req: ApiKeyRequest, res: Response) => {
  const accountId = req.accountId!;

  const templates = await prisma.template.findMany({
    where: { accountId, status: "APPROVED" },
    select: { name: true, language: true, category: true, components: true },
    orderBy: { name: "asc" },
  });

  res.json(templates);
});

export default router;
