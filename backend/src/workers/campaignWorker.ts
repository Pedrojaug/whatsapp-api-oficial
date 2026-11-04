import { prisma } from "../db";
import { calculateNextRun } from "../utils/campaignScheduler";
import { triggerDispatcher } from "./dispatcher";
import { normalizePhone } from "../services/phoneService";
import { validateTemplateForCampaign } from "../utils/templateValidation";

let campaignTimer: NodeJS.Timeout | null = null;

// Lotes para ler contatos e gravar mensagens: mantém cada INSERT bem abaixo do
// limite de parâmetros do Postgres e a memória sob controle em listas grandes.
const CONTACT_PAGE_SIZE = 5_000;
const INSERT_CHUNK_SIZE = 1_000;

// Telefone E.164 só com dígitos (DDI + número): 10 a 15 dígitos.
const VALID_PHONE = /^\d{10,15}$/;

export function triggerCampaignWorker() {
  if (campaignTimer) {
    clearTimeout(campaignTimer);
    campaignTimer = null;
  }
  runDueCampaigns().catch((err: Error) => console.error("[CampaignWorker] Erro:", err.message));
}

function scheduleNextCampaignRun(delayMs: number) {
  if (campaignTimer) clearTimeout(campaignTimer);
  campaignTimer = setTimeout(() => {
    runDueCampaigns().catch((err: Error) => console.error("[CampaignWorker] Erro:", err.message));
  }, delayMs);
}

function resolveVariables(mappings: string[], contact: { name?: string | null; phone: string; variables?: any }): string[] {
  const vars: any[] = Array.isArray(contact.variables) ? contact.variables : [];
  return mappings.map((m) => {
    if (m === "CONTACT_NAME") return contact.name || "";
    if (m === "CONTACT_PHONE") return contact.phone;
    if (m === "CONTACT_VAR_1") return String(vars[0] ?? "");
    if (m === "CONTACT_VAR_2") return String(vars[1] ?? "");
    if (m === "CONTACT_VAR_3") return String(vars[2] ?? "");
    if (m.startsWith("STATIC:")) return m.slice(7);
    if (m === "STATIC_VALUE") return "";
    return m;
  });
}

// Execução única por processo: se o timer e um triggerCampaignWorker() (ativação)
// chegarem juntos, a segunda chamada não roda em paralelo — ela pede mais uma
// passada ao final da que está em andamento.
let running: Promise<void> | null = null;
let rerunRequested = false;

