import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";

const prismaMock = vi.hoisted(() => ({
  account: { findUnique: vi.fn() },
  agentEvent: { update: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
  $queryRaw: vi.fn(),
}));
const axiosPost = vi.hoisted(() => vi.fn());
vi.mock("../db", () => ({ prisma: prismaMock }));
vi.mock("axios", () => ({ default: { post: axiosPost } }));
vi.mock("../utils/crypto", () => ({ decryptToken: (s: string) => s.replace(/^enc:/, ""), encryptToken: (s: string) => `enc:${s}` }));

import {
  signAgentPayload,
  validateAgentWebhookUrl,
  isAgentPauseActive,
  buildMessageReceivedPayload,
  buildEventEnvelope,
  invalidateAgentConfig,
} from "../services/agentService";
import { parseTextMessageBody } from "../routes/agentApiRoutes";
import { processAgentEvents, RETRY_DELAYS_MS, MAX_ATTEMPTS } from "../workers/agentDelivery";

describe("assinatura do webhook", () => {
  it("é HMAC-SHA256 de `${timestamp}.${corpo}`, como o exemplo em Python da documentação", () => {
    const body = JSON.stringify({ id: "e1", type: "ping" });
    const sig = signAgentPayload("whsec_teste", 1762365600, body);
    const expected = "sha256=" + crypto.createHmac("sha256", "whsec_teste").update(`1762365600.${body}`).digest("hex");
    expect(sig).toBe(expected);
    expect(signAgentPayload("outro", 1762365600, body)).not.toBe(sig);
    expect(signAgentPayload("whsec_teste", 1762365601, body)).not.toBe(sig);
  });
});

describe("validateAgentWebhookUrl", () => {
  it("aceita HTTPS público", () => {
    expect(validateAgentWebhookUrl("https://agente.inteligentte.com.br/webhooks/send")).toBeNull();
    expect(validateAgentWebhookUrl("https://31.97.10.20/webhooks/send")).toBeNull();
  });
  it("recusa HTTP, endereços internos e credenciais na URL", () => {
    for (const url of [
      "http://agente.inteligentte.com.br/hook",
      "https://localhost:8000/hook",
      "https://127.0.0.1/hook",
      "https://10.0.0.5/hook",
      "https://192.168.0.10/hook",
      "https://172.20.1.1/hook",
      "https://169.254.169.254/latest/meta-data",
      "https://[::1]/hook",
      "https://servico.internal/hook",
      "https://user:senha@agente.com/hook",
      "não é url",
    ]) {
      expect(validateAgentWebhookUrl(url), url).not.toBeNull();
    }
  });
});

describe("isAgentPauseActive", () => {
  afterEach(() => { delete process.env.AGENT_PAUSE_HOURS; });
  it("pausa vale por 24h por padrão e depois expira", () => {
    const now = new Date("2026-11-05T12:00:00Z");
    expect(isAgentPauseActive({ agentPaused: true, agentPausedAt: new Date("2026-11-05T00:00:00Z") }, now)).toBe(true);
    expect(isAgentPauseActive({ agentPaused: true, agentPausedAt: new Date("2026-11-04T11:00:00Z") }, now)).toBe(false);
    expect(isAgentPauseActive({ agentPaused: false, agentPausedAt: new Date() }, now)).toBe(false);
    expect(isAgentPauseActive(null, now)).toBe(false);
  });
  it("respeita AGENT_PAUSE_HOURS", () => {
    process.env.AGENT_PAUSE_HOURS = "2";
    const now = new Date("2026-11-05T12:00:00Z");
    expect(isAgentPauseActive({ agentPaused: true, agentPausedAt: new Date("2026-11-05T09:00:00Z") }, now)).toBe(false);
  });
});

describe("payload de message.received", () => {
  const base = {
    account: { id: "acc", name: "Lab", phoneNumberId: "pn" },
    contact: { phone: "5583999990001", name: "Maria", optedOut: false },
    origin: { campaignId: "c1", campaignName: "Novembro", templateName: "tpl", sentAt: "2026-11-03T16:00:00.000Z" },
  };
  const received = new Date("2026-11-05T18:00:00Z");

  it("clique em botão de template traz texto e payload; janela de 24h calculada", () => {
    const p = buildMessageReceivedPayload({
      ...base,
      message: { id: "m1", wamid: "wamid.1", type: "BUTTON", text: "Quero sim", mediaId: null, receivedAt: received },
      raw: { type: "button", timestamp: "1762365600", button: { text: "Quero sim", payload: "Quero sim" }, context: { id: "wamid.campanha" } },
    });
    expect(p.message.sentAt).toBe(new Date(1762365600 * 1000).toISOString());
    expect(p.message.type).toBe("button");
    expect(p.message.button).toEqual({ text: "Quero sim", payload: "Quero sim" });
    expect(p.message.replyToWamid).toBe("wamid.campanha");
    expect(p.conversation.windowExpiresAt).toBe("2026-11-06T18:00:00.000Z");
    expect(p.origin?.campaignName).toBe("Novembro");
  });

  it("resposta a botão enviado pelo agente devolve o id escolhido pelo agente", () => {
    const p = buildMessageReceivedPayload({
      ...base,
      message: { id: "m2", wamid: "wamid.2", type: "INTERACTIVE", text: "Até 1 mil", mediaId: null, receivedAt: received },
      raw: { type: "interactive", interactive: { type: "button_reply", button_reply: { id: "vol_ate_1k", title: "Até 1 mil" } } },
    });
    expect(p.message.button).toEqual({ text: "Até 1 mil", payload: "vol_ate_1k" });
  });

  it("áudio traz mediaId e mimeType para transcrição", () => {
    const p = buildMessageReceivedPayload({
      ...base,
      message: { id: "m3", wamid: "wamid.3", type: "AUDIO", text: "🎤 Mensagem de voz", mediaId: "123456789", receivedAt: received },
      raw: { type: "audio", audio: { id: "123456789", mime_type: "audio/ogg; codecs=opus", voice: true } },
    });
    expect(p.message.mediaId).toBe("123456789");
    expect(p.message.mimeType).toBe("audio/ogg; codecs=opus");
    expect(p.message.button).toBeNull();
  });

  it("envelope tem id, seq, tipo, versão e data", () => {
    const env = buildEventEnvelope({ id: "e1", seq: 7, type: "ping", createdAt: received, payload: { a: 1 } });
    expect(env).toEqual({ id: "e1", seq: 7, type: "ping", version: 1, createdAt: received.toISOString(), data: { a: 1 } });
  });
});

describe("parseTextMessageBody", () => {
  it("normaliza o telefone e aceita texto simples", () => {
    expect(parseTextMessageBody({ to: "83 99999-0001", text: " Olá " })).toEqual({
      to: "5583999990001", text: "Olá", buttons: null, replyToWamid: null,
    });
  });
  it("aceita até 3 botões e gera id quando faltar", () => {
    const r = parseTextMessageBody({ to: "5583999990001", text: "Escolha", buttons: [{ title: "Sim" }, { id: "n", title: "Não" }] });
    expect(r).toMatchObject({ buttons: [{ id: "btn_1", title: "Sim" }, { id: "n", title: "Não" }] });
  });
  it("recusa entradas inválidas", () => {
    expect(parseTextMessageBody({ to: "123", text: "x" })).toHaveProperty("error");
    expect(parseTextMessageBody({ to: "5583999990001", text: "" })).toHaveProperty("error");
    expect(parseTextMessageBody({ to: "5583999990001", text: "x".repeat(4097) })).toHaveProperty("error");
    expect(parseTextMessageBody({ to: "5583999990001", text: "x".repeat(1025), buttons: [{ title: "a" }] })).toHaveProperty("error");
    expect(parseTextMessageBody({ to: "5583999990001", text: "x", buttons: [] })).toHaveProperty("error");
    expect(parseTextMessageBody({ to: "5583999990001", text: "x", buttons: [1, 2, 3, 4].map((i) => ({ title: `b${i}` })) })).toHaveProperty("error");
    expect(parseTextMessageBody({ to: "5583999990001", text: "x", buttons: [{ title: "um título com mais de vinte" }] })).toHaveProperty("error");
  });
});

describe("worker de entrega", () => {
  const event = { id: "ev-1", seq: 10, accountId: "acc", type: "message.received", phone: "5583999990001", payload: { x: 1 }, createdAt: new Date() };

  beforeEach(() => {
    vi.clearAllMocks();
    invalidateAgentConfig("acc");
    prismaMock.account.findUnique.mockResolvedValue({ agentEnabled: true, agentWebhookUrl: "https://agente.test/hook", agentWebhookSecret: "enc:segredo" });
    prismaMock.agentEvent.update.mockResolvedValue({});
    prismaMock.agentEvent.findFirst.mockResolvedValue(null);
    prismaMock.agentEvent.deleteMany.mockResolvedValue({ count: 0 });
  });

  function claimOnce(attempts: number) {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ ...event, attempts }]).mockResolvedValue([]);
  }

  it("2xx marca DELIVERED e envia headers assinados", async () => {
    claimOnce(1);
    axiosPost.mockResolvedValue({ status: 200 });
    await processAgentEvents();

    const [url, body, opts] = axiosPost.mock.calls[0];
    expect(url).toBe("https://agente.test/hook");
    expect(JSON.parse(body)).toMatchObject({ id: "ev-1", seq: 10, type: "message.received", version: 1, data: { x: 1 } });
    const ts = Number(opts.headers["X-Send-Timestamp"]);
    expect(opts.headers["X-Send-Signature"]).toBe(signAgentPayload("segredo", ts, body));
    expect(opts.headers["X-Send-Event-Id"]).toBe("ev-1");
    expect(prismaMock.agentEvent.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: "DELIVERED" }) }));
  });

  it("erro agenda nova tentativa com a espera da tabela", async () => {
    claimOnce(2);
    axiosPost.mockResolvedValue({ status: 500 });
    const before = Date.now();
    await processAgentEvents();
    const data = prismaMock.agentEvent.update.mock.calls[0][0].data;
    expect(data.deliveryStatus).toBe("PENDING");
    expect(data.lastError).toBe("HTTP 500");
    expect(data.nextAttemptAt.getTime() - before).toBeGreaterThanOrEqual(RETRY_DELAYS_MS[1] - 50);
  });

  it(`desiste na tentativa ${MAX_ATTEMPTS} (evento continua em /events)`, async () => {
    claimOnce(MAX_ATTEMPTS);
    axiosPost.mockRejectedValue(Object.assign(new Error("timeout"), { code: "ECONNABORTED" }));
    await processAgentEvents();
    const data = prismaMock.agentEvent.update.mock.calls[0][0].data;
    expect(data.deliveryStatus).toBe("FAILED");
    expect(data.lastError).toContain("Tempo esgotado");
  });

  it("integração desligada não faz POST: evento fica para leitura (PULL)", async () => {
    prismaMock.account.findUnique.mockResolvedValue({ agentEnabled: false, agentWebhookUrl: "https://agente.test/hook", agentWebhookSecret: "enc:s" });
    claimOnce(1);
    await processAgentEvents();
    expect(axiosPost).not.toHaveBeenCalled();
    expect(prismaMock.agentEvent.update.mock.calls[0][0].data.deliveryStatus).toBe("PULL");
  });
});
