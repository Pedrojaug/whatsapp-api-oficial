import type { Response } from "express";
import { prisma } from "../db";
import type { Account } from "@prisma/client";

type AccountAccess = Account & { isShared: boolean; isOwner: boolean; accountRole: string };

// Banco em outra região: cada consulta custa ~175 ms. A checagem de acesso roda em quase
// toda rota, então o resultado fica em memória por pouco tempo e é invalidado nas mutações.
const ACCESS_TTL_MS = 30_000;
const accessCache = new Map<string, { value: AccountAccess | null; expiresAt: number }>();

const PHONE_TTL_MS = 60_000;
const phoneCache = new Map<string, { value: Account; expiresAt: number }>();

function pruneExpired<T>(cache: Map<string, { value: T; expiresAt: number }>, now: number) {
  if (cache.size < 1000) return;
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
}

/**
 * Limpa os caches de acesso e de phoneNumberId de uma conta. Chamar sempre que a conta
 * (token, número) ou seus compartilhamentos mudarem; sem accountId, limpa tudo.
 */
export function invalidateAccountAccess(accountId?: string) {
  if (!accountId) {
    accessCache.clear();
    phoneCache.clear();
    return;
  }
  const prefix = `${accountId}:`;
  for (const key of accessCache.keys()) {
    if (key.startsWith(prefix)) accessCache.delete(key);
  }
  for (const [key, entry] of phoneCache) {
    if (entry.value.id === accountId) phoneCache.delete(key);
  }
}

/**
 * Retorna a Account se o userId for o dono OU tiver um AccountShare ativo.
 * Retorna null se não tiver acesso.
 * O campo `isShared` indica se o acesso é via compartilhamento (não é o dono).
 */
export async function findAccountForUser(accountId: string, userId: string): Promise<AccountAccess | null> {
  const key = `${accountId}:${userId}`;
  const now = Date.now();
  const cached = accessCache.get(key);
  if (cached && cached.expiresAt > now) {
    // Cópia rasa: quem chama não deve conseguir alterar a entrada em cache
    return cached.value ? { ...cached.value } : null;
  }

  // Conta (com o share do usuário) e papel do usuário numa única ida ao banco
  const [accountWithShare, user] = await Promise.all([
    prisma.account.findFirst({
      where: { id: accountId },
      include: { shares: { where: { userId }, select: { role: true }, take: 1 } },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
  ]);

  let value: AccountAccess | null = null;
  if (accountWithShare) {
    const { shares, ...account } = accountWithShare;
    if (account.userId === userId) {
      value = { ...account, isShared: false, isOwner: true, accountRole: "OWNER" };
    } else if (user?.role === "ADMIN") {
      value = { ...account, isShared: false, isOwner: false, accountRole: "OWNER" };
    } else if (shares.length > 0) {
      value = { ...account, isShared: true, isOwner: false, accountRole: shares[0].role || "ATTENDANT" };
    }
  }

  pruneExpired(accessCache, now);
  accessCache.set(key, { value, expiresAt: now + ACCESS_TTL_MS });
  return value ? { ...value } : null;
}

/**
 * Conta dona de um phoneNumberId da Meta (usada a cada evento de webhook).
 */
export async function findAccountByPhoneNumberId(phoneNumberId: string): Promise<Account | null> {
  const now = Date.now();
  const cached = phoneCache.get(phoneNumberId);
  if (cached && cached.expiresAt > now) {
    return { ...cached.value };
  }

  const account = await prisma.account.findFirst({ where: { phoneNumberId } });
  // "Não encontrado" não vai para o cache: um número recém-conectado precisa ser achado já no próximo evento
  if (account) {
    pruneExpired(phoneCache, now);
    phoneCache.set(phoneNumberId, { value: account, expiresAt: now + PHONE_TTL_MS });
  }
  return account ? { ...account } : null;
}

// ── Matriz de permissões por cargo (fonte única de verdade do RBAC) ───────────
//
// view           Ler dados da conta: conversas, histórico, templates, listas, mídias, campanhas.
// viewReports    Métricas, custos e exportação de relatórios.
// chat           Atender no Live Chat: responder, enviar template a 1 contato, concluir,
//                lista negra e respostas rápidas.
// dispatch       Disparos em massa: campanhas, envio para listas, agendamentos, criar/editar
//                templates, listas, mídias, links rastreáveis e opt-outs.
// manageTeam     Equipe & Acessos (criar, editar e remover colaboradores).
// manageSettings Chaves de API e integrações da conta.
//
// Exclusivo do proprietário (não delegável): excluir a conta e ver o token da Meta.
// Espelho no frontend: frontend/src/utils/permissions.ts — atualize os dois juntos.

export type AccountPermission =
  | "view"
  | "viewReports"
  | "chat"
  | "dispatch"
  | "manageTeam"
  | "manageSettings";

export const ROLE_PERMISSIONS: Record<string, readonly AccountPermission[]> = {
  OWNER: ["view", "viewReports", "chat", "dispatch", "manageTeam", "manageSettings"],
  ADMIN: ["view", "viewReports", "chat", "dispatch", "manageTeam", "manageSettings"],
  MANAGER: ["view", "viewReports", "chat", "dispatch"],
  ATTENDANT: ["view", "chat"],
  VIEWER: ["view", "viewReports"],
};

export function hasPermission(role: string | undefined, permission: AccountPermission): boolean {
  return (ROLE_PERMISSIONS[(role || "").toUpperCase()] ?? []).includes(permission);
}

const PERMISSION_DENIED_MESSAGES: Record<AccountPermission, string> = {
  view: "Você não tem acesso a esta conta.",
  viewReports: "Seu cargo não tem acesso a métricas e relatórios.",
  chat: "Seu cargo possui permissão apenas de visualização.",
  dispatch: "Apenas proprietário, administradores e gerentes podem gerenciar disparos, templates, listas e mídias.",
  manageTeam: "Apenas administradores e proprietários podem gerenciar a equipe.",
  manageSettings: "Apenas administradores e proprietários podem gerenciar as configurações da conta.",
};

type AccountForUser = NonNullable<Awaited<ReturnType<typeof findAccountForUser>>>;

/**
 * Busca a conta (dono ou colaborador) e confere a permissão do cargo.
 * Se não puder, já responde 404/403 e retorna null — o handler só precisa fazer `if (!account) return;`.
 */
export async function getAccountWithPermission(
  res: Response,
  accountId: string,
  userId: string | undefined,
  permission: AccountPermission
): Promise<AccountForUser | null> {
  const account = userId ? await findAccountForUser(accountId, userId) : null;
  if (!account) {
    res.status(404).json({ error: "Conta não encontrada ou acesso negado." });
    return null;
  }
  if (!hasPermission(account.accountRole, permission)) {
    res.status(403).json({ error: PERMISSION_DENIED_MESSAGES[permission], code: "ROLE_FORBIDDEN" });
    return null;
  }
  return account;
}

export function canManageTeam(role?: string): boolean {
  return hasPermission(role, "manageTeam");
}

export function canManageSettings(role?: string): boolean {
  return hasPermission(role, "manageSettings");
}

export function canManageCampaigns(role?: string): boolean {
  return hasPermission(role, "dispatch");
}

export function canSendMessages(role?: string): boolean {
  return hasPermission(role, "chat");
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