export function runDueCampaigns(): Promise<void> {
  if (running) {
    rerunRequested = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        rerunRequested = false;
        await runDueCampaignsOnce();
      } while (rerunRequested);
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Uma passada do worker. Exportada para testes (simula outra instância do servidor). */
export async function runDueCampaignsOnce() {
  const now = new Date();

  // Se não houver NENHUMA campanha ativa cadastrada, descansa por 10 min (permite Neon hibernar em 5 min)
  const activeCount = await prisma.campaign.count({ where: { status: "ACTIVE" } });
  if (activeCount === 0) {
    scheduleNextCampaignRun(10 * 60_000);
    return;
  }

  const dueCampaigns = await prisma.campaign.findMany({
    where: { status: "ACTIVE", nextRunAt: { lte: now } },
  });

  for (const campaign of dueCampaigns) {
    try {
      if (await claimCampaignRun(campaign)) {
        await executeCampaign(campaign);
      }
    } catch (err: any) {
      console.error(`[CampaignWorker] Erro na campanha "${campaign.name}":`, err.message);
    }
  }

  // Agendamento adaptativo: calcula o tempo exato até a próxima campanha ativa
  const nextCampaign = await prisma.campaign.findFirst({
    where: { status: "ACTIVE", nextRunAt: { gt: new Date() } },
    orderBy: { nextRunAt: "asc" },
    select: { nextRunAt: true },
  });

  if (nextCampaign?.nextRunAt) {
    const diffMs = nextCampaign.nextRunAt.getTime() - Date.now();
    // Se a próxima campanha for em breve, acorda no instante planejado (mínimo 5s, teto 10 min)
    const delay = Math.max(5_000, Math.min(diffMs, 10 * 60_000));
    scheduleNextCampaignRun(delay);
  } else {
    // Nenhuma campanha agendada no horizonte imediato: descansa por 10 minutos
    scheduleNextCampaignRun(10 * 60_000);
  }
}

type CampaignRow = {
  id: string;
  name: string;
  accountId: string;
  contactListId: string | null;
  templateName: string;
  variables: any;
  mediaUrl: string | null;
  scheduleType: string;
  scheduleTime: string | null;
  scheduleDays: number[];
  scheduleDate: Date | null;
  nextRunAt: Date | null;
};

/**
 * Reserva esta execução no banco ANTES de enfileirar: avança o nextRunAt (ou
 * conclui a campanha ONCE) só se ele ainda for o valor lido. Se outra passada
 * ou outra instância do servidor já reservou, o UPDATE não pega nenhuma linha
 * e esta passada pula a campanha — a lista nunca é enfileirada duas vezes.
 */
async function claimCampaignRun(campaign: CampaignRow): Promise<boolean> {
  const isOnce = campaign.scheduleType === "ONCE";
  const nextRunAt = isOnce
    ? null
    : calculateNextRun({
        scheduleType: campaign.scheduleType,
        scheduleTime: campaign.scheduleTime ?? undefined,
        scheduleDays: campaign.scheduleDays,
        scheduleDate: campaign.scheduleDate?.toISOString(),
      });

  // Recorrente sem próxima data válida: executa esta vez e pausa (antes ficava ACTIVE sem nunca mais rodar)
  const nextStatus = isOnce ? "COMPLETED" : nextRunAt ? "ACTIVE" : "PAUSED";

  const claimed = await prisma.campaign.updateMany({
    where: { id: campaign.id, status: "ACTIVE", nextRunAt: campaign.nextRunAt },
    data: { status: nextStatus, nextRunAt, lastRunAt: new Date(), runCount: { increment: 1 } },
  });

  if (claimed.count === 0) {
    console.log(`[CampaignWorker] Campanha "${campaign.name}" já foi reservada por outra execução — pulando.`);
    return false;
  }
  return true;
}

async function loadContacts(contactListId: string) {
  const all: Array<{ id: string; name: string | null; phone: string; variables: any }> = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await prisma.contact.findMany({
      where: { contactListId },
      select: { id: true, name: true, phone: true, variables: true },
      orderBy: { id: "asc" },
      take: CONTACT_PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    all.push(...page);
    if (page.length < CONTACT_PAGE_SIZE) return all;
    cursor = page[page.length - 1].id;
  }
}

async function executeCampaign(campaign: CampaignRow) {
  console.log(`[CampaignWorker] Executando campanha "${campaign.name}" (${campaign.id})`);

  const run = await prisma.campaignRun.create({
    data: { campaignId: campaign.id, status: "RUNNING", contactsTotal: 0 },
  });

  // Checagem prévia: um template incompatível (ex.: exige imagem no cabeçalho e a
  // campanha está sem mídia) falharia em TODAS as mensagens. Barra a execução
  // inteira, registra o motivo e pausa a campanha para o usuário corrigir.
  const template = await prisma.template.findFirst({
    where: { accountId: campaign.accountId, name: campaign.templateName },
    select: { name: true, status: true, components: true },
  });
  const problems = validateTemplateForCampaign(template, campaign);
  if (problems.length > 0) {
    const reason = problems.join(" ");
    console.warn(`[CampaignWorker] Campanha "${campaign.name}" barrada antes do envio: ${reason}`);
    await prisma.campaignRun.update({
      where: { id: run.id },
      data: { status: "FAILED", errorMessage: reason, finishedAt: new Date() },
    });
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "PAUSED", nextRunAt: null },
    });
    return;
  }

  try {
    const optedOut = await prisma.optOut.findMany({
      where: { accountId: campaign.accountId },
      select: { phone: true },
    });
    const optedOutSet = new Set(optedOut.map((o) => normalizePhone(o.phone)));

    const contacts = campaign.contactListId ? await loadContacts(campaign.contactListId) : [];
    const variableMappings: string[] = Array.isArray(campaign.variables) ? campaign.variables : [];

    // Um envio por telefone: a mesma pessoa pode estar na lista mais de uma vez,
    // inclusive em formatos diferentes (com/sem DDI, com/sem 9º dígito).
    const seen = new Set<string>();
    let duplicates = 0;
    let invalid = 0;
    let optedOutCount = 0;
    const messagesToCreate = [];
    for (const c of contacts) {
      const to = normalizePhone(c.phone || "");
      if (!VALID_PHONE.test(to)) { invalid++; continue; }
      if (optedOutSet.has(to)) { optedOutCount++; continue; }
      if (seen.has(to)) { duplicates++; continue; }
      seen.add(to);
      messagesToCreate.push({
        to,
        templateName: campaign.templateName,
        variables: resolveVariables(variableMappings, { ...c, phone: to }),
        mediaUrl: campaign.mediaUrl ?? null,
        accountId: campaign.accountId,
        status: "PENDING" as const,
        campaignId: campaign.id,
        campaignRunId: run.id,
      });
    }

    if (messagesToCreate.length > 0) {
      // Tudo ou nada: se um lote falhar, nenhuma mensagem desta execução fica na fila pela metade.
      const chunks = [];
      for (let i = 0; i < messagesToCreate.length; i += INSERT_CHUNK_SIZE) {
        chunks.push(prisma.message.createMany({ data: messagesToCreate.slice(i, i + INSERT_CHUNK_SIZE) }));
      }
      await prisma.$transaction(chunks);
      triggerDispatcher();
    } else if (contacts.length === 0) {
      console.warn(`[CampaignWorker] Campanha "${campaign.name}" executada SEM contatos — lista ${campaign.contactListId ?? "não definida"} está vazia ou inexistente. Nada foi enfileirado.`);
    }

    const skipped = [
      duplicates && `${duplicates} duplicado(s)`,
      invalid && `${invalid} telefone(s) inválido(s)`,
      optedOutCount && `${optedOutCount} em opt-out`,
    ].filter(Boolean).join(", ");

    await prisma.campaignRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        messagesSent: messagesToCreate.length,
        contactsTotal: contacts.length,
        finishedAt: new Date(),
      },
    });

    console.log(
      `[CampaignWorker] "${campaign.name}" — ${messagesToCreate.length}/${contacts.length} mensagens enfileiradas${skipped ? ` (ignorados: ${skipped})` : ""}.`
    );
  } catch (err: any) {
    console.error(`[CampaignWorker] Falha ao executar campanha "${campaign.name}":`, err.message);
    await prisma.campaignRun.update({
      where: { id: run.id },
      data: { status: "FAILED", errorMessage: err.message, finishedAt: new Date() },
    });
  }
}

export function startCampaignWorker() {
  console.log("[CampaignWorker] Worker de campanhas recorrentes iniciado.");
  runDueCampaigns().catch((err: Error) => console.error("[CampaignWorker] Erro inicial:", err.message));
}
