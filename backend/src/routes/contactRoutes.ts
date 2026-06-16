import { Router, Request, Response } from "express";
import { prisma } from "../db";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

// Aplica autenticação a todas as rotas de listas/contatos
router.use(authMiddleware);

// Listar listas de contatos (scoped to user)
router.get("/accounts/:accountId/lists", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado" });

    const lists = await prisma.contactList.findMany({
      where: { accountId },
      include: {
        _count: {
          select: { contacts: true }
        }
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(lists);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obter detalhes de uma lista de contatos (e seus contatos) (scoped to user)
router.get("/accounts/:accountId/lists/:listId", async (req: Request, res: Response) => {
  const { accountId, listId } = req.params;
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado" });

    const list = await prisma.contactList.findFirst({
      where: { id: listId, accountId },
      include: {
        contacts: {
          orderBy: { createdAt: "desc" }
        }
      }
    });
    if (!list) {
      return res.status(404).json({ error: "Lista não encontrada" });
    }
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Criar lista e importar contatos (scoped to user)
router.post("/accounts/:accountId/lists", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { name, contacts } = req.body; // contacts: Array<{ name?: string, phone: string, variables?: string[] }>

  if (!name || !contacts || !Array.isArray(contacts)) {
    return res.status(400).json({ error: "Nome da lista e contatos são obrigatórios." });
  }

  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado" });

    // Criar a lista de contatos
    const list = await prisma.contactList.create({
      data: {
        accountId,
        name,
      }
    });

    // Inserir contatos em lote
    if (contacts.length > 0) {
      await prisma.contact.createMany({
        data: contacts.map(c => ({
          contactListId: list.id,
          name: c.name || null,
          phone: c.phone.trim().replace(/\D/g, ""), // Limpar telefone
          variables: c.variables || [],
        }))
      });
    }

    // Retorna a lista com a contagem de contatos
    const createdList = await prisma.contactList.findUnique({
      where: { id: list.id },
      include: {
        _count: {
          select: { contacts: true }
        }
      }
    });

    res.status(201).json(createdList);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Excluir lista de contatos (scoped to user)
router.delete("/accounts/:accountId/lists/:listId", async (req: Request, res: Response) => {
  const { accountId, listId } = req.params;
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado" });

    const list = await prisma.contactList.findFirst({
      where: { id: listId, accountId }
    });
    if (!list) return res.status(404).json({ error: "Lista de contatos não encontrada" });

    await prisma.contactList.delete({
      where: { id: listId }
    });
    res.json({ success: true, message: "Lista excluída com sucesso." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Editar lista e gerenciar seus contatos (scoped to user)
router.put("/accounts/:accountId/lists/:listId", async (req: Request, res: Response) => {
  const { accountId, listId } = req.params;
  const { name, contacts } = req.body; // contacts: Array<{ id?: string, name?: string, phone: string, variables?: string[] }>

  if (!name || !contacts || !Array.isArray(contacts)) {
    return res.status(400).json({ error: "Nome da lista e contatos são obrigatórios." });
  }

  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado" });

    const list = await prisma.contactList.findFirst({
      where: { id: listId, accountId }
    });
    if (!list) return res.status(404).json({ error: "Lista não encontrada" });

    // Atualizar nome da lista
    await prisma.contactList.update({
      where: { id: listId },
      data: { name }
    });

    const existingContacts = await prisma.contact.findMany({
      where: { contactListId: listId }
    });
    const existingIds = existingContacts.map(c => c.id);

    const incomingIds = contacts.map(c => c.id).filter(Boolean) as string[];
    const idsToDelete = existingIds.filter(id => !incomingIds.includes(id));

    // Excluir contatos removidos
    if (idsToDelete.length > 0) {
      await prisma.contact.deleteMany({
        where: { id: { in: idsToDelete } }
      });
    }

    // Criar novos contatos (sem id)
    const contactsToCreate = contacts.filter(c => !c.id);
    if (contactsToCreate.length > 0) {
      await prisma.contact.createMany({
        data: contactsToCreate.map(c => ({
          contactListId: listId,
          name: c.name || null,
          phone: c.phone.trim().replace(/\D/g, ""),
          variables: c.variables || [],
        }))
      });
    }

    // Atualizar contatos existentes modificados
    const contactsToUpdate = contacts.filter(c => c.id && existingIds.includes(c.id));
    for (const c of contactsToUpdate) {
      await prisma.contact.update({
        where: { id: c.id },
        data: {
          name: c.name || null,
          phone: c.phone.trim().replace(/\D/g, ""),
          variables: c.variables || [],
        }
      });
    }

    // Retornar lista atualizada com contagem de contatos
    const updatedList = await prisma.contactList.findUnique({
      where: { id: listId },
      include: {
        _count: {
          select: { contacts: true }
        }
      }
    });

    res.json(updatedList);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Disparo em lote para uma lista (scoped to user)
router.post("/accounts/:accountId/lists/:listId/send", async (req: Request, res: Response) => {
  const { accountId, listId } = req.params;
  const { templateName, variables, mediaUrl, scheduledAt } = req.body;

  if (!templateName) {
    return res.status(400).json({ error: "Template é obrigatório." });
  }

  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado." });

    const list = await prisma.contactList.findFirst({
      where: { id: listId, accountId },
      include: { contacts: true }
    });
    if (!list) {
      return res.status(404).json({ error: "Lista de contatos não encontrada." });
    }

    const scheduledAtDate = scheduledAt ? new Date(scheduledAt) : null;

    const messagesData = list.contacts.map(contact => {
      const resolvedVars = variables.map((v: string) => {
        if (v === "CONTACT_NAME") return contact.name || "";
        if (v === "CONTACT_PHONE") return contact.phone;
        if (v.startsWith("CONTACT_VAR_")) {
          const idx = parseInt(v.replace("CONTACT_VAR_", "")) - 1;
          const contactVars = contact.variables as string[];
          return (contactVars && contactVars[idx]) || "";
        }
        return v;
      });

      return {
        accountId,
        to: contact.phone,
        templateName,
        variables: resolvedVars ? { variables: resolvedVars, mediaUrl } : (mediaUrl ? { mediaUrl } : {}),
        status: "PENDING",
        scheduledAt: scheduledAtDate
      };
    });

    // Gravar no banco de dados como PENDING para o worker assíncrono processar
    await prisma.message.createMany({
      data: messagesData
    });

    res.json({
      success: true,
      message: scheduledAtDate
        ? `Disparo em lote agendado com sucesso para ${list.contacts.length} contatos para ${scheduledAtDate.toLocaleString()}.`
        : `Disparo em lote enfileirado com sucesso para ${list.contacts.length} contatos.`
    });
  } catch (error: any) {
    console.error("Erro no disparo em lote:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
