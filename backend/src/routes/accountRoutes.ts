import { Router, Request, Response } from "express";
import { prisma } from "../db";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth";
import { checkSubscriptionActive, checkAccountLimit } from "../middlewares/planLimits";
import { encryptToken, decryptToken } from "../utils/crypto";
import { metaService } from "../services/metaService";

const router = Router();

router.use(authMiddleware);

// List WABA accounts (owned + shared)
router.get("/accounts", async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;

    const [ownedRaw, shares] = await Promise.all([
      prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
      prisma.accountShare.findMany({
        where: { userId },
        include: { account: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const mask = (acc: any, isShared: boolean) => {
      const raw = decryptToken(acc.accessToken);
      return {
        ...acc,
        accessToken: "[ENCRYPTED]",
        maskedToken: raw ? `${raw.slice(0, 6)}...${raw.slice(-4)}` : "",
        isShared,
      };
    };

    const owned = ownedRaw.map(a => mask(a, false));
    const shared = shares.map(s => mask(s.account, true));

    res.json([...owned, ...shared]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create/Update WABA account (scoped to user)
router.post("/accounts", checkSubscriptionActive, checkAccountLimit, async (req: Request, res: Response) => {
  const { name, wabaId, phoneNumberId, accessToken } = req.body;
  if (!name || !wabaId || !phoneNumberId || !accessToken) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const userId = (req as AuthenticatedRequest).userId!;
    const encryptedToken = encryptToken(accessToken.trim());

    const account = await prisma.account.upsert({
      where: { userId_name: { userId, name } },
      update: { wabaId, phoneNumberId, accessToken: encryptedToken },
      create: { userId, name, wabaId, phoneNumberId, accessToken: encryptedToken },
    });

    const raw = decryptToken(account.accessToken);
    res.status(201).json({
      ...account,
      accessToken: "[ENCRYPTED]",
      maskedToken: raw ? `${raw.slice(0, 6)}...${raw.slice(-4)}` : "",
      isShared: false,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Reveal decrypted token (only owner)
router.get("/accounts/:id/token", async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as AuthenticatedRequest).userId;
  try {
    const account = await prisma.account.findFirst({ where: { id, userId } });
    if (!account) return res.status(403).json({ error: "Acesso negado." });
    const token = decryptToken(account.accessToken);
    if (!token) return res.status(500).json({ error: "Falha ao descriptografar token." });
    res.json({ token });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Validate Meta credentials
router.post("/accounts/verify", async (req: Request, res: Response) => {
  const { wabaId, phoneNumberId, accessToken } = req.body;
  if (!wabaId || !phoneNumberId || !accessToken) {
    return res.status(400).json({ error: "Preencha todos os campos obrigatórios." });
  }

  try {
    await metaService.fetchTemplates(wabaId, accessToken, 1);
    res.json({ success: true, message: "Conexão validada com sucesso!" });
  } catch (error: any) {
    const metaError = error.response?.data?.error;
    let message = "Não foi possível conectar à Meta. Verifique seus dados.";
    if (metaError) {
      if (metaError.code === 190) message = "O Token de Acesso da Meta é inválido ou expirou.";
      else if (metaError.code === 100 || metaError.code === 80004) message = "O WABA ID fornecido é inválido.";
      else message = `Erro da Meta (${metaError.code}): ${metaError.message}`;
    }
    res.status(400).json({ error: message });
  }
});

// Delete account (only owner)
router.delete("/accounts/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({ where: { id, userId } });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado." });
    await prisma.account.delete({ where: { id } });
    res.json({ message: "Account deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Share management ──────────────────────────────────────────────────────────

// List members with access to an account (only owner)
router.get("/accounts/:accountId/shares", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const userId = (req as AuthenticatedRequest).userId;
  try {
    const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) return res.status(403).json({ error: "Apenas o dono da conta pode gerenciar acessos." });

    const shares = await prisma.accountShare.findMany({
      where: { accountId },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
    });
    res.json(shares);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Invite user to account by email (only owner)
router.post("/accounts/:accountId/shares", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { email } = req.body;
  const userId = (req as AuthenticatedRequest).userId;

  if (!email) return res.status(400).json({ error: "E-mail obrigatório." });

  try {
    const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) return res.status(403).json({ error: "Apenas o dono da conta pode convidar membros." });

    const target = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!target) return res.status(404).json({ error: "Nenhum usuário encontrado com esse e-mail." });
    if (target.id === userId) return res.status(400).json({ error: "Você já é o dono desta conta." });

    const share = await prisma.accountShare.upsert({
      where: { accountId_userId: { accountId, userId: target.id } },
      update: {},
      create: { accountId, userId: target.id },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    });
    res.status(201).json(share);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Remove access (only owner)
router.delete("/accounts/:accountId/shares/:shareId", async (req: Request, res: Response) => {
  const { accountId, shareId } = req.params;
  const userId = (req as AuthenticatedRequest).userId;
  try {
    const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) return res.status(403).json({ error: "Apenas o dono da conta pode remover acessos." });

    await prisma.accountShare.delete({ where: { id: shareId } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── SEED DE DEMONSTRAÇÃO / SHOWCASE PARA VÍDEO ─────────────────────────────────
router.post("/accounts/:accountId/seed-showcase", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const userId = (req as AuthenticatedRequest).userId!;

  try {
    const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado." });

    // 1. Atualizar usuário para plano Enterprise ativo
    await prisma.user.update({
      where: { id: userId },
      data: {
        planTier: "enterprise",
        subscriptionStatus: "ACTIVE",
        onboardingCompleted: true,
        maxMonthlyMessages: 100000,
        maxAccounts: 10,
        emailVerified: true
      }
    });

    // 2. Limpar dados anteriores desta conta para evitar duplicatas
    await prisma.message.deleteMany({ where: { accountId } });
    await prisma.campaign.deleteMany({ where: { accountId } });
    await prisma.contactList.deleteMany({ where: { accountId } });
    await prisma.template.deleteMany({ where: { accountId } });
    await prisma.trackedLink.deleteMany({ where: { accountId } });

    // 3. Criar Templates Homologados (Status APPROVED)
    const templates = [
      {
        name: "aviso_promocao_vip",
        category: "MARKETING",
        language: "pt_BR",
        status: "APPROVED",
        metaId: "meta_tpl_98410293",
        components: [
          { type: "HEADER", format: "TEXT", text: "Exclusivo: Oferta VIP Liberada! 🌟" },
          { type: "BODY", text: "Olá, {{1}}! Como você é um de nossos clientes especiais, liberamos {{2}} com frete grátis usando o cupom {{3}}." },
          { type: "BUTTONS", buttons: [{ type: "URL", text: "Acessar Oferta VIP", url: "https://suaempresa.com.br/oferta-vip" }] }
        ]
      },
      {
        name: "recuperacao_carrinho_v2",
        category: "MARKETING",
        language: "pt_BR",
        status: "APPROVED",
        metaId: "meta_tpl_98410294",
        components: [
          { type: "BODY", text: "Oi, {{1}}! Vimos que você deixou o item {{2}} no carrinho. Finalize agora com 15% de desconto especial." },
          { type: "BUTTONS", buttons: [{ type: "URL", text: "Concluir Pedido", url: "https://suaempresa.com.br/carrinho" }] }
        ]
      },
      {
        name: "confirmacao_pedido_oficial",
        category: "UTILITY",
        language: "pt_BR",
        status: "APPROVED",
        metaId: "meta_tpl_98410295",
        components: [
          { type: "BODY", text: "Olá, {{1}}! Seu pedido #{{2}} foi despachado e já está a caminho. Acompanhe a entrega em tempo real." },
          { type: "BUTTONS", buttons: [{ type: "URL", text: "Rastrear Pedido", url: "https://suaempresa.com.br/rastreio" }] }
        ]
      },
      {
        name: "reativacao_inativos_20off",
        category: "MARKETING",
        language: "pt_BR",
        status: "APPROVED",
        metaId: "meta_tpl_98410296",
        components: [
          { type: "BODY", text: "Sentimos sua falta, {{1}}! Preparamos um presente de boas-vindas de volta: 20% OFF em qualquer compra esta semana." }
        ]
      }
    ];

    for (const tpl of templates) {
      await prisma.template.create({
        data: {
          accountId,
          name: tpl.name,
          category: tpl.category,
          language: tpl.language,
          status: tpl.status,
          metaId: tpl.metaId,
          components: tpl.components
        }
      });
    }

    // 4. Criar Listas de Contatos com Segmentações Reais
    const list1 = await prisma.contactList.create({
      data: {
        accountId,
        name: "Clientes VIP - Black Friday (25.000 leads)",
        tags: ["vip", "alto-ticket", "compradores"]
      }
    });

    const list2 = await prisma.contactList.create({
      data: {
        accountId,
        name: "Base Geral de Leads E-commerce (15.000 leads)",
        tags: ["leads", "e-commerce", "campanha-geral"]
      }
    });

    const list3 = await prisma.contactList.create({
      data: {
        accountId,
        name: "Recuperação de Clientes Inativos (8.750 leads)",
        tags: ["inativos", "reativacao", "desconto-20"]
      }
    });

    // Inserir amostras de contatos
    const sampleContacts = [
      { contactListId: list1.id, name: "Carlos Eduardo Silva", phone: "5511998822110", variables: ["Carlos", "VIP Ouro", "VIP20OFF"] },
      { contactListId: list1.id, name: "Mariana Fernandes", phone: "5521987733441", variables: ["Mariana", "VIP Ouro", "VIP20OFF"] },
      { contactListId: list1.id, name: "Roberto Albuquerque", phone: "5531996644552", variables: ["Roberto", "VIP Diamante", "VIP20OFF"] },
      { contactListId: list2.id, name: "Juliana Mendonça", phone: "5541995566773", variables: ["Juliana", "Smartphone Pro", "PROMO15"] },
      { contactListId: list2.id, name: "Lucas Ferreira", phone: "5551994477884", variables: ["Lucas", "Fone Bluetooth", "PROMO15"] },
      { contactListId: list3.id, name: "Beatriz Santos", phone: "5561993388995", variables: ["Beatriz", "Cliente Antigo", "VOLTA20"] },
    ];
    for (const c of sampleContacts) {
      await prisma.contact.create({ data: c });
    }

    // 5. Criar Links Rastreáveis com Métricas Altas
    await prisma.trackedLink.create({
      data: {
        accountId,
        shortCode: "oferta-vip",
        originalUrl: "https://suaempresa.com.br/oferta-vip",
        label: "Campanha VIP 20% OFF",
        clicks: 4850,
        lastClickAt: new Date()
      }
    });
    await prisma.trackedLink.create({
      data: {
        accountId,
        shortCode: "rastreio-expresso",
        originalUrl: "https://suaempresa.com.br/rastreio",
        label: "Notificações de Despacho & Envio",
        clicks: 2410,
        lastClickAt: new Date()
      }
    });
    await prisma.trackedLink.create({
      data: {
        accountId,
        shortCode: "cupom-reativacao",
        originalUrl: "https://suaempresa.com.br/cupom",
        label: "Reativação de Inativos",
        clicks: 1190,
        lastClickAt: new Date()
      }
    });

    // 6. Criar Campanhas Estruturadas
    const camp1 = await prisma.campaign.create({
      data: {
        accountId,
        name: "🚀 Mega Oferta VIP - 20% OFF",
        templateName: "aviso_promocao_vip",
        status: "COMPLETED",
        scheduleType: "ONCE",
        runCount: 1,
        contactListId: list1.id
      }
    });
    await prisma.campaignRun.create({
      data: {
        campaignId: camp1.id,
        status: "FINISHED",
        messagesSent: 24500,
        contactsTotal: 25000,
        startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        finishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000)
      }
    });

    const camp2 = await prisma.campaign.create({
      data: {
        accountId,
        name: "📦 Avisos de Despacho e Rastreio",
        templateName: "confirmacao_pedido_oficial",
        status: "ACTIVE",
        scheduleType: "DAILY",
        scheduleTime: "09:00",
        runCount: 14,
        contactListId: list2.id
      }
    });
    await prisma.campaignRun.create({
      data: {
        campaignId: camp2.id,
        status: "FINISHED",
        messagesSent: 12800,
        contactsTotal: 15000,
        startedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        finishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000)
      }
    });

    const camp3 = await prisma.campaign.create({
      data: {
        accountId,
        name: "🎯 Reativação de Clientes Inativos",
        templateName: "recuperacao_carrinho_v2",
        status: "COMPLETED",
        scheduleType: "ONCE",
        runCount: 1,
        contactListId: list3.id
      }
    });
    await prisma.campaignRun.create({
      data: {
        campaignId: camp3.id,
        status: "FINISHED",
        messagesSent: 8750,
        contactsTotal: 8750,
        startedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        finishedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000 + 20 * 60 * 1000)
      }
    });

    // 7. Gerar 48.750 Mensagens Realistas distribuídas nos últimos 30 dias
    const templateNames = [
      "aviso_promocao_vip",
      "recuperacao_carrinho_v2",
      "confirmacao_pedido_oficial",
      "reativacao_inativos_20off"
    ];

    const messagesToInsert: any[] = [];
    const now = new Date();

    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      const dayDate = new Date(now);
      dayDate.setDate(now.getDate() - dayOffset);

      let dailyTotal = Math.floor(1200 + Math.sin(dayOffset) * 400 + (30 - dayOffset) * 35);
      if (dayOffset === 0) dailyTotal = 2450;
      if (dayOffset === 1) dailyTotal = 3120;

      const readRate = 0.78 + (Math.sin(dayOffset * 2) * 0.05);
      const failRate = 0.003;

      const failedCount = Math.max(1, Math.floor(dailyTotal * failRate));
      const readCount = Math.floor((dailyTotal - failedCount) * readRate);
      const deliveredCount = (dailyTotal - failedCount) - readCount;

      const tplName = templateNames[dayOffset % templateNames.length];

      for (let r = 0; r < readCount; r++) {
        const msgTime = new Date(dayDate);
        msgTime.setHours(Math.floor(8 + Math.random() * 12), Math.floor(Math.random() * 60));
        messagesToInsert.push({
          accountId,
          to: `55119${String(Math.floor(10000000 + Math.random() * 89999999))}`,
          status: "READ",
          direction: "OUTGOING",
          messageType: "TEMPLATE",
          templateName: tplName,
          createdAt: msgTime,
          updatedAt: msgTime
        });
      }

      for (let d = 0; d < deliveredCount; d++) {
        const msgTime = new Date(dayDate);
        msgTime.setHours(Math.floor(8 + Math.random() * 12), Math.floor(Math.random() * 60));
        messagesToInsert.push({
          accountId,
          to: `55119${String(Math.floor(10000000 + Math.random() * 89999999))}`,
          status: "DELIVERED",
          direction: "OUTGOING",
          messageType: "TEMPLATE",
          templateName: tplName,
          createdAt: msgTime,
          updatedAt: msgTime
        });
      }

      for (let f = 0; f < failedCount; f++) {
        const msgTime = new Date(dayDate);
        msgTime.setHours(Math.floor(8 + Math.random() * 12), Math.floor(Math.random() * 60));
        messagesToInsert.push({
          accountId,
          to: `55119${String(Math.floor(10000000 + Math.random() * 89999999))}`,
          status: "FAILED",
          direction: "OUTGOING",
          messageType: "TEMPLATE",
          templateName: tplName,
          errorMessage: "Número de destinatário não existe ou sem WhatsApp",
          createdAt: msgTime,
          updatedAt: msgTime
        });
      }
    }

    // Inserir em lotes de 5.000 para performance ideal no PostgreSQL
    const batchSize = 5000;
    for (let b = 0; b < messagesToInsert.length; b += batchSize) {
      const slice = messagesToInsert.slice(b, b + batchSize);
      await prisma.message.createMany({ data: slice });
    }

    res.json({
      success: true,
      message: "Conta populada com sucesso com dados expressivos para vídeo de showcase!",
      metrics: {
        totalMessages: messagesToInsert.length,
        templatesCount: templates.length,
        listsCount: 3,
        campaignsCount: 3,
        linksCount: 3
      }
    });
  } catch (error: any) {
    console.error("[Seed Showcase] Erro:", error);
    res.status(500).json({ error: error.message || "Erro ao popular dados de demonstração." });
  }
});

export default router;
