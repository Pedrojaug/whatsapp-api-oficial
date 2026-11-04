/**
 * Teste de integração do worker de campanhas contra um Postgres real.
 *
 * Só roda com TEST_DATABASE_URL definida (ex.: um branch temporário do Neon com
 * `prisma db push` aplicado). NUNCA aponte para o banco de produção: o teste cria
 * e apaga um usuário de teste. O dispatcher é substituído por um mock, então
 * nenhuma mensagem é enviada para a Meta.
 *
 *   TEST_DATABASE_URL=postgres://... npx vitest run src/tests/campaignWorker.integration.test.ts
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const TEST_URL = process.env.TEST_DATABASE_URL;

const testPrisma = vi.hoisted(() => ({ client: null as any }));
vi.mock("../db", async () => {
  const { PrismaClient: PC } = await import("@prisma/client");
  testPrisma.client = process.env.TEST_DATABASE_URL
    ? new PC({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } })
    : {};
  return { prisma: testPrisma.client };
});
vi.mock("../workers/dispatcher", () => ({ triggerDispatcher: vi.fn() }));

import { runDueCampaignsOnce } from "../workers/campaignWorker";
import { summarizeRunStats } from "../utils/campaignStats";

const CONTACTS = 12_000;
const DUPLICATES = 500;

describe.skipIf(!TEST_URL)("campaignWorker (Postgres real)", () => {
  let prisma: PrismaClient;
  const tag = `itest-${Date.now()}`;
  let userId = "";
  let campaignId = "";

  beforeAll(async () => {
    prisma = testPrisma.client;
    const user = await prisma.user.create({ data: { email: `${tag}@teste.invalid`, name: "Teste integração" } });
    userId = user.id;
    const account = await prisma.account.create({
      data: { name: tag, wabaId: "waba-test", phoneNumberId: "pn-test", accessToken: "nao-usado", userId },
    });
    await prisma.template.create({
      data: { accountId: account.id, name: "tpl_itest", status: "APPROVED", category: "MARKETING", components: [{ type: "BODY", text: "Olá {{1}}" }] },
    });
    const list = await prisma.contactList.create({ data: { accountId: account.id, name: tag } });

    // 12.000 contatos + 500 repetidos (mesmo número sem DDI) + 2 inválidos
    const rows = Array.from({ length: CONTACTS }, (_, i) => ({ contactListId: list.id, name: `C${i}`, phone: `55839${String(90000000 + i)}`, variables: [] }));
    for (let i = 0; i < DUPLICATES; i++) rows.push({ contactListId: list.id, name: `D${i}`, phone: `839${String(90000000 + i)}`, variables: [] });
    rows.push({ contactListId: list.id, name: "X", phone: "", variables: [] }, { contactListId: list.id, name: "Y", phone: "123", variables: [] });
    for (let i = 0; i < rows.length; i += 2_000) await prisma.contact.createMany({ data: rows.slice(i, i + 2_000) });

    const campaign = await prisma.campaign.create({
      data: {
        name: tag, accountId: account.id, contactListId: list.id, templateName: "tpl_itest",
        variables: ["CONTACT_NAME"], scheduleType: "WEEKLY", scheduleTime: "09:00", scheduleDays: [1, 3, 5],
        status: "ACTIVE", nextRunAt: new Date(Date.now() - 60_000),
      },
    });
    campaignId = campaign.id;
  }, 180_000);

  afterAll(async () => {
    if (userId) await prisma.user.delete({ where: { id: userId } }); // Account → mensagens, listas, campanhas em cascata
    await prisma.$disconnect();
  }, 120_000);

  it("duas passadas simultâneas (duas instâncias) enfileiram uma única vez, sem duplicados", async () => {
    await Promise.all([runDueCampaignsOnce(), runDueCampaignsOnce()]);

    const runs = await prisma.campaignRun.findMany({ where: { campaignId } });
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe("COMPLETED");
    expect(runs[0].contactsTotal).toBe(CONTACTS + DUPLICATES + 2);
    expect(runs[0].messagesSent).toBe(CONTACTS);

    const total = await prisma.message.count({ where: { campaignId } });
    const distinct = await prisma.message.groupBy({ by: ["to"], where: { campaignId } });
    expect(total).toBe(CONTACTS);
    expect(distinct).toHaveLength(CONTACTS);

    const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });
    expect(campaign.runCount).toBe(1);
    expect(campaign.status).toBe("ACTIVE");
    expect(campaign.nextRunAt!.getTime()).toBeGreaterThan(Date.now());
    // Próxima execução cai numa segunda, quarta ou sexta às 09:00 BRT (12:00 UTC)
    expect([1, 3, 5]).toContain(new Date(campaign.nextRunAt!.getTime() - 3 * 3600_000).getUTCDay());
    expect(campaign.nextRunAt!.getUTCHours()).toBe(12);
  }, 180_000);

  it("estatísticas por execução saem do groupBy das mensagens", async () => {
    const run = await prisma.campaignRun.findFirstOrThrow({ where: { campaignId } });
    const someIds = (await prisma.message.findMany({ where: { campaignRunId: run.id }, select: { id: true }, take: 30 })).map((m) => m.id);
    await prisma.message.updateMany({ where: { id: { in: someIds.slice(0, 10) } }, data: { status: "READ" } });
    await prisma.message.updateMany({ where: { id: { in: someIds.slice(10, 20) } }, data: { status: "DELIVERED" } });
    await prisma.message.updateMany({ where: { id: { in: someIds.slice(20, 30) } }, data: { status: "FAILED" } });

    const grouped = await prisma.message.groupBy({ by: ["campaignRunId", "status"], where: { campaignRunId: run.id }, _count: { _all: true } });
    const byStatus = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
    expect(summarizeRunStats(byStatus)).toEqual({
      pending: CONTACTS - 30, sent: 20, delivered: 20, read: 10, failed: 10, cancelled: 0,
    });
  }, 60_000);

  it("uma nova passada antes da próxima data não roda de novo", async () => {
    await runDueCampaignsOnce();
    expect(await prisma.campaignRun.count({ where: { campaignId } })).toBe(1);
    expect(await prisma.message.count({ where: { campaignId } })).toBe(CONTACTS);
  }, 60_000);
});
