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
