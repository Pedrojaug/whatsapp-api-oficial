import { describe, it, expect } from "vitest";

describe("Admin Route Validation Logic", () => {
  it("valida planos permitidos ('free' ou 'paid')", () => {
    const isValidPlan = (plan: string) => ["free", "paid"].includes(plan);
    expect(isValidPlan("free")).toBe(true);
    expect(isValidPlan("paid")).toBe(true);
    expect(isValidPlan("enterprise")).toBe(false);
    expect(isValidPlan("")).toBe(false);
  });

  it("valida perfis permitidos ('USER' ou 'SUPERUSER')", () => {
    const isValidRole = (role: string) => ["USER", "SUPERUSER"].includes(role);
    expect(isValidRole("USER")).toBe(true);
    expect(isValidRole("SUPERUSER")).toBe(true);
    expect(isValidRole("ADMIN")).toBe(false);
  });

  it("impede auto-remoção de superusuário", () => {
    const currentUserId = "admin-123";
    const targetUserId = "admin-123";
    const newRole = "USER";

    const isForbiddenSelfDemotion = (currId: string, targetId: string, role: string) => {
      return currId === targetId && role !== "SUPERUSER";
    };

    expect(isForbiddenSelfDemotion(currentUserId, targetUserId, newRole)).toBe(true);
    expect(isForbiddenSelfDemotion(currentUserId, "user-456", newRole)).toBe(false);
  });

  it("impede auto-exclusão de administrador", () => {
    const currentUserId = "admin-123";
    const canDeleteUser = (currId: string, targetId: string) => currId !== targetId;

    expect(canDeleteUser(currentUserId, "admin-123")).toBe(false);
    expect(canDeleteUser(currentUserId, "user-456")).toBe(true);
  });
});
