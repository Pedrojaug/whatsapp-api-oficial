import { prisma } from "../db";
import axios from "axios";
import { decryptToken } from "../utils/crypto";
import { messageEventEmitter } from "../utils/emitter";

let isProcessing = false;

/**
 * Inicia o worker de envio em lote em background (Transactional Outbox Pattern)
 */
export function startBackgroundDispatcher() {
  console.log("🚀 Servidor de disparo em background inicializado.");
  
  setInterval(async () => {
    if (isProcessing) return;
    isProcessing = true;

    try {
      const now = new Date();

      // 1. Busca até 10 mensagens PENDING que já passaram da data agendada e da hora de retentativa
      const pendingMessages = await prisma.message.findMany({
        where: {
          status: "PENDING",
          OR: [
            { scheduledAt: null },
            { scheduledAt: { lte: now } }
          ],
          AND: [
            {
              OR: [
                { nextRetryAt: null },
                { nextRetryAt: { lte: now } }
              ]
            }
          ]
        },
        take: 10,
        orderBy: { createdAt: "asc" },
        include: { account: true }
      });

      if (pendingMessages.length === 0) {
        isProcessing = false;
        return;
      }

      console.log(`[Worker] Processando lote de ${pendingMessages.length} mensagens pendentes...`);

      for (const msg of pendingMessages) {
        try {
          const account = msg.account;
          const decryptedToken = decryptToken(account.accessToken);
          
          // Reconstruir variáveis mapeadas salvas
          const varsObj = msg.variables as any;
          const resolvedVars = varsObj?.variables || [];
          const mediaUrl = varsObj?.mediaUrl || null;
          
          // Buscar template associado à conta para ler idioma e componentes
          const template = await prisma.template.findFirst({
            where: { accountId: msg.accountId, name: msg.templateName }
          });

          const templateComponents = template?.components as any[];
          const headerComp = templateComponents && Array.isArray(templateComponents)
            ? templateComponents.find((c: any) => c.type === "HEADER")
            : null;

          const components: any[] = [];

          // 1. Cabeçalho de Mídia
          if (headerComp && ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerComp.format) && mediaUrl) {
            const typeLower = headerComp.format.toLowerCase();
            components.push({
              type: "header",
              parameters: [
                {
                  type: typeLower,
                  [typeLower]: {
                    link: mediaUrl,
                    ...(typeLower === "document" ? { filename: mediaUrl.split("/").pop() || "document.pdf" } : {})
                  }
                }
              ]
            });
          }

          // 2. Parâmetros do Corpo
          if (resolvedVars && resolvedVars.length > 0) {
            components.push({
              type: "body",
              parameters: resolvedVars.map((v: any) => ({
                type: "text",
                text: String(v),
              })),
            });
          }

          // Chamar a API Oficial da Meta
          const response = await axios.post(
            `https://graph.facebook.com/v19.0/${account.phoneNumberId}/messages`,
            {
              messaging_product: "whatsapp",
              to: msg.to,
              type: "template",
              template: {
                name: msg.templateName,
                language: {
                  code: template?.language || "pt_BR",
                },
                ...(components.length > 0 ? { components } : {}),
              },
            },
            {
              headers: { Authorization: `Bearer ${decryptedToken}` },
            }
          );

          const wamid = response.data.messages?.[0]?.id;

          // Atualizar para SENT no banco
          const updatedMsg = await prisma.message.update({
            where: { id: msg.id },
            data: {
              wamid,
              status: "SENT",
              errorMessage: null
            }
          });

          console.log(`[Worker] Mensagem ${msg.id} enviada com sucesso para ${msg.to}. Wamid: ${wamid}`);

          // Emitir evento em tempo real para SSE
          messageEventEmitter.emit("messageUpdated", {
            accountId: updatedMsg.accountId,
            messageId: updatedMsg.id,
            status: updatedMsg.status,
            wamid: updatedMsg.wamid,
            errorMessage: updatedMsg.errorMessage,
            updatedAt: updatedMsg.updatedAt,
          });
        } catch (error: any) {
          console.error(`[Worker] Erro ao enviar mensagem ${msg.id}:`, error.response?.data || error.message);
          
          const metaError = error.response?.data?.error;
          const errMsg = metaError?.message || error.message;
          const errorCode = metaError?.code;

          // Erros não retentáveis (erros de credencial expirada 190 ou erros de parâmetros 100)
          const isFatalError = errorCode === 190 || errorCode === 100;
          const nextRetryCount = msg.retryCount + 1;

          if (isFatalError || nextRetryCount > 3) {
            // Falha permanente
            const updatedMsg = await prisma.message.update({
              where: { id: msg.id },
              data: {
                status: "FAILED",
                errorMessage: `${isFatalError ? "Erro Fatal Meta: " : "Excedeu retentativas: "}${errMsg}`,
              }
            });
            console.log(`[Worker] Mensagem ${msg.id} marcada como FAILED permanentemente. Erro: ${errMsg}`);

            // Emitir evento em tempo real para SSE
            messageEventEmitter.emit("messageUpdated", {
              accountId: updatedMsg.accountId,
              messageId: updatedMsg.id,
              status: updatedMsg.status,
              wamid: updatedMsg.wamid,
              errorMessage: updatedMsg.errorMessage,
              updatedAt: updatedMsg.updatedAt,
            });
          } else {
            // Agendar retentativa com backoff exponencial (1min, 5min, 15min)
            const backoffMinutes = nextRetryCount === 1 ? 1 : nextRetryCount === 2 ? 5 : 15;
            const nextRetryAtDate = new Date();
            nextRetryAtDate.setMinutes(nextRetryAtDate.getMinutes() + backoffMinutes);

            const updatedMsg = await prisma.message.update({
              where: { id: msg.id },
              data: {
                retryCount: nextRetryCount,
                nextRetryAt: nextRetryAtDate,
                errorMessage: `Tentativa #${nextRetryCount} falhou: ${errMsg}`
              }
            });
            console.log(`[Worker] Mensagem ${msg.id} falhou temporariamente. Agendada retentativa #${nextRetryCount} para daqui a ${backoffMinutes} minutos (${nextRetryAtDate.toLocaleTimeString()}).`);

            // Emitir evento em tempo real para SSE
            messageEventEmitter.emit("messageUpdated", {
              accountId: updatedMsg.accountId,
              messageId: updatedMsg.id,
              status: updatedMsg.status,
              wamid: updatedMsg.wamid,
              errorMessage: updatedMsg.errorMessage,
              updatedAt: updatedMsg.updatedAt,
            });
          }
        }

        // Delay preventivo de 200ms para respeitar limites de taxa e conexões
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (err: any) {
      console.error("[Worker] Erro crítico no loop do dispatcher:", err.message);
    } finally {
      isProcessing = false;
    }
  }, 5000);
}
