import { Router, Request, Response } from "express";
import crypto from "crypto";
import axios from "axios";
import { prisma } from "../db";
import { decryptToken } from "../utils/crypto";
import { normalizePhone } from "../services/phoneService";
import { messageEventEmitter } from "../utils/emitter";
import { isOptOutMessage } from "../utils/optoutKeywords";

const router = Router();

// NOTA: As rotas de webhook são públicas e NÃO devem utilizar o authMiddleware

// Webhook Verification (GET)
router.get("/webhooks", (req: Request, res: Response) => {
  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;
  if (!verifyToken) {
    console.error("[Webhook] WEBHOOK_VERIFY_TOKEN não definido nas variáveis de ambiente.");
    return res.sendStatus(500);
  }

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === verifyToken) {
      console.log("WEBHOOK_VERIFIED");
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403);
    }
  }
  res.sendStatus(400);
});

// Webhook Receiver (POST)
router.post("/webhooks", async (req: Request, res: Response) => {
  const body = req.body;
  console.log(`[Webhook] POST recebido de Meta. object=${body?.object}, entries=${body?.entry?.length ?? 0}`);

  // Suporta múltiplos apps da Meta: FACEBOOK_APP_SECRET pode conter várias
  // chaves secretas separadas por vírgula (uma por app/cliente).
  const appSecrets = (process.env.FACEBOOK_APP_SECRET || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  const signature = req.headers["x-hub-signature-256"] as string;

  if (appSecrets.length > 0) {
    if (!signature) {
      console.warn("[Webhook] Assinatura ausente (x-hub-signature-256).");
      return res.status(401).send("Signature missing");
    }

    const parts = signature.split("=");
    if (parts[0] !== "sha256" || !parts[1]) {
      console.warn("[Webhook] Formato de assinatura inválido.");
      return res.status(400).send("Invalid signature format");
    }

    const signatureHash = parts[1];
    const rawBody = (req as any).rawBody;

    if (!rawBody) {
      console.warn("[Webhook] Corpo bruto da requisição indisponível.");
      return res.status(400).send("Raw body not available");
    }

    let sigBuf: Buffer;
    try {
      sigBuf = Buffer.from(signatureHash, "hex");
    } catch (err: any) {
      console.error("[Webhook] Erro ao processar assinatura recebida:", err.message);
      return res.status(403).send("Signature verification error");
    }

    // Válido se a assinatura bater com QUALQUER uma das chaves configuradas
    const matched = appSecrets.some(secret => {
      const expectedHash = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
      const expBuf = Buffer.from(expectedHash, "hex");
      return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
    });

    if (!matched) {
      console.warn(`[Webhook] Assinatura inválida para todas as ${appSecrets.length} chave(s) configurada(s). Recebida: ${signatureHash}`);
      return res.status(403).send("Signature mismatch");
    }
  }

  // Responder 200 OK imediatamente para a Meta não ficar reenviando
  res.sendStatus(200);

  try {
    // Verificar se o evento é do WhatsApp Business
    if (body.object === "whatsapp_business_account") {
      for (const entry of body.entry) {
        // 1. Processar mudanças de status de mensagens
        const changes = entry.changes;
        for (const change of changes) {
          const value = change.value;
          
          if (change.field === "messages") {
            // 1.1 Atualizações de Status (Enviado, Entregue, Lido, Falhou)
            if (value.statuses && Array.isArray(value.statuses)) {
              for (const statusObj of value.statuses) {
                const wamid = statusObj.id;
                const status = statusObj.status?.toUpperCase(); // DELIVERED, READ, SENT, FAILED
                const errors = statusObj.errors;

                let errorMessage = null;
                if (errors && errors.length > 0) {
                  errorMessage = errors[0].message;
                }

                // Procurar mensagem por wamid e atualizar status
                const msg = await prisma.message.findUnique({ where: { wamid } });
                if (msg) {
                  const updatedMsg = await prisma.message.update({
                    where: { wamid },
                    data: {
                      status,
                      ...(errorMessage ? { errorMessage } : {}),
                    },
                  });
                  console.log(`Mensagem ${wamid} atualizada para o status: ${status}`);

                  // Emitir evento em tempo real para SSE
                  messageEventEmitter.emit("messageUpdated", {
                    accountId: updatedMsg.accountId,
                    messageId: updatedMsg.id,
                    status: updatedMsg.status,
                    direction: updatedMsg.direction,
                    body: updatedMsg.body,
                    to: updatedMsg.to,
                    messageType: updatedMsg.messageType,
                    wamid: updatedMsg.wamid,
                    errorMessage: updatedMsg.errorMessage,
                    updatedAt: updatedMsg.updatedAt,
                  });
                } else {
                  console.warn(`[Webhook] Status "${status}" recebido para wamid desconhecido (${wamid}) — nenhuma mensagem correspondente no banco. Evento descartado.`);
                }
              }
            }

            // 1.2/ Mensagens Recebidas do Cliente (Respostas)
            if (value.messages && Array.isArray(value.messages)) {
              // Extrair nome de perfil do campo contacts (entregue junto com as mensagens)
              const contactsArr = value.contacts as any[] | undefined;

              for (const messageObj of value.messages) {
                const wamid = messageObj.id;
                const from = normalizePhone(messageObj.from); // Normaliza 9º dígito BR
                const type = messageObj.type; // text, image, document, video, audio, etc.

                // Nome de perfil do WhatsApp do remetente
                const profileName: string | null =
                  contactsArr?.find((c: any) => normalizePhone(c.wa_id) === from)?.profile?.name || null;
                
                let bodyText = null;
                let mediaUrl = null;
                
                if (type === "text") {
                  bodyText = messageObj.text?.body;

                  // Detecção de opt-out: registrar automaticamente se o contato enviar STOP
                  if (bodyText && isOptOutMessage(bodyText)) {
                    const phoneIdForOptOut = value.metadata?.phone_number_id;
                    if (phoneIdForOptOut) {
                      const accForOptOut = await prisma.account.findFirst({ where: { phoneNumberId: phoneIdForOptOut } });
                      if (accForOptOut) {
                        await prisma.optOut.upsert({
                          where: { phone_accountId: { phone: from, accountId: accForOptOut.id } },
                          update: { reason: "KEYWORD" },
                          create: { phone: from, accountId: accForOptOut.id, reason: "KEYWORD" },
                        });
                        console.log(`[Webhook] Opt-out registrado automaticamente para ${from} (conta ${accForOptOut.id}) — keyword detectada: "${bodyText}"`);
                      }
                    }
                  }
                } else if (type === "image") {
                  bodyText = messageObj.image?.caption || "📷 Imagem";
                  mediaUrl = messageObj.image?.id;
                } else if (type === "document") {
                  bodyText = messageObj.document?.filename || "📄 Documento";
                  mediaUrl = messageObj.document?.id;
                } else if (type === "video") {
                  bodyText = messageObj.video?.caption || "🎬 Vídeo";
                  mediaUrl = messageObj.video?.id;
                } else if (type === "audio") {
                  bodyText = messageObj.audio?.voice ? "🎤 Mensagem de voz" : "🎵 Áudio";
                  mediaUrl = messageObj.audio?.id;
                } else if (type === "sticker") {
                  bodyText = "🩵 Figurinha";
                  mediaUrl = messageObj.sticker?.id;
                } else if (type === "button") {
                  // Cliente clicou em um botão de resposta rápida de um template
                  bodyText = messageObj.button?.text || messageObj.button?.payload || "Resposta de botão";
                } else if (type === "interactive") {
                  // Cliente respondeu a uma mensagem interativa (botões ou lista)
                  const interactive = messageObj.interactive;
                  bodyText =
                    interactive?.button_reply?.title ||
                    interactive?.list_reply?.title ||
                    "Resposta interativa";
                } else if (type === "location") {
                  const loc = messageObj.location;
                  const label = loc?.name || loc?.address;
                  bodyText = label
                    ? `📍 Localização: ${label}`
                    : `📍 Localização (${loc?.latitude}, ${loc?.longitude})`;
                } else if (type === "contacts") {
                  const names = (messageObj.contacts as any[] | undefined)
                    ?.map((c: any) => c.name?.formatted_name)
                    .filter(Boolean)
                    .join(", ");
                  bodyText = names ? `👤 Contato: ${names}` : "👤 Contato compartilhado";
                } else if (type === "reaction") {
                  bodyText = `Reagiu com ${messageObj.reaction?.emoji || "👍"} a uma mensagem`;
                } else if (type === "order") {
                  bodyText = "🛒 Pedido recebido via catálogo";
                } else if (type === "unsupported" || type === "unknown") {
                  bodyText = "Mensagem não suportada pelo WhatsApp Business API (ex: enquete, evento ou formato novo)";
                } else {
                  bodyText = `Mensagem do tipo ${type} recebida`;
                }

                // Encontrar conta do WhatsApp correspondente pelo phoneNumberId que recebeu
                const phoneId = value.metadata?.phone_number_id;
                console.log(`[Webhook] Processando mensagem recebida. Remetente (from): ${from}, phoneNumberId da Meta: ${phoneId}`);
                if (phoneId) {
                  const account = await prisma.account.findFirst({
                    where: { phoneNumberId: phoneId }
                  });

                  if (account) {
                    console.log(`[Webhook] Conta encontrada no banco: ${account.name} (ID: ${account.id})`);

                    // Salvar/atualizar nome de perfil do contato
                    if (profileName) {
                      await (prisma as any).whatsAppContact.upsert({
                        where: { accountId_phone: { accountId: account.id, phone: from } },
                        update: { profileName },
                        create: { accountId: account.id, phone: from, profileName },
                      });
                    }

                    // Evitar duplicações caso a Meta reenvie o webhook
                    const existingMsg = await prisma.message.findUnique({ where: { wamid } });

                    if (!existingMsg) {
                      const savedMsg = await prisma.message.create({
                        data: {
                          accountId: account.id,
                          wamid,
                          to: from, // Para mensagens recebidas, salvamos o telefone do remetente em "to"
                          status: "RECEIVED",
                          direction: "INCOMING",
                          messageType: type.toUpperCase(),
                          body: bodyText,
                          mediaUrl: mediaUrl,
                        }
                      });

                      console.log(`[Webhook] Nova mensagem recebida de ${from} salva no banco. Wamid: ${wamid}`);

                      // Emitir evento em tempo real para o frontend
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
                        profileName,
                      });

                      // Encaminhar webhook para o n8n do SDR se configurado
                      const n8nWebhookUrl = process.env.N8N_SDR_WEBHOOK_URL;
                      if (n8nWebhookUrl) {
                        const finalProfileName = profileName || "";
                        
                        let mimeType = "image/jpeg";
                        if (type === "image" && messageObj.image?.mime_type) mimeType = messageObj.image.mime_type;
                        else if (type === "audio" && messageObj.audio?.mime_type) mimeType = messageObj.audio.mime_type;
                        else if (type === "video" && messageObj.video?.mime_type) mimeType = messageObj.video.mime_type;
                        else if (type === "document" && messageObj.document?.mime_type) mimeType = messageObj.document.mime_type;

                        const n8nPayload = {
                          event: "on-message",
                          type: type === "voice" ? "audio" : type,
                          from: from,
                          phone: from,
                          cel_contato: from,
                          destiny: account.phoneNumberId,
                          cel_conectado: account.phoneNumberId,
                          isgroup: false,
                          isGroupMsg: false,
                          fromMe: false,
                          id: wamid,
                          content: bodyText || "",
                          caption: bodyText || "",
                          pushName: finalProfileName,
                          senderName: finalProfileName,
                          nome_contato: finalProfileName,
                          conteudo_buffer: mediaUrl ? {
                            id: mediaUrl,
                            mimetype: mimeType
                          } : null,
                          account_id: account.id,
                          phone_number_id: account.phoneNumberId,
                          access_token: decryptToken(account.accessToken)
                        };

                        console.log(`[Webhook] Encaminhando mensagem de ${from} para n8n: ${n8nWebhookUrl}`);
                        axios.post(n8nWebhookUrl, n8nPayload).catch(err => {
                          console.error("[Webhook] Falha ao encaminhar mensagem para n8n:", err.message);
                        });
                      }
                    } else {
                      console.log(`[Webhook] Mensagem com wamid ${wamid} já existe no banco. Ignorando.`);
                    }
                  } else {
                    console.warn(`[Webhook] Nenhuma conta local cadastrada com o phoneNumberId: ${phoneId}`);
                  }
                } else {
                  console.warn("[Webhook] Atributo metadata.phone_number_id ausente no payload.");
                }
              }
            }
          }

          // 2. Processar mudanças de status de templates (message_template_status_update)
          if (change.field === "message_template_status_update") {
            const templateEvent = value.event; // APPROVED, REJECTED, PENDING
            const metaTemplateId = value.message_template_id;
            const templateName = value.message_template_name;

            // Procurar template por metaId ou nome e atualizar status
            const template = await prisma.template.findFirst({
              where: {
                OR: [
                  { metaId: String(metaTemplateId) },
                  { name: templateName }
                ]
              }
            });

            if (template) {
              await prisma.template.update({
                where: { id: template.id },
                data: {
                  status: templateEvent, // APPROVED, REJECTED, PENDING
                },
              });
              console.log(`Template ${templateName} atualizado para o status: ${templateEvent}`);
            }
          }
        }
      }
    }
  } catch (error: any) {
    console.error("Erro no processamento do webhook:", error.message);
  }
});

export default router;
