import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  account: { findFirst: vi.fn() },
  user: { findUnique: vi.fn() },
  accountShare: { findFirst: vi.fn() },
}));
vi.mock("../db", () => ({ prisma: prismaMock }));

import { hasPermission, getAccountWithPermission, AccountPermission } from "../utils/accountAccess";

const ALL: AccountPermission[] = ["view", "viewReports", "chat", "dispatch", "manageTeam", "manageSettings"];
const allowed = (role: string) => ALL.filter(p => hasPermission(role, p));

describe("Matriz de permissões por cargo", () => {
  it("Proprietário e Administrador têm todas as permissões delegáveis", () => {
    expect(allowed("OWNER")).toEqual(ALL);
    expect(allowed("ADMIN")).toEqual(ALL);
  });

  it("Gerente escolhe templates e dispara, mas não gerencia equipe nem chaves de API", () => {
    expect(allowed("MANAGER")).toEqual(["view", "viewReports", "chat", "dispatch"]);
  });

  it("Atendente atende no chat, sem disparos em massa nem métricas", () => {
    expect(allowed("ATTENDANT")).toEqual(["view", "chat"]);
  });

  it("Visualizador só lê", () => {
    expect(allowed("VIEWER")).toEqual(["view", "viewReports"]);
  });

  it("cargo desconhecido ou vazio não tem permissão nenhuma", () => {
    expect(allowed("HACKER")).toEqual([]);
    expect(allowed("")).toEqual([]);
  });
});

function fakeRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe("getAccountWithPermission", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prismaMock.account.findFirst.mockResolvedValue({ id: "acc-1", userId: "owner-1", name: "Loja" });
    prismaMock.user.findUnique.mockResolvedValue({ id: "member-1", role: "USER" });
  });

  it("libera o Gerente (colaborador) para listar e criar templates — o bug reportado", async () => {
    prismaMock.accountShare.findFirst.mockResolvedValue({ role: "MANAGER" });
    for (const perm of ["view", "dispatch"] as const) {
      const res = fakeRes();
      const account = await getAccountWithPermission(res, "acc-1", "member-1", perm);
      expect(account?.accountRole).toBe("MANAGER");
      expect(res.status).not.toHaveBeenCalled();
    }
  });

  it("responde 403 quando o cargo não tem a permissão", async () => {
    prismaMock.accountShare.findFirst.mockResolvedValue({ role: "VIEWER" });
    const res = fakeRes();
    const account = await getAccountWithPermission(res, "acc-1", "member-1", "dispatch");
    expect(account).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("responde 404 para quem não é dono nem colaborador da conta", async () => {
    prismaMock.accountShare.findFirst.mockResolvedValue(null);
    const res = fakeRes();
    const account = await getAccountWithPermission(res, "acc-1", "stranger", "view");
    expect(account).toBeNull();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("o dono sempre passa", async () => {
    const res = fakeRes();
    const account = await getAccountWithPermission(res, "acc-1", "owner-1", "manageSettings");
    expect(account?.accountRole).toBe("OWNER");
  });
});
