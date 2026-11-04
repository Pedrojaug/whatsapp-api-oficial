import { normalizePhone } from "../services/phoneService";

export interface ExistingContact {
  id: string;
  name: string | null;
  phone: string;
  variables: unknown;
}

export interface IncomingContact {
  id?: string;
  name?: string | null;
  phone: string;
  variables?: unknown;
}

export interface ContactRow {
  name: string | null;
  phone: string;
  variables: unknown[];
}

function toRow(c: IncomingContact): ContactRow {
  return {
    name: c.name || null,
    phone: normalizePhone(c.phone),
    variables: Array.isArray(c.variables) ? c.variables : [],
  };
}

function sameRow(a: ExistingContact, b: ContactRow) {
  return (
    (a.name || null) === b.name &&
    a.phone === b.phone &&
    JSON.stringify(Array.isArray(a.variables) ? a.variables : []) === JSON.stringify(b.variables)
  );
}

/**
 * Compara a lista salva com a enviada pela tela e devolve só o que mudou.
 * A tela de edição manda a lista inteira a cada salvamento; antes, cada contato
 * existente virava um UPDATE individual (1.000 contatos = 1.000 idas ao banco,
 * com o Render em Oregon e o Neon em São Paulo), mesmo sem nenhuma alteração.
 */
export function planContactListUpdate(existing: ExistingContact[], incoming: IncomingContact[]) {
  const byId = new Map(existing.map((c) => [c.id, c]));
  const keptIds = new Set<string>();
  const toCreate: ContactRow[] = [];
  const toUpdate: Array<{ id: string; data: ContactRow }> = [];

  for (const c of incoming) {
    const row = toRow(c);
    const current = c.id ? byId.get(c.id) : undefined;
    if (!current) {
      // Sem id, ou com id que não pertence a esta lista: cria um novo contato
      toCreate.push(row);
      continue;
    }
    keptIds.add(current.id);
    if (!sameRow(current, row)) toUpdate.push({ id: current.id, data: row });
  }

  const toDelete = existing.filter((c) => !keptIds.has(c.id)).map((c) => c.id);
  return { toCreate, toUpdate, toDelete };
}
