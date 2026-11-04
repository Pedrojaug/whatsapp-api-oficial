import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  account: { findFirst: vi.fn() },
  user: { findUnique: vi.fn() },
}));
vi.mock("../db", () => ({ prisma: prismaMock }));

import { findAccountForUser, findAccountByPhoneNumberId, invalidateAccountAccess } from "../utils/accountAccess";
import { statusesAtOrAbove } from "../routes/webhookRoutes";
import { runWithConcurrency } from "../workers/dispatcher";

const baseAccount = { id: "acc-1", userId: "owner-1", name: "Conta", phoneNumberId: "pn-1", accessToken: "enc" };

describe("findAccountForUser", () => {
  beforeEach(() => {
    invalidateAccountAccess();
    prismaMock.account.findFirst.mockReset();
    prismaMock.user.findUnique.mockReset();
  });

  it("dono recebe OWNER e o resultado é reaproveitado do cache", async () => {
    prismaMock.account.findFirst.mockResolvedValue({ ...baseAccount, shares: [] });
    prismaMock.user.findUnique.mockResolvedValue({ role: "USER" });

    const first = await findAccountForUser("acc-1", "owner-1");
    const second = await findAccountForUser("acc-1", "owner-1");

    expect(first?.accountRole).toBe("OWNER");
    expect(first?.isOwner).toBe(true);
    expect(second?.accountRole).toBe("OWNER");
    expect(prismaMock.account.findFirst).toHaveBeenCalledTimes(1);
  });

  it("colaborador recebe o papel do compartilhamento; sem share não tem acesso", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "USER" });
    prismaMock.account.findFirst.mockResolvedValueOnce({ ...baseAccount, shares: [{ role: "VIEWER" }] });
    prismaMock.account.findFirst.mockResolvedValueOnce({ ...baseAccount, shares: [] });

    const shared = await findAccountForUser("acc-1", "member-1");
    const outsider = await findAccountForUser("acc-1", "outsider-1");

    expect(shared?.accountRole).toBe("VIEWER");
    expect(shared?.isShared).toBe(true);
    expect(outsider).toBeNull();
  });

  it("ADMIN da plataforma acessa como OWNER mesmo sem compartilhamento", async () => {
    prismaMock.account.findFirst.mockResolvedValue({ ...baseAccount, shares: [] });
    prismaMock.user.findUnique.mockResolvedValue({ role: "ADMIN" });

    const access = await findAccountForUser("acc-1", "admin-1");
    expect(access?.accountRole).toBe("OWNER");
    expect(access?.isOwner).toBe(false);
  });

  it("invalidar a conta força nova consulta (ex.: share removido)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "USER" });
    prismaMock.account.findFirst.mockResolvedValueOnce({ ...baseAccount, shares: [{ role: "ATTENDANT" }] });
    prismaMock.account.findFirst.mockResolvedValueOnce({ ...baseAccount, shares: [] });

    expect(await findAccountForUser("acc-1", "member-1")).not.toBeNull();
    invalidateAccountAccess("acc-1");
    expect(await findAccountForUser("acc-1", "member-1")).toBeNull();
  });

  it("alterar o objeto retornado não contamina o cache", async () => {
    prismaMock.account.findFirst.mockResolvedValue({ ...baseAccount, shares: [] });
    prismaMock.user.findUnique.mockResolvedValue({ role: "USER" });

    const first = await findAccountForUser("acc-1", "owner-1");
    first!.accessToken = "alterado";
    const second = await findAccountForUser("acc-1", "owner-1");
    expect(second?.accessToken).toBe("enc");
  });
});

describe("findAccountByPhoneNumberId", () => {
  beforeEach(() => {
    invalidateAccountAccess();
    prismaMock.account.findFirst.mockReset();
  });

  it("guarda a conta encontrada, mas não o 'não encontrado'", async () => {
    prismaMock.account.findFirst.mockResolvedValueOnce(null);
    prismaMock.account.findFirst.mockResolvedValue(baseAccount);

    expect(await findAccountByPhoneNumberId("pn-1")).toBeNull();
    expect((await findAccountByPhoneNumberId("pn-1"))?.id).toBe("acc-1");
    expect((await findAccountByPhoneNumberId("pn-1"))?.id).toBe("acc-1");
    expect(prismaMock.account.findFirst).toHaveBeenCalledTimes(2);
  });
});

describe("statusesAtOrAbove", () => {
  it("bloqueia eventos redundantes ou fora de ordem", () => {
    expect(statusesAtOrAbove("SENT").sort()).toEqual(["DELIVERED", "READ", "SENT"]);
    expect(statusesAtOrAbove("DELIVERED").sort()).toEqual(["DELIVERED", "READ"]);
    expect(statusesAtOrAbove("READ")).toEqual(["READ"]);
  });

  it("status sem nível (ex.: FAILED) não bloqueia nada", () => {
    expect(statusesAtOrAbove("FAILED")).toEqual([]);
    expect(statusesAtOrAbove("DELETED")).toEqual([]);
  });
});

describe("runWithConcurrency", () => {
  it("processa todos os itens sem passar do limite de execuções simultâneas", async () => {
    let active = 0;
    let peak = 0;
    const done: number[] = [];

    await runWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      done.push(n);
      active--;
    });

    expect(done.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(peak).toBe(3);
  });

  it("aceita lista vazia e limite inválido", async () => {
    const worker = vi.fn(async () => {});
    await runWithConcurrency([], 4, worker);
    await runWithConcurrency([1, 2], 0, worker);
    expect(worker).toHaveBeenCalledTimes(2);
  });
});
