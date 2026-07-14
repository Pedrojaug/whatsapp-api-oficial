import { prisma } from "../db";
import axios from "axios";
import { decryptToken } from "../utils/crypto";
import { messageEventEmitter } from "../utils/emitter";
import { resolveMetaMediaId } from "../utils/mediaUpload";

let isProcessing = false;

/**
 * Inicia o worker de envio em lote em background (Transactional Outbox Pattern)
 */
export function startBackgroundDispatcher() {
  console.log("🚀 Servidor de disparo em background inicializado.");
  
  // Inicia o loop dinâmico recursivo
  setTimeout(checkAndDispatch, 5000);
}

async function checkAndDispatch() {
  if (isProcessing) {
    setTimeout(checkAndDispatch, 5000);
    return;
  }
  isProcessing = true;
  let hasMore = false;

  try {
    const now = new Date();

    // 1. Busca até 50 mensagens PENDING que já passaram da data agendada e da hora de retentativa
    const pendingMessages = await prisma.message.findMany({
      where: {
        status: { in: ["PENDING"] },
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
      take: 50,
      orderBy: { createdAt: "asc" },
      include: { account: true }
    });

    if (pendingMessages.length === 0) {
      return;
    }

    if (pendingMessages.length === 50) {
      hasMore = true;
    }

    // Verificar opt-outs em lote antes de processar
    const optedOutRecords = await prisma.optOut.findMany({
      where: {
        phone: { in: pendingMessages.map((m) => m.to) },
        accountId: { in: [...new Set(pendingMessages.map((m) => m.accountId))] },
      },
      select: { phone: true, accountId: true },
    });
    const optedOutSet = new Set(optedOutRecords.map((o) => `${o.accountId}:${o.phone}`));

    console.log(`[Worker] Processando lote de ${pendingMessages.length} mensagens pendentes...`);

    // Pré-carrega os templates distintos do lote numa única query
    // (evita N+1: antes havia um findFirst de template por mensagem).
    const seenTpl = new Set<string>();
    const tplPairs: { accountId: string; name: string }[] = [];
    for (const m of pendingMessages) {
      if (!m.templateName) continue;
      const k = `${m.accountId}::${m.templateName}`;
      if (seenTpl.has(k)) continue;
      seenTpl.add(k);
      tplPairs.push({ accountId: m.accountId, name: m.templateName });
    }
    const templateList = tplPairs.length
      ? await prisma.template.findMany({ where: { OR: tplPairs } })
      : [];
    const templateMap = new Map(templateList.map((t) => [`${t.accountId}::${t.name}`, t]));

    // Cache de media id por (conta, mídia) dentro do lote: sobe cada mídia
    // para a Meta uma única vez e reusa em todos os destinatários.
    const mediaIdCache = new Map<string, string | null>();

    for (const msg of pendingMessages) {
      // Bloquear envio para contatos que optaram por não receber mensagens (LGPD)
      if (optedOutSet.has(`${msg.accountId}:${msg.to}`)) {
        await prisma.message.update({
          where: { id: msg.id },
          data: { status: "CANCELLED", errorMessage: "Contato optou por não receber mensagens (LGPD opt-out)." },
        });
        messageEventEmitter.emit("messageUpdated", {
          accountId: msg.accountId,
          messageId: msg.id,
          status: "CANCELLED",
          to: msg.to,
          errorMessage: "Contato optou por não receber mensagens (LGPD opt-out).",
          updatedAt: new Date(),
        });
        console.log(`[Worker] Mensagem ${msg.id} para ${msg.to} cancelada — contato está na lista de opt-out.`);
        continue;
      }
      try {
        // Claim atômico PENDING -> PROCESSING: só processa se ESTA instância
        // conseguir a transição. Impede que dois processos (ex.: sobreposição
        // de containers durante um deploy do Render) enviem a mesma mensagem
        // em duplicidade. Mensagens travadas em PROCESSING por um crash são
        // devolvidas a PENDING no startup (server.ts).
        const claim = await prisma.message.updateMany({
          where: { id: msg.id, status: "PENDING" },
          data: { status: "PROCESSING" },
        });
        if (claim.count === 0) continue;

        if (!msg.templateName) {
          throw new Error("Mensagem pendente na fila não possui nome do template.");
        }

        const account = msg.account;
        const decryptedToken = decryptToken(account.accessToken);
        
        // Reconstruir variáveis mapeadas salvas
        const varsObj = msg.variables as any;
        const resolvedVars = Array.isArray(varsObj) ? varsObj : (varsObj?.variables || []);
        const mediaUrl = msg.mediaUrl || varsObj?.mediaUrl || null;
        
        // Template já pré-carregado no início do lote (sem query por mensagem)
        const template = templateMap.get(`${msg.accountId}::${msg.templateName}`) || null;

        const templateComponents = template?.components as any[];
        const headerComp = templateComponents && Array.isArray(templateComponents)
          ? templateComponents.find((c: any) => c.type === "HEADER")
          : null;

        const bodyComp = templateComponents && Array.isArray(templateComponents)
          ? templateComponents.find((c: any) => c.type === "BODY")
          : null;

        // Reconstruir texto da mensagem para persistência de histórico
        let reconstructedBody: string | null = null;
        if (bodyComp && bodyComp.text) {
          reconstructedBody = bodyComp.text;
          if (resolvedVars && resolvedVars.length > 0) {
            resolvedVars.forEach((val: any, idx: number) => {
              reconstructedBody = reconstructedBody!.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'), String(val));
            });
          }
        }

        const components: any[] = [];

        // 1. Cabeçalho de Mídia — sobe para a Meta e envia por id (a Meta
        // hospeda), com fallback para link se o upload falhar.
        if (headerComp && ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerComp.format) && mediaUrl) {
          const typeLower = headerComp.format.toLowerCase();
          const cacheKey = `${msg.accountId}::${mediaUrl}`;
          let mediaId = mediaIdCache.get(cacheKey);
          if (mediaId === undefined) {
            mediaId = await resolveMetaMediaId(account.phoneNumberId, decryptedToken, mediaUrl, msg.accountId);
            mediaIdCache.set(cacheKey, mediaId);
          }
          const mediaObj: any = mediaId ? { id: mediaId } : { link: mediaUrl };
          if (typeLower === "document") mediaObj.filename = mediaUrl.split("/").pop() || "document.pdf";
          components.push({
            type: "header",
            parameters: [{ type: typeLower, [typeLower]: mediaObj }],
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
            body: reconstructedBody,
            errorMessage: null
          }
        });

        console.log(`[Worker] Mensagem ${msg.id} enviada com sucesso para ${msg.to}. Wamid: ${wamid}`);

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
              status: "PENDING", // devolve à fila (saiu de PROCESSING pelo claim)
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
    // Agendar próximo ciclo recursivo (quase imediato se há mais mensagens na fila, ou aguarda 5s)
    setTimeout(checkAndDispatch, hasMore ? 100 : 5000);
  }
}
