import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Banco falso em memória, só com o que o worker de campanhas usa. Cada operação
 * cede o event loop (como uma ida real ao banco), para que execuções concorrentes
 * se intercalem de verdade.
 */
const db = vi.hoisted(() => {
  const tick = () => new Promise((r) => setImmediate(r));
  const state = {
    campaigns: [] as any[],
    runs: [] as any[],
    contacts: [] as any[],
    templates: [] as any[],
    optOuts: [] as any[],
    messages: [] as any[],
    createManyCalls: [] as number[],
  };
  const matches = (row: any, where: any = {}): boolean =>
    Object.entries(where).every(([k, v]: [string, any]) => {
      if (v && typeof v === "object" && !(v instanceof Date)) {
        if ("lte" in v) return row[k] != null && row[k] <= v.lte;
        if ("gt" in v) return row[k] != null && row[k] > v.gt;
        if ("in" in v) return v.in.includes(row[k]);
      }
      if (v instanceof Date) return row[k] instanceof Date && row[k].getTime() === v.getTime();
      return row[k] === v;
    });
  const apply = (row: any, data: any) => {
    for (const [k, v] of Object.entries<any>(data)) {
      if (v && typeof v === "object" && "increment" in v) row[k] = (row[k] || 0) + v.increment;
      else row[k] = v;
    }
  };
  let seq = 0;
  const prisma: any = {
    campaign: {
      count: async ({ where }: any) => { await tick(); return state.campaigns.filter((c) => matches(c, where)).length; },
      findMany: async ({ where }: any) => { await tick(); return state.campaigns.filter((c) => matches(c, where)).map((c) => ({ ...c })); },
      findFirst: async ({ where }: any) => {
        await tick();
        const rows = state.campaigns.filter((c) => matches(c, where)).sort((a, b) => (a.nextRunAt?.getTime() ?? 0) - (b.nextRunAt?.getTime() ?? 0));
        return rows[0] ? { ...rows[0] } : null;
      },
      update: async ({ where, data }: any) => { await tick(); const c = state.campaigns.find((x) => x.id === where.id); apply(c, data); return { ...c }; },
      updateMany: async ({ where, data }: any) => {
        await tick();
        const rows = state.campaigns.filter((c) => matches(c, where));
        rows.forEach((c) => apply(c, data));
        return { count: rows.length };
      },
    },
    campaignRun: {
      create: async ({ data }: any) => { await tick(); const r = { id: `run-${++seq}`, ...data }; state.runs.push(r); return r; },
      update: async ({ where, data }: any) => { await tick(); const r = state.runs.find((x) => x.id === where.id); apply(r, data); return r; },
    },
    optOut: { findMany: async ({ where }: any) => { await tick(); return state.optOuts.filter((o) => o.accountId === where.accountId); } },
    contact: {
      findMany: async ({ where, take, skip, cursor }: any) => {
        await tick();
        let rows = state.contacts.filter((c) => c.contactListId === where.contactListId).sort((a, b) => (a.id < b.id ? -1 : 1));
        if (cursor) rows = rows.filter((c) => c.id > cursor.id);
        if (skip && !cursor) rows = rows.slice(skip);
        if (take) rows = rows.slice(0, take);
        return rows.map((c) => ({ ...c }));
      },
    },
    template: { findFirst: async ({ where }: any) => { await tick(); return state.templates.find((t) => t.accountId === where.accountId && t.name === where.name) || null; } },
    message: {
      createMany: async ({ data }: any) => {
        await tick();
        state.createManyCalls.push(data.length);
        state.messages.push(...data);
        return { count: data.length };
      },
    },
    $transaction: async (ops: any) => (typeof ops === "function" ? ops(prisma) : Promise.all(ops)),
  };
  return { state, prisma };
});

vi.mock("../db", () => ({ prisma: db.prisma }));
vi.mock("../workers/dispatcher", () => ({ triggerDispatcher: vi.fn() }));

import { runDueCampaigns, runDueCampaignsOnce } from "../workers/campaignWorker";

const ACC = "acc-1";
const LIST = "list-1";

function seed({ contacts, scheduleType = "DAILY" }: { contacts: Array<{ phone: string; name?: string }>; scheduleType?: string }) {
  const due = new Date(Date.now() - 1000);
  db.state.campaigns.push({
    id: "camp-1", name: "Teste", accountId: ACC, contactListId: LIST, templateName: "tpl",
    variables: [], mediaUrl: null, status: "ACTIVE", scheduleType, scheduleTime: "09:00",
    scheduleDays: [], scheduleDate: scheduleType === "ONCE" ? due : null, nextRunAt: due, runCount: 0,
  });
  db.state.templates.push({ accountId: ACC, name: "tpl", status: "APPROVED", components: [{ type: "BODY", text: "Olá" }] });
  contacts.forEach((c, i) => db.state.contacts.push({ id: `c-${String(i).padStart(6, "0")}`, contactListId: LIST, name: c.name ?? null, phone: c.phone, variables: [] }));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  for (const k of Object.keys(db.state) as Array<keyof typeof db.state>) (db.state[k] as any[]).length = 0;
});
afterEach(() => vi.useRealTimers());

