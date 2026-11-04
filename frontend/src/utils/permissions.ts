/**
 * Permissões por cargo — espelho de backend/src/utils/accountAccess.ts (ROLE_PERMISSIONS).
 * O backend é quem garante o acesso; aqui só escondemos o que o cargo não pode usar.
 */
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
  return (ROLE_PERMISSIONS[(role || "OWNER").toUpperCase()] ?? []).includes(permission);
}

/** Permissão necessária para abrir cada tela do painel. */
export const PAGE_PERMISSIONS: Record<string, AccountPermission> = {
  "/metrics": "viewReports",
  "/chat": "view",
  "/lists": "view",
  "/messages": "viewReports",
  "/campaigns": "dispatch",
  "/templates": "dispatch",
  "/link-tracking": "dispatch",
  "/media": "dispatch",
  "/optouts": "dispatch",
  "/team": "manageTeam",
  "/accounts": "manageSettings",
  "/api-keys": "manageSettings",
};

export function canOpenPage(role: string | undefined, pathname: string): boolean {
  const entry = Object.entries(PAGE_PERMISSIONS).find(([p]) => pathname === p || pathname.startsWith(p + "/"));
  return entry ? hasPermission(role, entry[1]) : true;
}

/** Primeira tela que o cargo pode abrir (destino ao ser redirecionado). */
export function homePageFor(role: string | undefined): string {
  return hasPermission(role, "viewReports") ? "/metrics" : "/chat";
}
