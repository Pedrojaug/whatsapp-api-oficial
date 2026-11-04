import { describe, it, expect } from "vitest";
import { planContactListUpdate } from "../utils/contactListDiff";

const existing = Array.from({ length: 1000 }, (_, i) => ({
  id: `c-${i}`,
  name: `Contato ${i}`,
  phone: `55839${String(90000000 + i)}`,
  variables: ["a", "b"],
}));

describe("planContactListUpdate", () => {
  it("salvar uma lista de 1.000 contatos sem alterar nada não gera nenhum UPDATE", () => {
    // A tela manda a lista inteira de volta, do jeito que recebeu
    const incoming = existing.map((c) => ({ ...c }));
    const plan = planContactListUpdate(existing, incoming);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.toDelete).toHaveLength(0);
  });

  it("só o contato editado, o novo e o removido entram no plano", () => {
    const incoming = existing.slice(1).map((c) => ({ ...c })); // remove c-0
    incoming[0] = { ...incoming[0], name: "Nome novo" };          // edita c-1
    incoming.push({ id: undefined as any, name: "Novo", phone: "83988887777", variables: [] }); // cria

    const plan = planContactListUpdate(existing, incoming);
    expect(plan.toDelete).toEqual(["c-0"]);
    expect(plan.toUpdate.map((u) => u.id)).toEqual(["c-1"]);
    expect(plan.toCreate).toEqual([{ name: "Novo", phone: "5583988887777", variables: [] }]);
  });

  it("nome vazio e variáveis ausentes contam como iguais a null e []", () => {
    const base = [{ id: "x", name: null, phone: "5583988887777", variables: [] }];
    const plan = planContactListUpdate(base, [{ id: "x", name: "", phone: "5583988887777" }]);
    expect(plan.toUpdate).toHaveLength(0);
  });

  it("telefone digitado em outro formato do mesmo número não conta como alteração", () => {
    const base = [{ id: "x", name: null, phone: "5583988887777", variables: [] }];
    const plan = planContactListUpdate(base, [{ id: "x", phone: "83988887777" }]);
    expect(plan.toUpdate).toHaveLength(0);
  });
});
