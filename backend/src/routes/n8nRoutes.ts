import { Router, Request, Response } from "express";
import { prisma } from "../db";
import { messageEventEmitter } from "../utils/emitter";
import { metaService } from "../services/metaService";

const router = Router();

// Middleware de validação de API Key exclusivo para rotas N8N
router.use("/n8n", (req, res, next) => {
  const apiKey = req.headers["x-api-key"] as string;
  const expectedKey = process.env.N8N_API_KEY;
  if (!expectedKey) {
    return res.status(503).json({ error: "N8N_API_KEY not configured" });
  }
  if (!apiKey || apiKey !== expectedKey) {
    return res.status(401).json({ error: "Invalid API key" });
  }
  next();
});

// Proxy de mídia Meta para o n8n baixar arquivos de mídia
router.get("/n8n/media/:mediaId", async (req: Request, res: Response) => {
  const { mediaId } = req.params;
  const metaToken = req.query.meta_token as string;
  if (!metaToken || !mediaId) {
    return res.status(400).json({ error: "meta_token e mediaId são obrigatórios" });
  }
  try {
    const metaRes = await metaService.getMediaUrl(mediaId, metaToken);
    const mediaUrl: string = metaRes.data.url;
    const mimeType: string = metaRes.data.mime_type || "application/octet-stream";
    const mediaContent = await metaService.getMediaContentStream(mediaUrl, metaToken);

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "private, max-age=300");
    mediaContent.data.pipe(res);
  } catch (error: any) {
    console.error("[N8N Media Proxy] Erro:", error.response?.data || error.message);
    res.status(500).json({ error: "Erro ao baixar mídia da Meta" });
  }
});

// Envio de mensagem de texto via Meta API para o n8n responder ao lead
router.post("/n8n/send", async (req: Request, res: Response) => {
  const { phone_number_id, to, body: msgBody, meta_token } = req.body;
  if (!phone_number_id || !to || !msgBody || !meta_token) {
    return res.status(400).json({ error: "phone_number_id, to, body e meta_token são obrigatórios" });
  }
  try {
    const metaRes = await metaService.sendMessage(phone_number_id, meta_token, {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: msgBody }
    });
    const wamid = metaRes.data?.messages?.[0]?.id;

    // Salvar no banco e emitir SSE para aparecer no chat do site
    const account = await prisma.account.findFirst({ where: { phoneNumberId: phone_number_id } });
    if (account) {
      const savedMsg = await prisma.message.create({
        data: {
          wamid,
          to,
          status: "SENT",
          direction: "OUTGOING",
          messageType: "TEXT",
          body: msgBody,
          accountId: account.id,
          variables: { sentBy: "SDR" } as any,
        },
      });
      messageEventEmitter.emit("messageUpdated", {
        accountId: account.id,
        messageId: savedMsg.id,
        status: "SENT",
        direction: "OUTGOING",
        body: msgBody,
        to,
        messageType: "TEXT",
        wamid: savedMsg.wamid,
        updatedAt: savedMsg.updatedAt,
        variables: savedMsg.variables,
      });
    }

    res.json({ success: true, wamid });
  } catch (error: any) {
    console.error("[N8N Send] Erro:", error.response?.data || error.message);
    res.status(500).json({ error: "Erro ao enviar mensagem via Meta API" });
  }
});

export default router;
