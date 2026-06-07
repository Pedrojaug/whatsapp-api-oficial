import { prisma } from "../db";
import axios from "axios";
import { decryptToken } from "../utils/crypto";

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
      // 1. Busca até 10 mensagens com status PENDING ordenadas por data
      const pendingMessages = await prisma.message.findMany({
        where: { status: "PENDING" },
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
          await prisma.message.update({
            where: { id: msg.id },
            data: {
              wamid,
              status: "SENT",
              errorMessage: null
            }
          });

          console.log(`[Worker] Mensagem ${msg.id} enviada com sucesso para ${msg.to}. Wamid: ${wamid}`);
        } catch (error: any) {
          console.error(`[Worker] Erro ao enviar mensagem ${msg.id}:`, error.response?.data || error.message);
          const errMsg = error.response?.data?.error?.message || error.message;
          
          await prisma.message.update({
            where: { id: msg.id },
            data: {
              status: "FAILED",
              errorMessage: errMsg,
            }
          });
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
