/**
 * Ponta a ponta da integração com o agente de IA contra um Postgres real.
 *
 * Só roda com TEST_DATABASE_URL (ex.: branch temporário do Neon com `prisma db push`).
 * NUNCA aponte para produção. A Meta é simulada (nenhuma mensagem sai) e o "agente"
 * é um servidor HTTP local que valida a assinatura como o exemplo em Python da doc.
 *
 *   TEST_DATABASE_URL=postgres://... npx vitest run src/tests/agentFlow.integration.test.ts
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import http from "http";
import crypto from "crypto";
import express from "express";
import type { AddressInfo } from "net";

const TEST_URL = process.env.TEST_DATABASE_URL;
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "chave-de-teste-integracao";
process.env.FACEBOOK_APP_SECRET = "segredo-app-meta-teste";

const holder = vi.hoisted(() => ({ prisma: null as any, userId: "" }));
vi.mock("../db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  holder.prisma = process.env.TEST_DATABASE_URL ? new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } }) : {};
  return { prisma: holder.prisma };
});
// Login simulado: o "atendente" é o usuário de teste
vi.mock("../middlewares/auth", () => ({
  authMiddleware: (req: any, _res: any, next: any) => { req.userId = holder.userId; next(); },
}));
const meta = vi.hoisted(() => ({ sent: [] as any[] }));
vi.mock("../services/metaService", () => ({
  metaService: {
    sendMessage: async (_pn: string, _tk: string, payload: any) => {
      meta.sent.push(payload);
      return { data: { messages: [{ id: `wamid.out.${meta.sent.length}.${Date.now()}` }] } };
    },
    getMediaUrl: async () => ({ data: { url: "https://cdn.meta.test/x", mime_type: "audio/ogg" } }),
    getMediaBuffer: async () => ({ data: Buffer.from("OGG-FAKE-AUDIO") }),
  },
}));
vi.mock("../workers/dispatcher", async (orig) => ({ ...(await orig<any>()), triggerDispatcher: vi.fn() }));

import { encryptToken } from "../utils/crypto";
import webhookRouter from "../routes/webhookRoutes";
import publicApiRouter from "../routes/publicApiRoutes";
import chatRouter from "../routes/chatRoutes";
import agentRouter from "../routes/agentRoutes";
import { invalidateAgentConfig } from "../services/agentService";

const AGENT_SECRET = "whsec_teste_integracao";
const PHONE_A = "5583990000101";
const PHONE_B = "5583990000102";
const PHONE_C = "5583990000103";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jsonOf = async (r: Response): Promise<any> => r.json();

describe.skipIf(!TEST_URL)("agente de IA — fluxo completo (Postgres real)", () => {
  let prisma: any;
  let api: http.Server;
  let agent: http.Server;
  let base = "";
  let apiKey = "";
  let accountId = "";
  const received: Array<{ event: any; validSignature: boolean }> = [];
  const tag = `agente-itest-${Date.now()}`;
  const phoneNumberId = `99${Date.now()}`;

  /** Espera um evento que satisfaça o filtro (eventos de outros testes podem chegar intercalados). */
  async function waitForEvent(pred: (e: any) => boolean, timeoutMs = 15_000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const hit = received.find((r) => pred(r.event));
      if (hit) return hit.event;
      await sleep(100);
    }
    return null;
  }
  const textFrom = (phone: string, text: string) => (e: any) =>
    e.type === "message.received" && e.data.contact.phone === phone && e.data.message.text === text;

  async function waitForEvents(n: number, timeoutMs = 15_000) {
    const start = Date.now();
    while (received.length < n && Date.now() - start < timeoutMs) await sleep(100);
    return received.length;
  }

  async function metaWebhook(from: string, message: any, name = "Lead Teste") {
    const body = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{ changes: [{ field: "messages", value: {
        metadata: { phone_number_id: phoneNumberId },
        contacts: [{ wa_id: from, profile: { name } }],
        messages: [{ from, id: `wamid.in.${crypto.randomUUID()}`, timestamp: String(Math.floor(Date.now() / 1000)), ...message }],
      } }] }],
    });
    const sig = "sha256=" + crypto.createHmac("sha256", process.env.FACEBOOK_APP_SECRET!).update(body).digest("hex");
    const res = await fetch(`${base}/api/webhooks`, { method: "POST", headers: { "Content-Type": "application/json", "x-hub-signature-256": sig }, body });
    expect(res.status).toBe(200);
  }

  const v1 = (path: string, init: RequestInit = {}) =>
    fetch(`${base}/api/v1${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, ...(init.headers || {}) } });

  beforeAll(async () => {
    prisma = holder.prisma;

    // "Agente" local: valida assinatura igual ao exemplo em Python
    agent = http.createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        const ts = String(req.headers["x-send-timestamp"]);
        const expected = "sha256=" + crypto.createHmac("sha256", AGENT_SECRET).update(`${ts}.${raw}`).digest("hex");
        const got = String(req.headers["x-send-signature"]);
        const validSignature = expected.length === got.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(got));
        received.push({ event: JSON.parse(raw), validSignature });
        res.writeHead(validSignature ? 200 : 401).end();
      });
    });
    await new Promise<void>((r) => agent.listen(0, "127.0.0.1", r));
    const agentUrl = `http://127.0.0.1:${(agent.address() as AddressInfo).port}/webhooks/send`;

    const app = express();
    app.use(express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf; } }));
    app.use("/api", webhookRouter);
    app.use("/api/v1", publicApiRouter);
    app.use("/api", chatRouter);
    app.use("/api", agentRouter);
    api = app.listen(0, "127.0.0.1");
    await new Promise((r) => api.once("listening", r));
    base = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;

    const user = await prisma.user.create({ data: { email: `${tag}@teste.invalid`, name: "Ana Atendente" } });
    holder.userId = user.id;
    const account = await prisma.account.create({
      data: {
        name: tag, wabaId: "waba-itest", phoneNumberId, accessToken: encryptToken("token-falso"), userId: user.id,
        // URL local gravada direto no banco (o painel só aceita HTTPS público)
        agentEnabled: true, agentWebhookUrl: agentUrl, agentWebhookSecret: encryptToken(AGENT_SECRET),
      },
    });
    accountId = account.id;
    apiKey = `sk_${crypto.randomBytes(24).toString("base64url")}`;
    await prisma.apiKey.create({
      data: { name: "agente", keyHash: crypto.createHash("sha256").update(apiKey).digest("hex"), keyPrefix: apiKey.slice(0, 10), accountId },
    });
    // O lead A veio de uma campanha
    const campaign = await prisma.campaign.create({
      data: { name: "Campanha Novembro", accountId, templateName: "tpl_nov", scheduleType: "ONCE", status: "COMPLETED" },
    });
    await prisma.message.create({
      data: { accountId, to: PHONE_A, templateName: "tpl_nov", status: "DELIVERED", direction: "OUTGOING", campaignId: campaign.id },
    });
    invalidateAgentConfig(accountId);
  }, 120_000);

  afterAll(async () => {
    api?.close();
    agent?.close();
    if (holder.userId) await prisma.user.delete({ where: { id: holder.userId } }).catch(() => {});
    await prisma?.$disconnect?.();
  }, 60_000);

  it("mensagem do lead chega ao agente assinada, com a campanha de origem", async () => {
    await metaWebhook(PHONE_A, { type: "button", button: { text: "Quero sim", payload: "Quero sim" } }, "Maria");
    expect(await waitForEvents(1)).toBe(1);
    const { event, validSignature } = received[0];
    expect(validSignature).toBe(true);
    expect(event.type).toBe("message.received");
    expect(event.data.contact).toEqual({ phone: PHONE_A, name: "Maria", optedOut: false });
    expect(event.data.message).toMatchObject({ type: "button", text: "Quero sim", button: { text: "Quero sim", payload: "Quero sim" } });
    expect(event.data.origin).toMatchObject({ campaignName: "Campanha Novembro", templateName: "tpl_nov" });
  }, 30_000);

  it("agente responde com texto e com botões pela API", async () => {
    let res = await v1("/messages/text", { method: "POST", body: JSON.stringify({ to: PHONE_A, text: "Oi Maria! Qual o tamanho da sua equipe?" }) });
    expect(res.status).toBe(201);
    expect(meta.sent.at(-1)).toMatchObject({ to: PHONE_A, type: "text", text: { body: "Oi Maria! Qual o tamanho da sua equipe?" } });

    res = await v1("/messages/text", { method: "POST", body: JSON.stringify({ to: PHONE_A, text: "Escolha:", buttons: [{ id: "p", title: "Pequena" }, { id: "g", title: "Grande" }] }) });
    expect(res.status).toBe(201);
    expect(meta.sent.at(-1).interactive.action.buttons).toHaveLength(2);

    const saved = await prisma.message.findMany({ where: { accountId, to: PHONE_A, sentByUserName: "Agente IA" } });
    expect(saved).toHaveLength(2);
  });

  it("estado e histórico da conversa", async () => {
    const st = await jsonOf(await v1(`/conversations/${PHONE_A}`));
    expect(st).toMatchObject({ phone: PHONE_A, windowOpen: true, agentPaused: false, optedOut: false });
    expect(st.origin.campaignName).toBe("Campanha Novembro");
    const hist = await jsonOf(await v1(`/conversations/${PHONE_A}/messages?limit=10`));
    expect(hist.map((m: any) => m.direction)).toEqual(["OUTGOING", "INCOMING", "OUTGOING", "OUTGOING"]);
    expect(hist.at(-1).sentBy).toBe("Agente IA");
  });

  it("fora da janela de 24h a API recusa texto livre", async () => {
    const res = await v1("/messages/text", { method: "POST", body: JSON.stringify({ to: PHONE_B, text: "Oi" }) });
    expect(res.status).toBe(422);
    expect((await jsonOf(res)).code).toBe("OUTSIDE_WINDOW");
  });

  it("atendente responde no Live Chat: agente é pausado, avisado e deixa de receber", async () => {
    const before = received.length;
    const res = await fetch(`${base}/api/accounts/${accountId}/messages/reply`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: PHONE_A, body: "Aqui é a Ana, vou te ajudar." }),
    });
    expect(res.status).toBe(201);
    expect(await waitForEvents(before + 1)).toBe(before + 1);
    expect(received.at(-1)!.event).toMatchObject({ type: "conversation.handover", data: { handover: { by: "human", userName: "Ana Atendente" } } });

    // Segunda resposta do atendente não gera outro aviso
    await fetch(`${base}/api/accounts/${accountId}/messages/reply`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: PHONE_A, body: "Um instante." }),
    });
    // Lead escreve: não vai para o agente
    await metaWebhook(PHONE_A, { type: "text", text: { body: "Ok, aguardo" } });
    await sleep(2_000);
    expect(received.length).toBe(before + 1);

    const blocked = await v1("/messages/text", { method: "POST", body: JSON.stringify({ to: PHONE_A, text: "Posso ajudar?" }) });
    expect(blocked.status).toBe(409);
    expect((await jsonOf(blocked)).code).toBe("HUMAN_HANDOVER");
  }, 40_000);

  it("atendente devolve ao agente: próxima mensagem volta a ser repassada", async () => {
    const res = await fetch(`${base}/api/accounts/${accountId}/conversations/${PHONE_A}/agent`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paused: false }),
    });
    expect((await jsonOf(res)).paused).toBe(false);
    const before = received.length;
    await metaWebhook(PHONE_A, { type: "text", text: { body: "Voltei" } });
    expect(await waitForEvents(before + 1)).toBe(before + 1);
    expect(received.at(-1)!.event.data.message.text).toBe("Voltei");
  }, 30_000);

  it("agente pede um humano: conversa volta para 'aguardando' e o agente é pausado", async () => {
    const res = await v1(`/conversations/${PHONE_A}/handover`, { method: "POST", body: JSON.stringify({ reason: "Quer proposta personalizada" }) });
    expect(res.status).toBe(200);
    const contact = await prisma.whatsAppContact.findUnique({ where: { accountId_phone: { accountId, phone: PHONE_A } } });
    expect(contact).toMatchObject({ agentPaused: true, agentPausedBy: "agente", isHandled: false });
  });

  it("opt-out por palavra-chave chega marcado e a API recusa responder", async () => {
    await metaWebhook(PHONE_C, { type: "text", text: { body: "SAIR" } });
    const ev = await waitForEvent(textFrom(PHONE_C, "SAIR"));
    expect(ev?.data.contact.optedOut).toBe(true);
    const res = await v1("/messages/text", { method: "POST", body: JSON.stringify({ to: PHONE_C, text: "Tudo bem" }) });
    expect((await jsonOf(res)).code).toBe("OPT_OUT");
  }, 30_000);

  it("rajada do mesmo lead: tudo chega, entregue na ordem de seq, com sentAt da Meta", async () => {
    const phone = "5583990000104";
    const words = ["um", "dois", "tres", "quatro"];
    for (const t of words) await metaWebhook(phone, { type: "text", text: { body: t } });
    for (const t of words) expect(await waitForEvent(textFrom(phone, t)), t).not.toBeNull();
    const mine = received.map((r) => r.event).filter((e) => e.data?.contact?.phone === phone);
    expect(mine.map((e) => e.data.message.text).sort()).toEqual([...words].sort());
    // Garantia do Send: por contato, a entrega segue a ordem de criação dos eventos (seq)
    expect(mine.map((e) => e.seq)).toEqual([...mine.map((e) => e.seq)].sort((a, b) => a - b));
    expect(mine.every((e) => typeof e.data.message.sentAt === "string")).toBe(true);
  }, 30_000);

  it("áudio: agente baixa a mídia pela API; mídia de outra conta não", async () => {
    await metaWebhook(PHONE_B, { type: "audio", audio: { id: "778899001122", mime_type: "audio/ogg; codecs=opus", voice: true } });
    const ev = await waitForEvent((e) => e.type === "message.received" && e.data.contact.phone === PHONE_B);
    const mediaId = ev?.data.message.mediaId;
    expect(mediaId).toBe("778899001122");
    const ok = await v1(`/media/${mediaId}`);
    expect(ok.status).toBe(200);
    expect(Buffer.from(await ok.arrayBuffer()).toString()).toBe("OGG-FAKE-AUDIO");
    expect((await v1("/media/123123123123")).status).toBe(404);
  }, 30_000);

  it("leitura por /events devolve tudo em ordem, com cursor", async () => {
    expect(await waitForEvent((e) => e.type === "conversation.handover" && e.data.handover.by === "agent")).not.toBeNull();
    const page1: any = await jsonOf(await v1("/events?after=0&limit=3"));
    expect(page1.events).toHaveLength(3);
    expect(page1.hasMore).toBe(true);
    const page2: any = await jsonOf(await v1(`/events?after=${page1.nextAfter}&limit=200`));
    const all = [...page1.events, ...page2.events];
    expect(all.length).toBe(received.length);
    expect(all.map((e: any) => e.id).sort()).toEqual(received.map((r) => r.event.id).sort());
    expect(received.every((r) => r.validSignature)).toBe(true);
  });
});
