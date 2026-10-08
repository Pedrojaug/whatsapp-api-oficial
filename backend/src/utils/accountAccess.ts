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

// ── Credenciais de colaboradores (Equipe & Acessos) ────────────────────────────

export const MEMBER_PASSWORD_MIN = 6;
export const MEMBER_PASSWORD_MAX = 128;

/**
 * Valida a senha definida pelo admin para um colaborador.
 * Retorna a mensagem de erro, ou null se a senha for válida.
 * A senha é armazenada exatamente como digitada (o login não faz trim),
 * por isso espaços nas pontas são rejeitados em vez de removidos em silêncio.
 */
export function validateMemberPassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length === 0) {
    return "Defina uma senha de acesso para o colaborador.";
  }
  if (password !== password.trim()) {
    return "A senha não pode começar nem terminar com espaço.";
  }
  if (password.length < MEMBER_PASSWORD_MIN) {
    return `A senha deve ter no mínimo ${MEMBER_PASSWORD_MIN} caracteres.`;
  }
  if (password.length > MEMBER_PASSWORD_MAX) {
    return `A senha deve ter no máximo ${MEMBER_PASSWORD_MAX} caracteres.`;
  }
  return null;
}

export interface CredentialTarget {
  role: string;
  planTier: string;
  ownedAccountsCount: number;
  sharedAccountOwnerIds: string[];
}

/**
 * Um admin de conta só pode definir senha/nome de um colaborador "gerenciado":
 * usuário criado pela tela de Equipe (planTier team_member), sem contas próprias
 * e vinculado apenas a contas do mesmo proprietário. Isso impede que o admin de
 * um tenant sobrescreva a senha de um usuário independente (account takeover).
 */
export function isManagedCollaborator(target: CredentialTarget, accountOwnerId: string): boolean {
  if (target.role === "SUPERUSER" || target.role === "ADMIN") return false;
  if (target.planTier !== "team_member") return false;
  if (target.ownedAccountsCount > 0) return false;
  return target.sharedAccountOwnerIds.every(ownerId => ownerId === accountOwnerId);
}

export async function loadCredentialTarget(userId: string): Promise<CredentialTarget | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      planTier: true,
      _count: { select: { accounts: true } },
      sharedAccounts: { select: { account: { select: { userId: true } } } },
    },
  });
  if (!user) return null;
  return {
    role: user.role,
    planTier: user.planTier,
    ownedAccountsCount: user._count.accounts,
    sharedAccountOwnerIds: user.sharedAccounts.map(s => s.account.userId),
  };
}
