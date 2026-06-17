import { prisma } from "../db";
import { calculateNextRun } from "../utils/campaignScheduler";

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

async function runDueCampaigns() {
  const now = new Date();

  const dueCampaigns = await prisma.campaign.findMany({
    where: { status: "ACTIVE", nextRunAt: { lte: now } },
  });

  for (const campaign of dueCampaigns) {
    await executeCampaign(campaign).catch((err: Error) =>
      console.error(`[CampaignWorker] Erro na campanha "${campaign.name}":`, err.message)
    );
  }
}

async function executeCampaign(campaign: {
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
}) {
  console.log(`[CampaignWorker] Executando campanha "${campaign.name}" (${campaign.id})`);

  const run = await prisma.campaignRun.create({
    data: { campaignId: campaign.id, status: "RUNNING", contactsTotal: 0 },
  });

  try {
    const optedOut = await prisma.optOut.findMany({
      where: { accountId: campaign.accountId },
      select: { phone: true },
    });
    const optedOutSet = new Set(optedOut.map((o) => o.phone));

    let contacts: Array<{ id: string; name: string | null; phone: string; variables: any }> = [];
    if (campaign.contactListId) {
      contacts = await prisma.contact.findMany({
        where: { contactListId: campaign.contactListId },
        select: { id: true, name: true, phone: true, variables: true },
      });
    }

    const variableMappings: string[] = Array.isArray(campaign.variables) ? campaign.variables : [];

    const messagesToCreate = contacts
      .filter((c) => !optedOutSet.has(c.phone))
      .map((c) => ({
        to: c.phone,
        templateName: campaign.templateName,
        variables: resolveVariables(variableMappings, c),
        mediaUrl: campaign.mediaUrl ?? null,
        accountId: campaign.accountId,
        status: "PENDING" as const,
      }));

    if (messagesToCreate.length > 0) {
      await prisma.message.createMany({ data: messagesToCreate });
    }

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
      `[CampaignWorker] "${campaign.name}" — ${messagesToCreate.length}/${contacts.length} mensagens enfileiradas.`
    );
  } catch (err: any) {
    console.error(`[CampaignWorker] Falha ao executar campanha "${campaign.name}":`, err.message);
    await prisma.campaignRun.update({
      where: { id: run.id },
      data: { status: "FAILED", finishedAt: new Date() },
    });
  }

  // Advance or complete the campaign
  if (campaign.scheduleType === "ONCE") {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "COMPLETED", lastRunAt: new Date(), runCount: { increment: 1 }, nextRunAt: null },
    });
    return;
  }

  const nextRunAt = calculateNextRun({
    scheduleType: campaign.scheduleType,
    scheduleTime: campaign.scheduleTime ?? undefined,
    scheduleDays: campaign.scheduleDays,
    scheduleDate: campaign.scheduleDate?.toISOString(),
  });

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { lastRunAt: new Date(), runCount: { increment: 1 }, nextRunAt },
  });
}

export function startCampaignWorker() {
  console.log("[CampaignWorker] Worker de campanhas recorrentes iniciado (intervalo: 60s).");
  runDueCampaigns().catch((err: Error) => console.error("[CampaignWorker] Erro inicial:", err.message));
  setInterval(() => {
    runDueCampaigns().catch((err: Error) => console.error("[CampaignWorker] Erro:", err.message));
  }, 60_000);
}
