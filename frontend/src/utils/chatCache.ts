/**
 * In-memory Stale-While-Revalidate session cache for Live Chat
 * Persists data across React component mounts/unmounts during SPA navigation
 * (e.g. Dashboard <-> Live Chat <-> Campaigns).
 * 
 * Ensures 0ms instant transitions without loading skeletons when switching menus.
 */

interface ChatCacheStore {
  conversationsByAccount: Map<string, any[]>;
  messagesByPhone: Map<string, any[]>; // key: `${accountId}:${phone}`
  selectedPhoneByAccount: Map<string, string>;
  quickRepliesByAccount: Map<string, any[]>;
  templatesByAccount: Map<string, any[]>;
  filterByAccount: Map<string, string>;
  lastFetchedByAccount: Map<string, number>;
}

const store: ChatCacheStore = {
  conversationsByAccount: new Map(),
  messagesByPhone: new Map(),
  selectedPhoneByAccount: new Map(),
  quickRepliesByAccount: new Map(),
  templatesByAccount: new Map(),
  filterByAccount: new Map(),
  lastFetchedByAccount: new Map(),
};

export const chatCache = {
  // --- Conversas ---
  getConversations(accountId: string): any[] | null {
    if (!accountId) return null;
    return store.conversationsByAccount.get(accountId) || null;
  },

  setConversations(accountId: string, conversations: any[]): void {
    if (!accountId) return;
    store.conversationsByAccount.set(accountId, conversations);
    store.lastFetchedByAccount.set(accountId, Date.now());
  },

  hasConversations(accountId: string): boolean {
    if (!accountId) return false;
    const list = store.conversationsByAccount.get(accountId);
    return Array.isArray(list) && list.length > 0;
  },

  // --- Mensagens do Chat ---
  getMessages(accountId: string, phone: string): any[] | null {
    if (!accountId || !phone) return null;
    return store.messagesByPhone.get(`${accountId}:${phone}`) || null;
  },

  setMessages(accountId: string, phone: string, messages: any[]): void {
    if (!accountId || !phone) return;
    store.messagesByPhone.set(`${accountId}:${phone}`, messages);
  },

  hasMessages(accountId: string, phone: string): boolean {
    if (!accountId || !phone) return false;
    const msgs = store.messagesByPhone.get(`${accountId}:${phone}`);
    return Array.isArray(msgs) && msgs.length > 0;
  },

  // --- Telefone Selecionado ---
  getSelectedPhone(accountId: string): string {
    if (!accountId) return "";
    return store.selectedPhoneByAccount.get(accountId) || "";
  },

  setSelectedPhone(accountId: string, phone: string): void {
    if (!accountId) return;
    store.selectedPhoneByAccount.set(accountId, phone);
  },

  // --- Filtro de Fila Selecionado ---
  getFilter(accountId: string): string {
    if (!accountId) return "ALL";
    return store.filterByAccount.get(accountId) || "ALL";
  },

  setFilter(accountId: string, filter: string): void {
    if (!accountId) return;
    store.filterByAccount.set(accountId, filter);
  },

  // --- Respostas Rápidas ---
  getQuickReplies(accountId: string): any[] | null {
    if (!accountId) return null;
    return store.quickRepliesByAccount.get(accountId) || null;
  },

  setQuickReplies(accountId: string, quickReplies: any[]): void {
    if (!accountId) return;
    store.quickRepliesByAccount.set(accountId, quickReplies);
  },

  // --- Templates WhatsApp ---
  getTemplates(accountId: string): any[] | null {
    if (!accountId) return null;
    return store.templatesByAccount.get(accountId) || null;
  },

  setTemplates(accountId: string, templates: any[]): void {
    if (!accountId) return;
    store.templatesByAccount.set(accountId, templates);
  },

  // --- Limpeza Total (ex: ao fazer logout) ---
  clear(): void {
    store.conversationsByAccount.clear();
    store.messagesByPhone.clear();
    store.selectedPhoneByAccount.clear();
    store.quickRepliesByAccount.clear();
    store.templatesByAccount.clear();
    store.filterByAccount.clear();
    store.lastFetchedByAccount.clear();
  },
};
