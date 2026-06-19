import { Router, Request, Response } from "express";
import { prisma } from "../db";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth";
import { decryptToken } from "../utils/crypto";
import { normalizePhone, phoneVariants } from "../services/phoneService";
import { metaService } from "../services/metaService";
import { messageEventEmitter } from "../utils/emitter";
import axios from "axios";

const router = Router();

// Aplica autenticação a todas as rotas de chat
router.use(authMiddleware);

interface DBConversationMessage {
  phone: string;
  body: string | null;
  templateName: string | null;
  status: string;
  direction: string;
  messageType: string;
  createdAt: Date;
}

// Obter a lista de conversas ativas (scoped to user) - OTIMIZADO
router.get("/accounts/:accountId/conversations", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado." });

    // Buscar mensagens mais recentes por contato.
    // IMPORTANTE: DISTINCT ON em PostgreSQL exige que a primeira coluna do ORDER BY
    // seja a mesma do DISTINCT ON. Por isso usamos uma subquery para pegar a mais recente por "to".
    const messages: DBConversationMessage[] = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT ON ("to")
        "to" as phone,
        body,
        "templateName",
        status,
        direction,
        "messageType",
        "createdAt"
      FROM "Message"
      WHERE "accountId" = $1
      ORDER BY "to", "createdAt" DESC
    `, accountId);

    // Buscar contatos salvos no WhatsAppContact para mapear nomes de perfil
    const contacts = await prisma.whatsAppContact.findMany({ where: { accountId } });
    const contactMap = new Map(contacts.map((c: any) => [c.phone, c.profileName]));

    // Mapear conversas finais
    const conversations = messages.map((msg) => {
      const normalizedKey = normalizePhone(msg.phone);
      return {
        phone: normalizedKey,
        profileName: contactMap.get(normalizedKey) || null,
        lastMessage: msg.body || (msg.templateName ? `Template: ${msg.templateName}` : "Mídia"),
        updatedAt: msg.createdAt,
        status: msg.status,
        direction: msg.direction,
        messageType: msg.messageType,
      };
    });

    // Ordenar de forma decrescente pela última interação
    conversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    res.json(conversations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obter histórico de mensagens com um contato específico (scoped to user)
router.get("/accounts/:accountId/conversations/:phone/messages", async (req: Request, res: Response) => {
  const { accountId, phone } = req.params;
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado." });

    const messages = await prisma.message.findMany({
      where: { accountId, to: { in: phoneVariants(phone) } },
      orderBy: { createdAt: "asc" }
    });

    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Proxy de mídia recebida — busca o conteúdo binário da Meta e repassa ao frontend
router.get("/accounts/:accountId/media/:mediaId", async (req: Request, res: Response) => {
  const { accountId, mediaId } = req.params;
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) return res.status(404).json({ error: "Conta não encontrada." });

    const token = decryptToken(account.accessToken);

    // 1. Buscar URL temporária da mídia
    const metaRes = await metaService.getMediaUrl(mediaId, token);
    const mediaUrl: string = metaRes.data.url;
    const mimeType: string = metaRes.data.mime_type || "application/octet-stream";

    // 2. Baixar o conteúdo binário e repassar ao cliente (evita CORS)
    const mediaContent = await metaService.getMediaContentStream(mediaUrl, token);

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "private, max-age=300");
    mediaContent.data.pipe(res);
  } catch (error: any) {
    console.error("[Media Proxy] Erro ao buscar mídia:", error.response?.data || error.message);
    res.status(500).json({ error: "Não foi possível carregar a mídia." });
  }
});

// Enviar mensagem de texto livre / resposta para um contato (scoped to user)
router.post("/accounts/:accountId/messages/reply", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { to, body, variables } = req.body;

  if (!to || !body) {
    return res.status(400).json({ error: "Telefone (to) e mensagem (body) são obrigatórios." });
  }

  const normalizedTo = normalizePhone(to);

  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado." });

    // Descriptografar o token de acesso da Meta
    const decryptedToken = decryptToken(account.accessToken);

    // Enviar mensagem de texto livre via API da Meta
    const response = await metaService.sendMessage(account.phoneNumberId, decryptedToken, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizedTo,
      type: "text",
      text: {
        preview_url: false,
        body: body
      }
    });

    const wamid = response.data.messages?.[0]?.id;

    // Gravar no banco de dados local como OUTGOING
    const savedMsg = await prisma.message.create({
      data: {
        accountId,
        wamid,
        to: normalizedTo,
        status: "SENT",
        direction: "OUTGOING",
        messageType: "TEXT",
        body,
        variables: variables || null,
      }
    });

    console.log(`[Chat] Resposta enviada com sucesso para ${normalizedTo}. Wamid: ${wamid}`);

    // Encaminhar resposta humana manual para o n8n para pausar o robô (takeover humano)
    const n8nWebhookUrl = process.env.N8N_SDR_WEBHOOK_URL;
    if (n8nWebhookUrl) {
      // Ignorar se a mensagem foi disparada de forma automatizada (ex: pelo próprio SDR n8n)
      const isSdrDisparo = variables && (variables as any).sentBy === "SDR";
      
      if (!isSdrDisparo) {
        const n8nPayload = {
          event: "on-message",
          type: "text",
          from: normalizedTo,
          to: normalizedTo,
          destiny: account.phoneNumberId,
          isgroup: false,
          isGroupMsg: false,
          fromMe: true,
          id: wamid,
          content: body,
          login_atendente: "human", // sinaliza atendimento humano
        };

        console.log(`[Webhook Forward Outgoing] Encaminhando resposta de atendente humana para n8n: ${n8nWebhookUrl}`);
        axios.post(n8nWebhookUrl, n8nPayload).catch(err => {
          console.error("[Webhook Forward Outgoing] Falha ao encaminhar resposta para n8n:", err.message);
        });
      }
    }

    // Emitir evento em tempo real via SSE
    messageEventEmitter.emit("messageUpdated", {
      accountId: savedMsg.accountId,
      messageId: savedMsg.id,
      status: savedMsg.status,
      direction: savedMsg.direction,
      body: savedMsg.body,
      to: savedMsg.to,
      messageType: savedMsg.messageType,
      wamid: savedMsg.wamid,
      errorMessage: savedMsg.errorMessage,
      updatedAt: savedMsg.updatedAt,
      variables: savedMsg.variables,
    });

    res.status(201).json(savedMsg);
  } catch (error: any) {
    console.error(`[Chat] Erro ao enviar resposta para ${to}:`, error.response?.data || error.message);
    const metaError = error.response?.data?.error;
    const errMsg = metaError ? `Erro da Meta: ${metaError.message}` : error.message;
    res.status(error.response?.status || 500).json({ error: errMsg });
  }
});

export default router;
