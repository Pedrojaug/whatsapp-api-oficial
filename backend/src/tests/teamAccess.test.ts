import { describe, it, expect, vi } from "vitest";

vi.mock("../db", () => ({ prisma: {} }));

import { validateMemberPassword, isManagedCollaborator, CredentialTarget } from "../utils/accountAccess";

describe("Equipe & Acessos — senha do colaborador", () => {
  it("exige senha (não existe mais senha padrão oculta)", () => {
    expect(validateMemberPassword(undefined)).not.toBeNull();
    expect(validateMemberPassword("")).not.toBeNull();
  });

  it("rejeita senha curta em vez de ignorá-la em silêncio", () => {
    expect(validateMemberPassword("12345")).toMatch(/mínimo 6/);
    expect(validateMemberPassword("123456")).toBeNull();
  });

  it("rejeita espaços nas pontas, pois o login compara a senha sem trim", () => {
    expect(validateMemberPassword(" senha123")).not.toBeNull();
    expect(validateMemberPassword("senha123 ")).not.toBeNull();
    expect(validateMemberPassword("minha senha")).toBeNull();
  });

  it("limita o tamanho máximo", () => {
    expect(validateMemberPassword("a".repeat(129))).not.toBeNull();
    expect(validateMemberPassword("a".repeat(128))).toBeNull();
  });
});

describe("Equipe & Acessos — quem pode ter a senha definida pelo admin", () => {
  const owner = "owner-1";
  const managed: CredentialTarget = {
    role: "USER",
    planTier: "team_member",
    ownedAccountsCount: 0,
    sharedAccountOwnerIds: [owner],
  };

  it("permite para colaborador criado pela equipe do mesmo proprietário", () => {
    expect(isManagedCollaborator(managed, owner)).toBe(true);
    expect(isManagedCollaborator({ ...managed, sharedAccountOwnerIds: [owner, owner] }, owner)).toBe(true);
  });

  it("bloqueia usuário independente (cadastro próprio)", () => {
    expect(isManagedCollaborator({ ...managed, planTier: "pro" }, owner)).toBe(false);
    expect(isManagedCollaborator({ ...managed, ownedAccountsCount: 1 }, owner)).toBe(false);
  });

  it("bloqueia colaborador de outro tenant", () => {
    expect(isManagedCollaborator({ ...managed, sharedAccountOwnerIds: [owner, "owner-2"] }, owner)).toBe(false);
  });

  it("bloqueia superusuário e admin da plataforma", () => {
    expect(isManagedCollaborator({ ...managed, role: "SUPERUSER" }, owner)).toBe(false);
    expect(isManagedCollaborator({ ...managed, role: "ADMIN" }, owner)).toBe(false);
  });
});