describe("campaignWorker — execução concorrente", () => {
  it("duas execuções simultâneas do worker enfileiram a lista uma vez só", async () => {
    seed({ contacts: [{ phone: "5583999990001" }, { phone: "5583999990002" }] });

    // Ex.: o timer do worker dispara enquanto alguém ativa outra campanha (triggerCampaignWorker),
    // ou duas instâncias sobrepostas durante um deploy do Render.
    await Promise.all([runDueCampaigns(), runDueCampaigns()]);

    expect(db.state.messages).toHaveLength(2);
    expect(db.state.runs).toHaveLength(1);
    expect(db.state.campaigns[0].runCount).toBe(1);
  });

  it("duas instâncias do servidor (deploy sobreposto) também não duplicam", async () => {
    seed({ contacts: [{ phone: "5583999990001" }, { phone: "5583999990002" }] });
    // runDueCampaignsOnce ignora a trava em memória, como um segundo processo faria
    await Promise.all([runDueCampaignsOnce(), runDueCampaignsOnce()]);
    expect(db.state.messages).toHaveLength(2);
    expect(db.state.runs).toHaveLength(1);
  });

  it("campanha ONCE é concluída e recorrente avança para a próxima data", async () => {
    seed({ contacts: [{ phone: "5583999990001" }], scheduleType: "ONCE" });
    await runDueCampaigns();
    expect(db.state.campaigns[0].status).toBe("COMPLETED");
    expect(db.state.campaigns[0].nextRunAt).toBeNull();

    for (const k of Object.keys(db.state) as Array<keyof typeof db.state>) (db.state[k] as any[]).length = 0;
    seed({ contacts: [{ phone: "5583999990001" }], scheduleType: "DAILY" });
    await runDueCampaigns();
    expect(db.state.campaigns[0].status).toBe("ACTIVE");
    expect(db.state.campaigns[0].nextRunAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("template incompatível barra a execução, registra o motivo e pausa", async () => {
    seed({ contacts: [{ phone: "5583999990001" }] });
    db.state.templates[0].components = [{ type: "HEADER", format: "IMAGE" }, { type: "BODY", text: "Olá" }];
    await runDueCampaigns();
    expect(db.state.messages).toHaveLength(0);
    expect(db.state.runs[0].status).toBe("FAILED");
    expect(db.state.runs[0].errorMessage).toContain("exige uma imagem");
    expect(db.state.campaigns[0].status).toBe("PAUSED");
  });
});

describe("campaignWorker — contatos repetidos", () => {
  it("o mesmo telefone (inclusive em formatos diferentes) recebe uma mensagem só", async () => {
    seed({
      contacts: [
        { phone: "5583986241167" },
        { phone: "5583986241167" },  // duplicado exato
        { phone: "83986241167" },    // mesmo número sem DDI
        { phone: "558386241167" },   // mesmo número sem o 9º dígito
        { phone: "5511988887777" },
      ],
    });

    await runDueCampaigns();

    expect(db.state.messages.map((m) => m.to).sort()).toEqual(["5511988887777", "5583986241167"]);
  });

  it("telefone vazio ou inválido não é enfileirado", async () => {
    seed({ contacts: [{ phone: "" }, { phone: "abc" }, { phone: "5583986241167" }] });
    await runDueCampaigns();
    expect(db.state.messages.map((m) => m.to)).toEqual(["5583986241167"]);
  });
});

describe("campaignWorker — listas grandes", () => {
  it("lista de 25 mil contatos é enfileirada em lotes e por inteiro", async () => {
    const contacts = Array.from({ length: 25_000 }, (_, i) => ({ phone: `55839${String(90000000 + i)}` }));
    seed({ contacts });

    await runDueCampaigns();

    expect(db.state.messages).toHaveLength(25_000);
    expect(Math.max(...db.state.createManyCalls)).toBeLessThanOrEqual(5_000);
    expect(db.state.runs[0].messagesSent).toBe(25_000);
    expect(db.state.runs[0].contactsTotal).toBe(25_000);
  });
});

describe("campaignWorker — vínculo das mensagens com a execução", () => {
  it("cada mensagem guarda a campanha e a execução que a gerou", async () => {
    seed({ contacts: [{ phone: "5583999990001" }] });
    await runDueCampaigns();
    expect(db.state.messages[0].campaignId).toBe("camp-1");
    expect(db.state.messages[0].campaignRunId).toBe(db.state.runs[0].id);
  });
});
