import { prisma } from "../db";

/**
 * Retorna a Account se o userId for o dono OU tiver um AccountShare ativo.
 * Retorna null se não tiver acesso.
 * O campo `isShared` indica se o acesso é via compartilhamento (não é o dono).
 */
export async function findAccountForUser(
  accountId: string,
  userId: string
): Promise<({ isShared: boolean; isOwner: boolean; accountRole: string } & Awaited<ReturnType<typeof prisma.account.findFirst>>) | null> {
  const account = await prisma.account.findFirst({
    where: { id: accountId },
  });
  if (!account) return null;

  if (account.userId === userId) {
    return { ...account, isShared: false, isOwner: true, accountRole: "OWNER" };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user && user.role === "ADMIN") {
    return { ...account, isShared: false, isOwner: false, accountRole: "OWNER" };
  }

  const share = await prisma.accountShare.findFirst({
    where: { accountId, userId },
  });
  if (!share) return null;

  return { ...account, isShared: true, isOwner: false, accountRole: share.role || "ATTENDANT" };
}

export function canManageTeam(role?: string): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canManageSettings(role?: string): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canManageCampaigns(role?: string): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "MANAGER";
}

export function canSendMessages(role?: string): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "MANAGER" || role === "ATTENDANT";
}
