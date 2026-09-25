import { Router, Request, Response } from "express";
import { prisma } from "../db";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth";
import { findAccountForUser } from "../utils/accountAccess";

const router = Router();

// Aplica autenticação a todas as rotas de Respostas Rápidas
router.use(authMiddleware);

export const DEFAULT_QUICK_REPLIES = [
  {
    title: "🎁 Oferta Body Splash",
    message: `Obrigada pelo retorno! 💚 💦\n\nFestival de Body Splash 21 a 30/09 | 1 lançamento por dia\n200 ml — à vista ou cartão:\n\n🔥 R$ 75 por R$ 40\n🔥 R$ 72 por R$ 38\n\n🎁 *Incentivos:*\n• R$ 299 ➔ Body Splash 100 ml\n• R$ 400 ➔ Colônia 100 ml\n• R$ 800 ➔ 2 Colônias + Body Splash 200 ml\n\nJá revelados: *Laranja* e *Brisa Verde*.\nAmanhã: *Ternura* 🤫\n\nQuer pedir? Responda *SIM* e encaminhamos você para o atendimento da loja!`
  },
  {
    title: "💳 Chave PIX",
    message: `Perfeito! Segue a nossa chave PIX para pagamento:\n\n🔑 Chave: (84) 99999-9999\nTitular: Magda Perfumaria e Cosméticos\n\nAssim que fizer o envio do comprovante, separamos o seu pedido imediatamente! ✨`
  },
  {
    title: "📍 Endereço & Horários",
    message: `📍 Nossa loja fica localizada no Centro.\n⏰ Horário de atendimento:\nSegunda a Sexta: 08:30 às 18:00\nSábado: 08:30 às 13:00\n\nVenha nos visitar ou peça para entregarmos aí para você!`
  },
  {
    title: "⏳ Pedir um Momento",
    message: `Olá! Já recebi sua mensagem e estou verificando o seu pedido com a nossa equipe. Em minutinhos te dou o retorno completo, tá bem? Obrigado pela paciência! 💚`
  },
  {
    title: "👋 Boas-vindas",
    message: `Olá! Tudo bem? Que bom falar com você! Como posso te ajudar hoje? 😊`
  }
];

// 1. Listar respostas rápidas da conta (com auto-seeding caso o banco esteja vazio)
router.get("/accounts/:accountId/quick-replies", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const userId = (req as AuthenticatedRequest).userId!;

  try {
    const account = await findAccountForUser(accountId, userId);
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado." });

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
    const account = await findAccountForUser(accountId, userId);
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado." });

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
    const account = await findAccountForUser(accountId, userId);
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado." });

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
    const account = await findAccountForUser(accountId, userId);
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado." });

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
    const account = await findAccountForUser(accountId, userId);
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado." });

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
