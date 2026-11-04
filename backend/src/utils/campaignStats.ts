/**
 * Agrupa os status das mensagens de uma execução de campanha. Os status são
 * cumulativos na prática (READ já foi entregue e enviada), então "entregues"
 * inclui as lidas e "enviadas" inclui entregues e lidas.
 */
export function summarizeRunStats(byStatus?: Record<string, number>) {
  if (!byStatus) return null;
  const n = (k: string) => byStatus[k] || 0;
  const read = n("READ");
  const delivered = n("DELIVERED") + read;
  const sent = n("SENT") + delivered;
  return {
    pending: n("PENDING") + n("PROCESSING"),
    sent,
    delivered,
    read,
    failed: n("FAILED"),
    cancelled: n("CANCELLED"),
  };
}
