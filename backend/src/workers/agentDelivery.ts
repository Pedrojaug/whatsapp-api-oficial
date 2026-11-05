/**
 * Entrega dos eventos do agente de IA por webhook (fila AgentEvent).
 *
 * - Ordem garantida por contato: um evento só sai depois que os anteriores do
 *   mesmo telefone foram entregues ou desistidos (a conversa não chega embaralhada).
 * - Reserva atômica (PENDING → PROCESSING): duas instâncias não entregam em dobro.
 * - Novas tentativas com espera crescente; depois disso o evento fica FAILED,
 *   mas continua disponível em GET /api/v1/events.
 * - Sem polling contínuo: acorda quando um evento é criado ou na próxima tentativa
 *   agendada (o Neon pode hibernar quando não há nada a fazer).
 */
import axios from "axios";
import { prisma } from "../db";
import { buildEventEnvelope, getAgentConfig, signAgentPayload } from "../services/agentService";
import { runWithConcurrency } from "./dispatcher";

const BATCH_SIZE = 20;
const CONCURRENCY = 5;
const REQUEST_TIMEOUT_MS = 10_000;
/** Espera antes de cada nova tentativa (após a 1ª, 2ª, ...). Total ≈ 1h43min. */
export const RETRY_DELAYS_MS = [10_000, 30_000, 2 * 60_000, 10 * 60_000, 30 * 60_000, 60 * 60_000];
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

let isProcessing = false;
let rerunRequested = false;
let timer: NodeJS.Timeout | null = null;
let lastPruneAt = 0;

export function triggerAgentDelivery() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (isProcessing) {
    rerunRequested = true;
    return;
  }
  setImmediate(() => {
    processAgentEvents().catch((err) => console.error("[AgentDelivery] Erro no loop:", err.message));
  });
}

export async function startAgentDeliveryWorker() {
  // Eventos presos em PROCESSING por um restart voltam para a fila
  const reset = await prisma.agentEvent
    .updateMany({ where: { deliveryStatus: "PROCESSING" }, data: { deliveryStatus: "PENDING" } })
    .catch(() => ({ count: 0 }));
  if (reset.count > 0) console.log(`[AgentDelivery] ${reset.count} evento(s) em PROCESSING devolvidos à fila.`);
  triggerAgentDelivery();
}

type ClaimedEvent = { id: string; seq: number; accountId: string; type: string; phone: string | null; payload: unknown; attempts: number; createdAt: Date };

async function claimDueEvents(now: Date): Promise<ClaimedEvent[]> {
  return prisma.$queryRaw<ClaimedEvent[]>`
    WITH due AS (
      SELECT e.id FROM "AgentEvent" e
      WHERE e."deliveryStatus" = 'PENDING'
        AND (e."nextAttemptAt" IS NULL OR e."nextAttemptAt" <= ${now})
        AND NOT EXISTS (
          SELECT 1 FROM "AgentEvent" p
          WHERE p."accountId" = e."accountId"
            AND p.phone IS NOT DISTINCT FROM e.phone
            AND p.seq < e.seq
            AND p."deliveryStatus" IN ('PENDING', 'PROCESSING')
        )
      ORDER BY e.seq
      LIMIT ${BATCH_SIZE}
    )
    UPDATE "AgentEvent" a
    SET "deliveryStatus" = 'PROCESSING', attempts = a.attempts + 1
    FROM due
    WHERE a.id = due.id AND a."deliveryStatus" = 'PENDING'
    RETURNING a.id, a.seq, a."accountId", a.type, a.phone, a.payload, a.attempts, a."createdAt"
  `;
}

/** Faz o POST assinado. Retorna null em caso de sucesso (2xx) ou a mensagem de erro. */
export async function postAgentEvent(url: string, secret: string, event: ClaimedEvent): Promise<string | null> {
  const body = JSON.stringify(buildEventEnvelope(event));
  const timestamp = Math.floor(Date.now() / 1000);
  try {
    const res = await axios.post(url, body, {
      timeout: REQUEST_TIMEOUT_MS,
      maxRedirects: 0,
      validateStatus: () => true,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "SendInteligentte-Agent/1",
        "X-Send-Event": event.type,
        "X-Send-Event-Id": event.id,
        "X-Send-Timestamp": String(timestamp),
        "X-Send-Signature": signAgentPayload(secret, timestamp, body),
      },
    });
    if (res.status >= 200 && res.status < 300) return null;
    return `HTTP ${res.status}`;
  } catch (err: any) {
    return err.code === "ECONNABORTED" ? `Tempo esgotado (${REQUEST_TIMEOUT_MS / 1000}s)` : err.code || err.message;
  }
}

async function deliver(event: ClaimedEvent) {
  const cfg = await getAgentConfig(event.accountId);
  if (!cfg.enabled || !cfg.webhookUrl || !cfg.secret) {
    // Integração desligada ou sem webhook: o evento continua legível por GET /api/v1/events
    await prisma.agentEvent.update({
      where: { id: event.id },
      data: { deliveryStatus: "PULL", lastError: "Webhook não configurado ou integração desativada." },
    });
    return;
  }

  const error = await postAgentEvent(cfg.webhookUrl, cfg.secret, event);
  if (!error) {
    await prisma.agentEvent.update({
      where: { id: event.id },
      data: { deliveryStatus: "DELIVERED", deliveredAt: new Date(), lastError: null, nextAttemptAt: null },
    });
    return;
  }

  const giveUp = event.attempts >= MAX_ATTEMPTS;
  await prisma.agentEvent.update({
    where: { id: event.id },
    data: giveUp
      ? { deliveryStatus: "FAILED", lastError: error, nextAttemptAt: null }
      : { deliveryStatus: "PENDING", lastError: error, nextAttemptAt: new Date(Date.now() + RETRY_DELAYS_MS[event.attempts - 1]) },
  });
  console.warn(
    `[AgentDelivery] Falha ao entregar ${event.type} ${event.id} (tentativa ${event.attempts}/${MAX_ATTEMPTS}): ${error}${giveUp ? " — desistindo" : ""}`
  );
}

export async function processAgentEvents() {
  if (isProcessing) {
    rerunRequested = true;
    return;
  }
  isProcessing = true;
  try {
    do {
      rerunRequested = false;
      let claimed: ClaimedEvent[];
      do {
        claimed = await claimDueEvents(new Date());
        if (claimed.length > 0) await runWithConcurrency(claimed, CONCURRENCY, deliver);
      } while (claimed.length > 0);
    } while (rerunRequested);

    if (Date.now() - lastPruneAt > 60 * 60 * 1000) {
      lastPruneAt = Date.now();
      const pruned = await prisma.agentEvent.deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - RETENTION_MS) } },
      });
      if (pruned.count > 0) console.log(`[AgentDelivery] ${pruned.count} evento(s) com mais de 7 dias removidos.`);
    }
  } finally {
    isProcessing = false;
    await scheduleNextAttempt().catch(() => {});
  }
}

async function scheduleNextAttempt() {
  const next = await prisma.agentEvent.findFirst({
    where: { deliveryStatus: "PENDING" },
    orderBy: { nextAttemptAt: "asc" },
    select: { nextAttemptAt: true },
  });
  if (!next) return; // nada pendente: dorme até o próximo evento
  const delay = next.nextAttemptAt ? next.nextAttemptAt.getTime() - Date.now() : 0;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    processAgentEvents().catch((err) => console.error("[AgentDelivery] Erro no loop:", err.message));
  }, Math.max(1_000, Math.min(delay, 10 * 60_000)));
}
