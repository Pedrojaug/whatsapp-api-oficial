import { Router, Request, Response } from "express";
import { prisma } from "../db";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth";
import { findAccountForUser, getAccountWithPermission } from "../utils/accountAccess";

const router = Router();

// Aplica autenticação a todas as rotas de Respostas Rápidas
router.use(authMiddleware);

// Padrões neutros semeados em toda conta nova. Nunca coloque aqui conteúdo de um cliente
// (ofertas, chave PIX, endereço): o produto é multi-tenant e isto vai para todas as contas.
export const DEFAULT_QUICK_REPLIES = [
  {
    title: "👋 Boas-vindas",
    message: `Olá! Tudo bem? Que bom falar com você! Como posso te ajudar hoje? 😊`
  },
  {
    title: "⏳ Pedir um momento",
    message: `Recebi sua mensagem e já estou verificando. Em alguns minutos te dou o retorno completo, tá bem? Obrigado pela paciência!`
  },
  {
    title: "💳 Chave PIX",
    message: `Segue nossa chave PIX para pagamento:\n\n🔑 Chave: [sua chave PIX]\nTitular: [nome do titular]\n\nAssim que receber o comprovante, damos andamento ao seu pedido.`
  },
  {
    title: "📍 Endereço e horários",
    message: `📍 Endereço: [seu endereço]\n⏰ Horário de atendimento:\nSegunda a sexta: [horário]\nSábado: [horário]`
  },
  {
    title: "🙏 Encerramento",
    message: `Obrigado pelo contato! Se precisar de mais alguma coisa, é só chamar por aqui.`
  }
];

// 1. Listar respostas rápidas da conta (com auto-seeding caso o banco esteja vazio)
router.get("/accounts/:accountId/quick-replies", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const userId = (req as AuthenticatedRequest).userId!;

  try {
    const account = await getAccountWithPermission(res, accountId, userId, "view");
    if (!account) return;

    let replies = await prisma.quickReply.findMany({
      where: { accountId },
      orderBy: { createdAt: "asc" }
    });

    // Se for o primeiro acesso da conta e o banco estiver vazio, semeia os padrões
    if (replies.length === 0) {
      await prisma.quickReply.createMany({
        data: DEFAULT_QUICK_REPLIES.map(item => ({
          title: item.title,
          message: item.message,
          accountId
        }))
      });

      replies = await prisma.quickReply.findMany({
        where: { accountId },
        orderBy: { createdAt: "asc" }
      });
    }

    // Compatibilidade dupla: expõe tanto .message quanto .text
    const formatted = replies.map(r => ({
      id: r.id,
      title: r.title,
      message: r.message,
      text: r.message,
      accountId: r.accountId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));

    res.json(formatted);
  } catch (error: any) {
    console.error("Erro ao listar respostas rápidas:", error);
    res.status(500).json({ error: error.message || "Erro interno ao listar respostas rápidas." });
  }
});

// 2. Criar nova resposta rápida
router.post("/accounts/:accountId/quick-replies", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const userId = (req as AuthenticatedRequest).userId!;
  const { title, message, text } = req.body;

  const content = (message || text || "").trim();
  const trimmedTitle = (title || "").trim();

  if (!trimmedTitle || !content) {
    return res.status(400).json({ error: "Título e mensagem são obrigatórios." });
  }

  try {
    const account = await getAccountWithPermission(res, accountId, userId, "chat");
    if (!account) return;

    const created = await prisma.quickReply.create({
      data: {
        title: trimmedTitle,
        message: content,
        accountId
      }
    });

    res.status(201).json({
      id: created.id,
      title: created.title,
      message: created.message,
      text: created.message,
      accountId: created.accountId,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt
    });
  } catch (error: any) {
    console.error("Erro ao criar resposta rápida:", error);
    res.status(500).json({ error: error.message || "Erro interno ao criar resposta rápida." });
  }
});

// 3. Atualizar resposta rápida existente
router.put("/accounts/:accountId/quick-replies/:id", async (req: Request, res: Response) => {
  const { accountId, id } = req.params;
  const userId = (req as AuthenticatedRequest).userId!;
  const { title, message, text } = req.body;

  const content = (message !== undefined ? message : text !== undefined ? text : "").trim();
  const trimmedTitle = (title || "").trim();

  if (!trimmedTitle || !content) {
    return res.status(400).json({ error: "Título e mensagem são obrigatórios." });
  }

  try {
    const account = await getAccountWithPermission(res, accountId, userId, "chat");
    if (!account) return;

    const existing = await prisma.quickReply.findFirst({
      where: { id, accountId }
    });
    if (!existing) return res.status(404).json({ error: "Resposta rápida não encontrada." });

    const updated = await prisma.quickReply.update({
      where: { id },
      data: {
        title: trimmedTitle,
        message: content
      }
    });

    res.json({
      id: updated.id,
      title: updated.title,
      message: updated.message,
      text: updated.message,
      accountId: updated.accountId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    });
  } catch (error: any) {
    console.error("Erro ao atualizar resposta rápida:", error);
    res.status(500).json({ error: error.message || "Erro interno ao atualizar resposta rápida." });
  }
});

// 4. Excluir resposta rápida
router.delete("/accounts/:accountId/quick-replies/:id", async (req: Request, res: Response) => {
  const { accountId, id } = req.params;
  const userId = (req as AuthenticatedRequest).userId!;

  try {
    const account = await getAccountWithPermission(res, accountId, userId, "chat");
    if (!account) return;

    const existing = await prisma.quickReply.findFirst({
      where: { id, accountId }
    });
    if (!existing) return res.status(404).json({ error: "Resposta rápida não encontrada." });

    await prisma.quickReply.delete({
      where: { id }
    });

    res.json({ success: true, message: "Resposta rápida excluída com sucesso." });
  } catch (error: any) {
    console.error("Erro ao excluir resposta rápida:", error);
    res.status(500).json({ error: error.message || "Erro interno ao excluir resposta rápida." });
  }
});

// 5. Restaurar respostas rápidas para o padrão
router.post("/accounts/:accountId/quick-replies/reset-defaults", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const userId = (req as AuthenticatedRequest).userId!;

  try {
    const account = await getAccountWithPermission(res, accountId, userId, "chat");
    if (!account) return;

    await prisma.quickReply.deleteMany({
      where: { accountId }
    });

    await prisma.quickReply.createMany({
      data: DEFAULT_QUICK_REPLIES.map(item => ({
        title: item.title,
        message: item.message,
        accountId
      }))
    });

    const replies = await prisma.quickReply.findMany({
      where: { accountId },
      orderBy: { createdAt: "asc" }
    });

    const formatted = replies.map(r => ({
      id: r.id,
      title: r.title,
      message: r.message,
      text: r.message,
      accountId: r.accountId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));

    res.json(formatted);
  } catch (error: any) {
    console.error("Erro ao restaurar respostas rápidas:", error);
    res.status(500).json({ error: error.message || "Erro interno ao restaurar respostas rápidas." });
  }
});

export default router;
