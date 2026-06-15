import { Router, Request, Response } from "express";
import axios from "axios";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { prisma } from "../db";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth";
import { encryptToken, decryptToken } from "../utils/crypto";
import { messageEventEmitter } from "../utils/emitter";

const router = Router();

// Middleware de autenticação para todas as rotas exceto webhooks e rotas internas do n8n
router.use((req, res, next) => {
  if (req.path === "/webhooks" || req.path.startsWith("/webhooks")) {
    return next();
  }
  if (req.path.startsWith("/n8n/")) {
    return next();
  }
  return authMiddleware(req as AuthenticatedRequest, res, next);
});

// ==========================================
// ROTAS INTERNAS N8N (sem JWT, acesso por meta_token)
// ==========================================

// Proxy de mídia Meta para o n8n baixar arquivos de mídia
router.get("/n8n/media/:mediaId", async (req: Request, res: Response) => {
  const { mediaId } = req.params;
  const metaToken = req.query.meta_token as string;
  if (!metaToken || !mediaId) {
    return res.status(400).json({ error: "meta_token e mediaId são obrigatórios" });
  }
  try {
    const metaRes = await axios.get(`https://graph.facebook.com/v19.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${metaToken}` },
    });
    const mediaUrl: string = metaRes.data.url;
    const mimeType: string = metaRes.data.mime_type || "application/octet-stream";
    const mediaContent = await axios.get(mediaUrl, {
      headers: { Authorization: `Bearer ${metaToken}` },
      responseType: "stream",
    });
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "private, max-age=300");
    mediaContent.data.pipe(res);
  } catch (error: any) {
    console.error("[N8N Media Proxy] Erro:", error.response?.data || error.message);
    res.status(500).json({ error: "Erro ao baixar mídia da Meta" });
  }
});

// Envio de mensagem de texto via Meta API para o n8n responder ao lead
router.post("/n8n/send", async (req: Request, res: Response) => {
  const { phone_number_id, to, body: msgBody, meta_token } = req.body;
  if (!phone_number_id || !to || !msgBody || !meta_token) {
    return res.status(400).json({ error: "phone_number_id, to, body e meta_token são obrigatórios" });
  }
  try {
    const metaRes = await axios.post(
      `https://graph.facebook.com/v19.0/${phone_number_id}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: msgBody },
      },
      { headers: { Authorization: `Bearer ${meta_token}`, "Content-Type": "application/json" } }
    );
    res.json({ success: true, wamid: metaRes.data?.messages?.[0]?.id });
  } catch (error: any) {
    console.error("[N8N Send] Erro:", error.response?.data || error.message);
    res.status(500).json({ error: "Erro ao enviar mensagem via Meta API" });
  }
});

// ==========================================
// ACCOUNTS ROUTES
// ==========================================

// List WABA accounts (scoped to user)
router.get("/accounts", async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const accounts = await prisma.account.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    
    // Decriptar os tokens para compatibilidade com o frontend
    const decryptedAccounts = accounts.map(acc => ({
      ...acc,
      accessToken: decryptToken(acc.accessToken)
    }));

    res.json(decryptedAccounts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create/Update WABA account (scoped to user)
router.post("/accounts", async (req: Request, res: Response) => {
  const { name, wabaId, phoneNumberId, accessToken } = req.body;
  if (!name || !wabaId || !phoneNumberId || !accessToken) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const userId = (req as AuthenticatedRequest).userId!;
    const encryptedToken = encryptToken(accessToken.trim());

    const account = await prisma.account.upsert({
      where: {
        userId_name: {
          userId,
          name,
        },
      },
      update: { wabaId, phoneNumberId, accessToken: encryptedToken },
      create: { userId, name, wabaId, phoneNumberId, accessToken: encryptedToken },
    });

    res.status(201).json({
      ...account,
      accessToken: decryptToken(account.accessToken)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Valida as credenciais da Meta antes de salvar
router.post("/accounts/verify", async (req: Request, res: Response) => {
  const { wabaId, phoneNumberId, accessToken } = req.body;
  if (!wabaId || !phoneNumberId || !accessToken) {
    return res.status(400).json({ error: "Preencha todos os campos obrigatórios." });
  }

  try {
    // Fazer uma chamada simples de validação na Meta buscando templates com limit=1
    await axios.get(
      `https://graph.facebook.com/v19.0/${wabaId}/message_templates?limit=1`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    res.json({ success: true, message: "Conexão validada com sucesso!" });
  } catch (error: any) {
    console.error("Erro de validação Meta:", error.response?.data || error.message);
    const metaError = error.response?.data?.error;
    let message = "Não foi possível conectar à Meta. Verifique seus dados.";

    if (metaError) {
      if (metaError.code === 190) {
        message = "O Token de Acesso da Meta é inválido ou expirou. Por favor, insira um token válido.";
      } else if (metaError.code === 100 || metaError.code === 80004) {
        message = "O WABA ID fornecido é inválido. Verifique o ID no painel da Meta.";
      } else {
        message = `Erro da Meta (${metaError.code}): ${metaError.message}`;
      }
    }

    res.status(400).json({ error: message });
  }
});

// Delete account (scoped and authorized to user)
router.delete("/accounts/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id, userId }
    });
    if (!account) {
      return res.status(404).json({ error: "Conta não encontrada ou acesso negado." });
    }
    await prisma.account.delete({ where: { id } });
    res.json({ message: "Account deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// TEMPLATES ROUTES
// ==========================================

// Sincronizar e listar templates da Meta para uma conta (scoped to user)
router.get("/accounts/:accountId/templates", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const sync = req.query.sync === "true";
  
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Account not found or access denied" });

    // Buscar templates direto da Meta apenas se sync=true
    if (sync) {
      try {
        const decryptedToken = decryptToken(account.accessToken);
        const response = await axios.get(
          `https://graph.facebook.com/v19.0/${account.wabaId}/message_templates`,
          {
            headers: { Authorization: `Bearer ${decryptedToken}` },
          }
        );

        const META_DEFAULT_TEMPLATES = ["hello_world", "sample_issue_resolution", "sample_shipping_confirmation", "sample_movie_ticket_confirmation", "sample_flight_confirmation", "sample_purchase_feedback", "sample_happy_hour_announcement", "sample_business_updates"];
        const metaTemplates = (response.data.data as any[]).filter(
          (t) => !META_DEFAULT_TEMPLATES.includes(t.name) && !t.name.startsWith("sample_")
        );

        // Remover templates padrão já importados anteriormente
        await prisma.template.deleteMany({
          where: {
            accountId,
            OR: [
              { name: { in: META_DEFAULT_TEMPLATES } },
              { name: { startsWith: "sample_" } },
              { name: "hello_world" },
            ],
          },
        });

        // Upsert templates locais
        for (const t of metaTemplates) {
          await prisma.template.upsert({
            where: {
              accountId_name: {
                accountId,
                name: t.name,
              },
            },
            update: {
              metaId: t.id,
              status: t.status,
              language: t.language,
              category: t.category,
              components: t.components || [],
            },
            create: {
              accountId,
              name: t.name,
              metaId: t.id,
              status: t.status,
              language: t.language,
              category: t.category,
              components: t.components || [],
            },
          });
        }
      } catch (metaError: any) {
        console.error("Erro ao puxar da Meta:", metaError.response?.data || metaError.message);
      }
    }

    // Retornar da base local
    const templates = await prisma.template.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
    });

    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Criar template local e enviar para a Meta (scoped to user)
router.post("/accounts/:accountId/templates", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { name, language, category, components } = req.body;

  if (!name || !category || !components) {
    return res.status(400).json({ error: "Missing name, category, or components" });
  }

  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Account not found" });

    // 1. Criar no banco local como PENDING
    const localTemplate = await prisma.template.upsert({
      where: { accountId_name: { accountId, name } },
      update: {
        language: language || "pt_BR",
        category,
        components,
        status: "PENDING",
      },
      create: {
        accountId,
        name,
        language: language || "pt_BR",
        category,
        components,
        status: "PENDING",
      },
    });

    // 2. Enviar para a Meta
    try {
      const decryptedToken = decryptToken(account.accessToken);
      const response = await axios.post(
        `https://graph.facebook.com/v19.0/${account.wabaId}/message_templates`,
        {
          name,
          category,
          language: language || "pt_BR",
          components,
        },
        {
          headers: { Authorization: `Bearer ${decryptedToken}` },
        }
      );

      // Meta retorna o ID do template criado
      const metaId = response.data.id;

      // 3. Atualiza com o ID da Meta no banco
      const updatedTemplate = await prisma.template.update({
        where: { id: localTemplate.id },
        data: { metaId },
      });

      res.status(201).json(updatedTemplate);
    } catch (metaError: any) {
      const fullError = metaError.response?.data;
      console.error("Meta API Template Error (full):", JSON.stringify(fullError, null, 2));
      const metaErr = fullError?.error;
      const friendlyError = translateMetaTemplateError(metaErr);
      res.status(400).json({
        error: friendlyError,
        details: metaErr || metaError.message,
        full: fullError,
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Salvar template como rascunho (sem enviar para a Meta)
router.post("/accounts/:accountId/templates/draft", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { name, language, category, components } = req.body;

  if (!name || !category || !components) {
    return res.status(400).json({ error: "Missing name, category, or components" });
  }

  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) return res.status(404).json({ error: "Account not found" });

    const templateNameFormatted = name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

    const draft = await prisma.template.upsert({
      where: { accountId_name: { accountId, name: templateNameFormatted } },
      update: { language: language || "pt_BR", category, components, status: "DRAFT" },
      create: { accountId, name: templateNameFormatted, language: language || "pt_BR", category, components, status: "DRAFT" },
    });

    res.status(201).json(draft);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

function translateMetaTemplateError(metaErr: any): string {
  if (!metaErr) return "Erro desconhecido ao criar template na Meta.";
  const code = metaErr.code;
  const msg: string = metaErr.message || "";

  if (code === 100) {
    if (msg.includes("header_handle")) return "Arquivo de exemplo inválido ou expirado. Faça o upload novamente.";
    if (msg.includes("name")) return "Nome do template inválido. Use apenas letras minúsculas, números e underscore.";
    if (msg.includes("url")) return "URL do botão inválida. Use uma URL completa com https://.";
    if (msg.includes("example")) return "Campo 'example' inválido. Verifique os exemplos de variáveis.";
    if (msg.includes("category")) return "Categoria inválida para este tipo de template.";
    return `Parâmetro inválido: ${msg}`;
  }
  if (code === 80004) return "Limite de templates atingido para esta conta.";
  if (code === 368) return "Conta temporariamente bloqueada pela Meta. Tente mais tarde.";
  if (code === 2388114) return "Template com este nome já existe. Escolha outro nome.";
  if (code === 2388076) return "Conteúdo do template rejeitado pela política da Meta.";
  if (msg.includes("already exists")) return "Já existe um template com esse nome. Escolha outro nome.";
  if (msg.includes("permission")) return "Token sem permissão para criar templates. Verifique as permissões do System User.";
  return `Erro Meta (${code}): ${msg}`;
}

// Upload de arquivo de exemplo para obter o header_handle da Meta (scoped to user)
router.post("/accounts/:accountId/templates/upload-sample", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { fileName, fileType, fileBase64 } = req.body;

  if (!fileName || !fileType || !fileBase64) {
    return res.status(400).json({ error: "Missing fileName, fileType, or fileBase64" });
  }

  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Account not found" });

    const decryptedToken = decryptToken(account.accessToken);

    // 1. Usar o App ID configurado no servidor
    const appId = process.env.FACEBOOK_APP_ID;
    if (!appId) {
      return res.status(500).json({ error: "FACEBOOK_APP_ID não configurado no servidor." });
    }

    // Converter base64 para Buffer
    const base64Data = fileBase64.replace(/^data:.*?;base64,/, "");
    const fileBuffer = Buffer.from(base64Data, "base64");

    // 2. Iniciar a sessão de upload na Meta
    const sessionResponse = await axios.post(
      `https://graph.facebook.com/v19.0/${appId}/uploads`,
      null,
      {
        params: {
          file_name: fileName,
          file_length: fileBuffer.length,
          file_type: fileType,
          access_token: decryptedToken,
        },
      }
    );
    const uploadSessionId = sessionResponse.data.id;

    // 3. Fazer o upload do buffer binário
    const uploadResponse = await axios.post(
      `https://graph.facebook.com/v19.0/${uploadSessionId}`,
      fileBuffer,
      {
        headers: {
          Authorization: `Bearer ${decryptedToken}`,
          "Content-Type": "application/octet-stream",
        },
      }
    );

    const headerHandle = uploadResponse.data.h;
    res.json({ headerHandle });
  } catch (error: any) {
    console.error("Erro no upload de sample para a Meta:", error.response?.data || error.message);
    const details = error.response?.data?.error?.message || error.message;
    res.status(400).json({ error: "Falha ao enviar arquivo de exemplo para a Meta.", details });
  }
});

// Excluir template local e na Meta (scoped to user)
router.delete("/accounts/:accountId/templates/:templateId", async (req: Request, res: Response) => {
  const { accountId, templateId } = req.params;
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado" });

    const template = await prisma.template.findFirst({
      where: { id: templateId, accountId }
    });
    if (!template) return res.status(404).json({ error: "Template não encontrado" });

    // Se o template tem ID da Meta, deleta na Meta
    if (template.metaId) {
      try {
        const decryptedToken = decryptToken(account.accessToken);
        await axios.delete(
          `https://graph.facebook.com/v19.0/${account.wabaId}/message_templates`,
          {
            params: {
              hsm_id: template.metaId,
              name: template.name,
            },
            headers: { Authorization: `Bearer ${decryptedToken}` },
          }
        );
      } catch (metaError: any) {
        console.error("Erro ao deletar template na Meta:", metaError.response?.data || metaError.message);
      }
    }

    // Deleta localmente
    await prisma.template.delete({ where: { id: templateId } });
    res.json({ success: true, message: "Template excluído com sucesso." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// CONTACT LISTS ROUTES
// ==========================================

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

    const template = await prisma.template.findFirst({
      where: { accountId, name: templateName }
    });
    const templateComponents = template?.components as any[];
    const headerComp = templateComponents && Array.isArray(templateComponents)
      ? templateComponents.find((c: any) => c.type === "HEADER")
      : null;

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

// ==========================================
// MESSAGES ROUTES
// ==========================================

// Enviar mensagem via Template (scoped to user)
router.post("/accounts/:accountId/messages/send", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { to, templateName, language, variables, mediaUrl, scheduledAt } = req.body;

  if (!to || !templateName) {
    return res.status(400).json({ error: "Destinatário (to) e Template são obrigatórios." });
  }

  const sanitizedTo = to.trim().replace(/\D/g, "");
  if (sanitizedTo.length < 8) {
    return res.status(400).json({ error: "Número de telefone destinatário inválido." });
  }

  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada." });

    const template = await prisma.template.findFirst({
      where: { accountId, name: templateName },
    });

    const scheduledAtDate = scheduledAt ? new Date(scheduledAt) : null;
    const isFutureScheduled = scheduledAtDate && scheduledAtDate.getTime() > Date.now();

    // Criar o log no banco local como PENDING
    const dbMessage = await prisma.message.create({
      data: {
        accountId,
        to: sanitizedTo,
        templateName,
        variables: variables ? { variables, mediaUrl } : (mediaUrl ? { mediaUrl } : {}),
        status: "PENDING",
        scheduledAt: scheduledAtDate,
      },
    });

    // Se a mensagem está agendada para o futuro, o dispatcher vai processá-la depois
    if (isFutureScheduled) {
      return res.status(201).json({
        ...dbMessage,
        message: "Mensagem agendada com sucesso para envio posterior."
      });
    }

    // Marcar como PROCESSING para o dispatcher não pegar antes de terminar o envio direto
    await prisma.message.update({
      where: { id: dbMessage.id },
      data: { status: "PROCESSING" },
    });

    const components: any[] = [];

    // 1. Processar cabeçalho de mídia se necessário
    const templateComponents = template?.components as any[];
    const headerComp = templateComponents && Array.isArray(templateComponents)
      ? templateComponents.find((c: any) => c.type === "HEADER")
      : null;

    const bodyComp = templateComponents && Array.isArray(templateComponents)
      ? templateComponents.find((c: any) => c.type === "BODY")
      : null;

    // Reconstruir corpo do template para persistência de histórico
    let reconstructedBody: string | null = null;
    if (bodyComp && bodyComp.text) {
      reconstructedBody = bodyComp.text;
      const resolvedVars = variables || [];
      if (Array.isArray(resolvedVars)) {
        resolvedVars.forEach((val: any, idx: number) => {
          reconstructedBody = reconstructedBody!.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'), String(val));
        });
      }
    }

    if (headerComp && ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerComp.format) && mediaUrl) {
      const typeLower = headerComp.format.toLowerCase();
      components.push({
        type: "header",
        parameters: [
          {
            type: typeLower,
            [typeLower]: {
              link: mediaUrl,
              ...(typeLower === "document" ? { filename: mediaUrl.split("/").pop() || "document.pdf" } : {})
            }
          }
        ]
      });
    }

    // 2. Processar variáveis do corpo
    if (variables && Array.isArray(variables) && variables.length > 0) {
      components.push({
        type: "body",
        parameters: variables.map((v: any) => ({
          type: "text",
          text: String(v),
        })),
      });
    }

    try {
      const decryptedToken = decryptToken(account.accessToken);
      const response = await axios.post(
        `https://graph.facebook.com/v19.0/${account.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to: sanitizedTo,
          type: "template",
          template: {
            name: templateName,
            language: {
              code: language || template?.language || "pt_BR",
            },
            ...(components.length > 0 ? { components } : {}),
          },
        },
        {
          headers: { Authorization: `Bearer ${decryptedToken}` },
        }
      );

      const wamid = response.data.messages?.[0]?.id;

      // Atualizar status para SENT
      const updatedMessage = await prisma.message.update({
        where: { id: dbMessage.id },
        data: {
          wamid,
          status: "SENT",
          body: reconstructedBody,
        },
      });

      res.json(updatedMessage);
    } catch (metaError: any) {
      console.error("Meta API Message Error:", metaError.response?.data || metaError.message);
      
      const errMsg = metaError.response?.data?.error?.message || metaError.message;
      await prisma.message.update({
        where: { id: dbMessage.id },
        data: {
          status: "PENDING",
          errorMessage: errMsg,
          nextRetryAt: new Date(Date.now() + 60_000),
        },
      });

      res.status(400).json({
        error: "Erro da API da Meta ao enviar mensagem",
        details: metaError.response?.data || metaError.message,
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// List messages logs (scoped to user) with filters and pagination
router.get("/accounts/:accountId/messages", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { search, status, templateName, page = "1", limit = "50" } = req.query;

  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado" });

    const p = parseInt(page as string) || 1;
    const l = parseInt(limit as string) || 50;
    const skip = (p - 1) * l;

    const whereClause: any = {
      accountId,
    };

    if (status) {
      whereClause.status = status as string;
    }

    if (templateName) {
      whereClause.templateName = templateName as string;
    }

    if (search) {
      whereClause.OR = [
        { to: { contains: search as string } },
        { templateName: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const [messages, total] = await prisma.$transaction([
      prisma.message.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip,
        take: l,
      }),
      prisma.message.count({
        where: whereClause,
      }),
    ]);

    res.json({
      messages,
      total,
      page: p,
      limit: l,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// SSE events route to stream real-time updates for messages (scoped to user)
router.get("/accounts/:accountId/messages/events", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const userId = (req as AuthenticatedRequest).userId;

  try {
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado" });

    // Configurar cabeçalhos para Server-Sent Events (SSE)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders(); // Envia os cabeçalhos imediatamente

    // Enviar mensagem de conexão estabelecida
    res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

    // Heartbeat periódico (evita timeout de proxies/Load Balancers como Render/Cloudflare)
    const keepAliveInterval = setInterval(() => {
      res.write(":\n\n"); // SSE comment frame
    }, 20000);

    const onMessageUpdated = (data: any) => {
      if (data.accountId === accountId) {
        res.write(`data: ${JSON.stringify({ type: "messageUpdated", ...data })}\n\n`);
      }
    };

    messageEventEmitter.on("messageUpdated", onMessageUpdated);

    // Limpar listener quando a conexão fechar
    req.on("close", () => {
      clearInterval(keepAliveInterval);
      messageEventEmitter.off("messageUpdated", onMessageUpdated);
    });

  } catch (error: any) {
    console.error("Erro no SSE de mensagens:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// Obter métricas filtradas por período (scoped to user)
router.get("/accounts/:accountId/metrics", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { period, startDate: queryStart, endDate: queryEnd } = req.query;

  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado" });

    const start = new Date();
    const end = new Date();

    if (period === "today") {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (period === "yesterday") {
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (period === "7days") {
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (period === "30days") {
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (period === "custom" && queryStart) {
      const parsedStart = new Date(queryStart as string);
      parsedStart.setHours(0, 0, 0, 0);
      start.setTime(parsedStart.getTime());
      
      if (queryEnd) {
        const parsedEnd = new Date(queryEnd as string);
        parsedEnd.setHours(23, 59, 59, 999);
        end.setTime(parsedEnd.getTime());
      } else {
        end.setHours(23, 59, 59, 999);
      }
    } else {
      // Default to last 7 days
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    const messages = await prisma.message.findMany({
      where: {
        accountId,
        createdAt: {
          gte: start,
          lte: end
        }
      },
      select: {
        status: true,
        createdAt: true,
        templateName: true
      }
    });

    // Calculate totals (cumulative funnel logic)
    let sent = 0;
    let delivered = 0;
    let read = 0;
    let failed = 0;

    messages.forEach(msg => {
      if (msg.status === "READ") {
        read++;
        delivered++;
        sent++;
      } else if (msg.status === "DELIVERED") {
        delivered++;
        sent++;
      } else if (msg.status === "SENT") {
        sent++;
      } else if (msg.status === "FAILED") {
        failed++;
      }
    });
    const total = messages.length;

    // Helper to format Date local to YYYY-MM-DD
    const formatDateLocal = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    // Group by day for the chart
    const dailyMap = new Map<string, { date: string; sent: number; read: number; failed: number }>();
    
    // Initialize chart dates so that dates with 0 messages are shown!
    const current = new Date(start);
    while (current.getTime() <= end.getTime()) {
      const dateStr = formatDateLocal(current);
      dailyMap.set(dateStr, { date: dateStr, sent: 0, read: 0, failed: 0 });
      current.setDate(current.getDate() + 1);
    }

    messages.forEach(msg => {
      const dateStr = formatDateLocal(msg.createdAt);
      const dayData = dailyMap.get(dateStr);
      if (dayData) {
        if (msg.status === "READ") {
          dayData.read++;
          dayData.sent++;
        } else if (msg.status === "DELIVERED" || msg.status === "SENT") {
          dayData.sent++;
        } else if (msg.status === "FAILED") {
          dayData.failed++;
        }
      }
    });

    const chartData = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Agrupar por nome do template para tabela de performance
    const templateMap = new Map<string, { templateName: string; sent: number; read: number; failed: number; total: number }>();

    messages.forEach(msg => {
      const tName = msg.templateName || "Envio Direto";
      if (!templateMap.has(tName)) {
        templateMap.set(tName, { templateName: tName, sent: 0, read: 0, failed: 0, total: 0 });
      }
      const tData = templateMap.get(tName)!;
      tData.total++;
      if (msg.status === "READ") {
        tData.read++;
        tData.sent++;
      } else if (msg.status === "DELIVERED" || msg.status === "SENT") {
        tData.sent++;
      } else if (msg.status === "FAILED") {
        tData.failed++;
      }
    });

    const templateMetrics = Array.from(templateMap.values()).sort((a, b) => b.total - a.total);

    res.json({
      totals: { sent, delivered, read, failed, total },
      chartData,
      templateMetrics
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// ==========================================
// CHAT / LIVE INBOX ROUTER
// ==========================================

/**
 * Normaliza números brasileiros para sempre usar 13 dígitos (com o 9º dígito).
 * Ex: 558386241167 (12d) → 5583986241167 (13d)
 * Evita conversas duplicadas causadas pela transição do 9º dígito no Brasil.
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Brasil: 55 + DDD(2) + número — sem o 9 = 12 dígitos, com o 9 = 13 dígitos
  if (digits.startsWith("55") && digits.length === 12) {
    return digits.slice(0, 4) + "9" + digits.slice(4);
  }
  return digits;
}

/** Retorna ambas as variantes do número (com e sem 9º dígito) para queries. */
function phoneVariants(phone: string): string[] {
  const normalized = normalizePhone(phone);
  const digits = phone.replace(/\D/g, "");
  const variants = new Set([phone, digits, normalized]);
  if (normalized.startsWith("55") && normalized.length === 13) {
    variants.add(normalized.slice(0, 4) + normalized.slice(5)); // versão sem o 9
  }
  return Array.from(variants);
}

// Obter a lista de conversas ativas (scoped to user)
router.get("/accounts/:accountId/conversations", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado." });

    // Obter todas as mensagens da conta ordenadas por data descendente
    const [messages, contacts] = await Promise.all([
      prisma.message.findMany({
        where: { accountId },
        orderBy: { createdAt: "desc" }
      }),
      (prisma as any).whatsAppContact.findMany({ where: { accountId } })
    ]);

    // Índice rápido: phone → profileName
    const contactMap = new Map(contacts.map((c: any) => [c.phone, c.profileName]));

    // Agrupar conversas por número normalizado (resolve problema do 9º dígito brasileiro)
    const conversationsMap = new Map<string, any>();
    messages.forEach((msg: any) => {
      const key = normalizePhone(msg.to);
      if (!conversationsMap.has(key)) {
        conversationsMap.set(key, {
          phone: key,
          profileName: contactMap.get(key) || null,
          lastMessage: msg.body || (msg.templateName ? `Template: ${msg.templateName}` : "Mídia"),
          updatedAt: msg.createdAt,
          status: msg.status,
          direction: msg.direction,
          messageType: msg.messageType,
        });
      }
    });

    const conversations = Array.from(conversationsMap.values());
    res.json(conversations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obter histórico de mensagens com um contato específico (scoped to user)
router.get("/accounts/:accountId/conversations/:phone/messages", async (req: Request, res: Response) => {
  const { accountId, phone } = req.params;
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado." });

    const messages = await prisma.message.findMany({
      where: { accountId, to: { in: phoneVariants(phone) } },
      orderBy: { createdAt: "asc" }
    });

    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Proxy de mídia recebida — busca o conteúdo binário da Meta e repassa ao frontend
router.get("/accounts/:accountId/media/:mediaId", async (req: Request, res: Response) => {
  const { accountId, mediaId } = req.params;
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) return res.status(404).json({ error: "Conta não encontrada." });

    const token = decryptToken(account.accessToken);

    // 1. Buscar URL temporária da mídia
    const metaRes = await axios.get(
      `https://graph.facebook.com/v19.0/${mediaId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const mediaUrl: string = metaRes.data.url;
    const mimeType: string = metaRes.data.mime_type || "application/octet-stream";

    // 2. Baixar o conteúdo binário e repassar ao cliente (evita CORS)
    const mediaContent = await axios.get(mediaUrl, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: "stream",
    });

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "private, max-age=300");
    mediaContent.data.pipe(res);
  } catch (error: any) {
    console.error("[Media Proxy] Erro ao buscar mídia:", error.response?.data || error.message);
    res.status(500).json({ error: "Não foi possível carregar a mídia." });
  }
});

// Enviar mensagem de texto livre / resposta para um contato (scoped to user)
router.post("/accounts/:accountId/messages/reply", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { to, body, variables } = req.body;

  if (!to || !body) {
    return res.status(400).json({ error: "Telefone (to) e mensagem (body) são obrigatórios." });
  }

  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado." });

    // Descriptografar o token de acesso da Meta
    const decryptedToken = decryptToken(account.accessToken);

    // Enviar mensagem de texto livre via API da Meta
    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${account.phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: {
          preview_url: false,
          body: body
        }
      },
      {
        headers: { Authorization: `Bearer ${decryptedToken}` }
      }
    );

    const wamid = response.data.messages?.[0]?.id;

    // Gravar no banco de dados local como OUTGOING
    const savedMsg = await prisma.message.create({
      data: {
        accountId,
        wamid,
        to,
        status: "SENT",
        direction: "OUTGOING",
        messageType: "TEXT",
        body,
        variables: variables || null,
      }
    });

    console.log(`[Chat] Resposta enviada com sucesso para ${to}. Wamid: ${wamid}`);

    // Encaminhar resposta humana manual para o n8n para pausar o robô (takeover humano)
    const n8nWebhookUrl = process.env.N8N_SDR_WEBHOOK_URL;
    if (n8nWebhookUrl) {
      // Ignorar se a mensagem foi disparada de forma automatizada (ex: pelo próprio SDR n8n)
      const isSdrDisparo = variables && (variables as any).sentBy === "SDR";
      
      if (!isSdrDisparo) {
        const n8nPayload = {
          event: "on-message",
          type: "text",
          from: to,
          to: to,
          destiny: account.phoneNumberId,
          isgroup: false,
          isGroupMsg: false,
          fromMe: true,
          id: wamid,
          content: body,
          login_atendente: "human", // sinaliza atendimento humano
        };

        console.log(`[Webhook Forward Outgoing] Encaminhando resposta de atendente humana para n8n: ${n8nWebhookUrl}`);
        axios.post(n8nWebhookUrl, n8nPayload).catch(err => {
          console.error("[Webhook Forward Outgoing] Falha ao encaminhar resposta para n8n:", err.message);
        });
      }
    }

    // Emitir evento em tempo real via SSE
    messageEventEmitter.emit("messageUpdated", {
      accountId: savedMsg.accountId,
      messageId: savedMsg.id,
      status: savedMsg.status,
      direction: savedMsg.direction,
      body: savedMsg.body,
      to: savedMsg.to,
      messageType: savedMsg.messageType,
      wamid: savedMsg.wamid,
      errorMessage: savedMsg.errorMessage,
      updatedAt: savedMsg.updatedAt,
      variables: savedMsg.variables,
    });

    res.status(201).json(savedMsg);
  } catch (error: any) {
    console.error(`[Chat] Erro ao enviar resposta para ${to}:`, error.response?.data || error.message);
    const metaError = error.response?.data?.error;
    const errMsg = metaError ? `Erro da Meta: ${metaError.message}` : error.message;
    res.status(error.response?.status || 500).json({ error: errMsg });
  }
});

// ==========================================
// SCHEDULED MESSAGES ROUTER
// ==========================================

// Obter mensagens agendadas para o futuro (scoped to user)
router.get("/accounts/:accountId/scheduled", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado" });

    const now = new Date();
    const scheduledMessages = await prisma.message.findMany({
      where: {
        accountId,
        status: "PENDING",
        scheduledAt: { gt: now }
      },
      orderBy: { scheduledAt: "asc" }
    });

    res.json(scheduledMessages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cancelar agendamento individual (scoped to user)
router.delete("/accounts/:accountId/scheduled/:messageId", async (req: Request, res: Response) => {
  const { accountId, messageId } = req.params;
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado" });

    const msg = await prisma.message.findFirst({
      where: { id: messageId, accountId }
    });
    if (!msg) return res.status(404).json({ error: "Mensagem agendada não encontrada" });

    if (msg.status !== "PENDING") {
      return res.status(400).json({ error: "Esta mensagem já foi processada ou está em andamento e não pode ser cancelada" });
    }

    await prisma.message.delete({
      where: { id: messageId }
    });

    // Notificar SSE
    messageEventEmitter.emit("messageUpdated", {
      accountId,
      messageId,
      status: "CANCELLED",
      wamid: null,
      errorMessage: "Cancelada pelo usuário",
      updatedAt: new Date(),
    });

    res.json({ success: true, message: "Agendamento cancelado com sucesso." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Reagendar mensagem (scoped to user)
router.post("/accounts/:accountId/scheduled/:messageId/reschedule", async (req: Request, res: Response) => {
  const { accountId, messageId } = req.params;
  const { scheduledAt } = req.body;

  if (!scheduledAt) {
    return res.status(400).json({ error: "Nova data/hora de agendamento é obrigatória." });
  }

  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado" });

    const msg = await prisma.message.findFirst({
      where: { id: messageId, accountId }
    });
    if (!msg) return res.status(404).json({ error: "Mensagem agendada não encontrada" });

    if (msg.status !== "PENDING") {
      return res.status(400).json({ error: "Esta mensagem já foi processada e não pode ser reagendada." });
    }

    const newDate = new Date(scheduledAt);
    if (isNaN(newDate.getTime()) || newDate <= new Date()) {
      return res.status(400).json({ error: "A data de agendamento deve ser uma data válida e futura." });
    }

    const updatedMsg = await prisma.message.update({
      where: { id: messageId },
      data: {
        scheduledAt: newDate,
        nextRetryAt: null,
        retryCount: 0,
      }
    });

    // Notificar SSE
    messageEventEmitter.emit("messageUpdated", {
      accountId,
      messageId: updatedMsg.id,
      status: updatedMsg.status,
      wamid: null,
      errorMessage: null,
      updatedAt: updatedMsg.updatedAt,
    });

    res.json({ success: true, message: "Mensagem reagendada com sucesso.", data: updatedMsg });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// WEBHOOKS ROUTES (META API)
// ==========================================

// Webhook Verification (GET)
router.get("/webhooks", (req: Request, res: Response) => {
  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN || "minha-senha-super-secreta-do-webhook";

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === verifyToken) {
      console.log("WEBHOOK_VERIFIED");
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403);
    }
  }
  res.sendStatus(400);
});

// Webhook Receiver (POST)
router.post("/webhooks", async (req: Request, res: Response) => {
  const body = req.body;
  console.log("[Webhook] POST recebido de Meta:", JSON.stringify(body, null, 2));

  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const signature = req.headers["x-hub-signature-256"] as string;

  if (appSecret) {
    if (!signature) {
      console.warn("[Webhook] Assinatura ausente (x-hub-signature-256).");
      return res.status(401).send("Signature missing");
    }

    const parts = signature.split("=");
    if (parts[0] !== "sha256" || !parts[1]) {
      console.warn("[Webhook] Formato de assinatura inválido.");
      return res.status(400).send("Invalid signature format");
    }

    const signatureHash = parts[1];
    const rawBody = (req as any).rawBody;

    if (!rawBody) {
      console.warn("[Webhook] Corpo bruto da requisição indisponível.");
      return res.status(400).send("Raw body not available");
    }

    const expectedHash = crypto
      .createHmac("sha256", appSecret)
      .update(rawBody)
      .digest("hex");

    try {
      const isMatch = crypto.timingSafeEqual(
        Buffer.from(signatureHash, "hex"),
        Buffer.from(expectedHash, "hex")
      );
      if (!isMatch) {
        console.warn(`[Webhook] Assinatura inválida. Recebida: ${signatureHash}, Esperada: ${expectedHash}`);
        return res.status(403).send("Signature mismatch");
      }
    } catch (err: any) {
      console.error("[Webhook] Erro ao validar assinatura do webhook:", err.message);
      return res.status(403).send("Signature verification error");
    }
  }

  // Responder 200 OK imediatamente para a Meta não ficar reenviando
  res.sendStatus(200);

  try {
    // Verificar se o evento é do WhatsApp Business
    if (body.object === "whatsapp_business_account") {
      for (const entry of body.entry) {
        // 1. Processar mudanças de status de mensagens
        const changes = entry.changes;
        for (const change of changes) {
          const value = change.value;
          
          if (change.field === "messages") {
            // 1.1 Atualizações de Status (Enviado, Entregue, Lido, Falhou)
            if (value.statuses && Array.isArray(value.statuses)) {
              for (const statusObj of value.statuses) {
                const wamid = statusObj.id;
                const status = statusObj.status?.toUpperCase(); // DELIVERED, READ, SENT, FAILED
                const errors = statusObj.errors;

                let errorMessage = null;
                if (errors && errors.length > 0) {
                  errorMessage = errors[0].message;
                }

                // Procurar mensagem por wamid e atualizar status
                const msg = await prisma.message.findUnique({ where: { wamid } });
                if (msg) {
                  const updatedMsg = await prisma.message.update({
                    where: { wamid },
                    data: {
                      status,
                      ...(errorMessage ? { errorMessage } : {}),
                    },
                  });
                  console.log(`Mensagem ${wamid} atualizada para o status: ${status}`);

                  // Emitir evento em tempo real para SSE
                  messageEventEmitter.emit("messageUpdated", {
                    accountId: updatedMsg.accountId,
                    messageId: updatedMsg.id,
                    status: updatedMsg.status,
                    direction: updatedMsg.direction,
                    body: updatedMsg.body,
                    to: updatedMsg.to,
                    messageType: updatedMsg.messageType,
                    wamid: updatedMsg.wamid,
                    errorMessage: updatedMsg.errorMessage,
                    updatedAt: updatedMsg.updatedAt,
                  });
                }
              }
            }

            // 1.2 Mensagens Recebidas do Cliente (Respostas)
            if (value.messages && Array.isArray(value.messages)) {
              // Extrair nome de perfil do campo contacts (entregue junto com as mensagens)
              const contactsArr = value.contacts as any[] | undefined;

              for (const messageObj of value.messages) {
                const wamid = messageObj.id;
                const from = normalizePhone(messageObj.from); // Normaliza 9º dígito BR
                const type = messageObj.type; // text, image, document, video, audio, etc.

                // Nome de perfil do WhatsApp do remetente
                const profileName: string | null =
                  contactsArr?.find((c: any) => normalizePhone(c.wa_id) === from)?.profile?.name || null;
                
                let bodyText = null;
                let mediaUrl = null;
                
                if (type === "text") {
                  bodyText = messageObj.text?.body;
                } else if (type === "image") {
                  bodyText = messageObj.image?.caption || "Imagem recebida";
                  mediaUrl = messageObj.image?.id;
                } else if (type === "document") {
                  bodyText = messageObj.document?.filename || "Documento recebido";
                  mediaUrl = messageObj.document?.id;
                } else if (type === "video") {
                  bodyText = messageObj.video?.caption || "Vídeo recebido";
                  mediaUrl = messageObj.video?.id;
                } else if (type === "audio") {
                  bodyText = "Áudio recebido";
                  mediaUrl = messageObj.audio?.id;
                } else {
                  bodyText = `Mensagem do tipo ${type} recebida`;
                }

                // Encontrar conta do WhatsApp correspondente pelo phoneNumberId que recebeu
                const phoneId = value.metadata?.phone_number_id;
                console.log(`[Webhook] Processando mensagem recebida. Remetente (from): ${from}, phoneNumberId da Meta: ${phoneId}`);
                if (phoneId) {
                  const account = await prisma.account.findFirst({
                    where: { phoneNumberId: phoneId }
                  });

                  if (account) {
                    console.log(`[Webhook] Conta encontrada no banco: ${account.name} (ID: ${account.id})`);

                    // Salvar/atualizar nome de perfil do contato
                    if (profileName) {
                      await (prisma as any).whatsAppContact.upsert({
                        where: { accountId_phone: { accountId: account.id, phone: from } },
                        update: { profileName },
                        create: { accountId: account.id, phone: from, profileName },
                      });
                    }

                    // Evitar duplicações caso a Meta reenvie o webhook
                    const existingMsg = await prisma.message.findUnique({ where: { wamid } });

                    if (!existingMsg) {
                      const savedMsg = await prisma.message.create({
                        data: {
                          accountId: account.id,
                          wamid,
                          to: from, // Para mensagens recebidas, salvamos o telefone do remetente em "to"
                          status: "RECEIVED",
                          direction: "INCOMING",
                          messageType: type.toUpperCase(),
                          body: bodyText,
                          mediaUrl: mediaUrl,
                        }
                      });

                      console.log(`[Webhook] Nova mensagem recebida de ${from} salva no banco. Wamid: ${wamid}`);

                      // Emitir evento em tempo real para o frontend
                      messageEventEmitter.emit("messageUpdated", {
                        accountId: savedMsg.accountId,
                        messageId: savedMsg.id,
                        status: savedMsg.status,
                        direction: savedMsg.direction,
                        body: savedMsg.body,
                        to: savedMsg.to,
                        messageType: savedMsg.messageType,
                        wamid: savedMsg.wamid,
                        errorMessage: savedMsg.errorMessage,
                        updatedAt: savedMsg.updatedAt,
                        profileName,
                      });

                      // Encaminhar webhook para o n8n do SDR se configurado
                      const n8nWebhookUrl = process.env.N8N_SDR_WEBHOOK_URL;
                      if (n8nWebhookUrl) {
                        const finalProfileName = profileName || "";
                        
                        let mimeType = "image/jpeg";
                        if (type === "image" && messageObj.image?.mime_type) mimeType = messageObj.image.mime_type;
                        else if (type === "audio" && messageObj.audio?.mime_type) mimeType = messageObj.audio.mime_type;
                        else if (type === "video" && messageObj.video?.mime_type) mimeType = messageObj.video.mime_type;
                        else if (type === "document" && messageObj.document?.mime_type) mimeType = messageObj.document.mime_type;

                        const n8nPayload = {
                          event: "on-message",
                          type: type === "voice" ? "audio" : type,
                          from: from,
                          phone: from,
                          cel_contato: from,
                          destiny: account.phoneNumberId,
                          cel_conectado: account.phoneNumberId,
                          isgroup: false,
                          isGroupMsg: false,
                          fromMe: false,
                          id: wamid,
                          content: bodyText || "",
                          caption: bodyText || "",
                          pushName: finalProfileName,
                          senderName: finalProfileName,
                          nome_contato: finalProfileName,
                          conteudo_buffer: mediaUrl ? {
                            id: mediaUrl,
                            mimetype: mimeType
                          } : null,
                          account_id: account.id,
                          phone_number_id: account.phoneNumberId,
                          access_token: decryptToken(account.accessToken)
                        };

                        console.log(`[Webhook Forward] Encaminhando mensagem de ${from} para n8n: ${n8nWebhookUrl}`);
                        axios.post(n8nWebhookUrl, n8nPayload).catch(err => {
                          console.error("[Webhook Forward] Falha ao encaminhar mensagem para n8n:", err.message);
                        });
                      }
                    } else {
                      console.log(`[Webhook] Mensagem com wamid ${wamid} já existe no banco. Ignorando.`);
                    }
                  } else {
                    console.warn(`[Webhook] Nenhuma conta local cadastrada com o phoneNumberId: ${phoneId}`);
                  }
                } else {
                  console.warn("[Webhook] Atributo metadata.phone_number_id ausente no payload.");
                }
              }
            }
          }

          // 2. Processar mudanças de status de templates (message_template_status_update)
          if (change.field === "message_template_status_update") {
            const templateEvent = value.event; // APPROVED, REJECTED, PENDING
            const metaTemplateId = value.message_template_id;
            const templateName = value.message_template_name;

            // Procurar template por metaId ou nome e atualizar status
            const template = await prisma.template.findFirst({
              where: {
                OR: [
                  { metaId: String(metaTemplateId) },
                  { name: templateName }
                ]
              }
            });

            if (template) {
              await prisma.template.update({
                where: { id: template.id },
                data: {
                  status: templateEvent, // APPROVED, REJECTED, PENDING
                },
              });
              console.log(`Template ${templateName} atualizado para o status: ${templateEvent}`);
            }
          }
        }
      }
    }
  } catch (error: any) {
    console.error("Erro no processamento do webhook:", error.message);
  }
});

// ==========================================
// FACEBOOK OAUTH ONBOARDING ROUTES
// ==========================================

// Embedded Signup: trocar code por token de longa duração
// O waba_id e phone_number_id já vêm diretamente do callback do SDK
router.post("/accounts/facebook-onboard/exchange", async (req: Request, res: Response) => {
  const { code, wabaId, phoneNumberId, redirectUri } = req.body;
  if (!code || !wabaId || !phoneNumberId) {
    return res.status(400).json({ error: "code, wabaId e phoneNumberId são obrigatórios." });
  }

  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;

  if (!appId || !appSecret) {
    return res.status(500).json({ error: "Credenciais do aplicativo do Facebook não configuradas no servidor." });
  }

  try {
    // 1. Trocar code por token de acesso de longa duração
    const tokenResponse = await axios.get(
      `https://graph.facebook.com/v21.0/oauth/access_token`,
      {
        params: {
          client_id: appId,
          client_secret: appSecret,
          code,
          redirect_uri: redirectUri || "",
        },
      }
    );

    const shortToken = tokenResponse.data.access_token;

    // 2. Trocar por token de longa duração (60 dias)
    const longTokenResponse = await axios.get(
      `https://graph.facebook.com/v21.0/oauth/access_token`,
      {
        params: {
          grant_type: "fb_exchange_token",
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: shortToken,
        },
      }
    );

    const longLivedToken = longTokenResponse.data.access_token;

    // 3. Buscar nome da WABA e número de telefone para exibição
    let wabaName = `WABA ${wabaId}`;
    let phoneDisplay = phoneNumberId;

    try {
      const wabaRes = await axios.get(
        `https://graph.facebook.com/v21.0/${wabaId}`,
        { params: { fields: "name", access_token: longLivedToken } }
      );
      if (wabaRes.data.name) wabaName = wabaRes.data.name;
    } catch (_) {}

    try {
      const phoneRes = await axios.get(
        `https://graph.facebook.com/v21.0/${phoneNumberId}`,
        { params: { fields: "display_phone_number", access_token: longLivedToken } }
      );
      if (phoneRes.data.display_phone_number) phoneDisplay = phoneRes.data.display_phone_number;
    } catch (_) {}

    res.json({ longLivedToken, wabaName, phoneDisplay });
  } catch (error: any) {
    console.error("Erro no Embedded Signup exchange:", error.response?.data || error.message);
    const details = error.response?.data?.error?.message || error.message;
    res.status(400).json({ error: "Falha ao processar código do Embedded Signup.", details });
  }
});

// Salvar conta do Facebook Onboarding (scoped to user)
router.post("/accounts/facebook-onboard/save", async (req: Request, res: Response) => {
  const { name, wabaId, phoneNumberId, accessToken } = req.body;

  if (!name || !wabaId || !phoneNumberId || !accessToken) {
    return res.status(400).json({ error: "Preencha todos os campos obrigatórios." });
  }

  try {
    const userId = (req as AuthenticatedRequest).userId!;
    const encryptedToken = encryptToken(accessToken.trim());

    const account = await prisma.account.upsert({
      where: {
        userId_name: {
          userId,
          name,
        },
      },
      update: { wabaId, phoneNumberId, accessToken: encryptedToken },
      create: { userId, name, wabaId, phoneNumberId, accessToken: encryptedToken },
    });

    res.status(201).json({
      ...account,
      accessToken: decryptToken(account.accessToken)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// MEDIA ASSETS ROUTES
// ==========================================

// List media assets (scoped to account/user)
router.get("/accounts/:accountId/media", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado." });

    const media = await prisma.mediaAsset.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" }
    });

    res.json(media);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Upload media asset (scoped to account/user)
router.post("/accounts/:accountId/media", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { filename, mimeType, fileBase64 } = req.body;

  if (!filename || !mimeType || !fileBase64) {
    return res.status(400).json({ error: "Faltam campos obrigatórios: filename, mimeType, fileBase64" });
  }

  // Tipos de arquivo permitidos (alinhado com limites da Meta WhatsApp)
  const ALLOWED_MIME_TYPES: Record<string, string> = {
    "image/jpeg": "image",
    "image/png": "image",
    "image/webp": "image",
    "video/mp4": "video",
    "video/3gpp": "video",
    "application/pdf": "document",
  };

  if (!ALLOWED_MIME_TYPES[mimeType]) {
    return res.status(400).json({
      error: `Tipo de arquivo não suportado: ${mimeType}. Aceitos: JPEG, PNG, WebP, MP4, 3GPP, PDF.`
    });
  }

  const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado." });

    // Converter base64 para Buffer
    const base64Data = fileBase64.replace(/^data:.*?;base64,/, "");
    const fileBuffer = Buffer.from(base64Data, "base64");

    // Verificar tamanho
    if (fileBuffer.length > MAX_SIZE_BYTES) {
      return res.status(400).json({
        error: `Arquivo muito grande (${(fileBuffer.length / 1024 / 1024).toFixed(1)} MB). Limite máximo: 50 MB.`
      });
    }

    // Gerar um nome único para evitar colisões
    const uniqueFilename = `${Date.now()}-${filename.replace(/\s+/g, "_")}`;
    const uploadsDir = path.join(__dirname, "../../uploads");
    const filePath = path.join(uploadsDir, uniqueFilename);

    // Salvar arquivo físico no disco
    fs.writeFileSync(filePath, fileBuffer);

    // Gerar URL pública do asset
    const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`;
    const fileUrl = `${backendUrl}/uploads/${uniqueFilename}`;

    const mediaAsset = await prisma.mediaAsset.create({
      data: {
        accountId,
        filename: uniqueFilename,
        url: fileUrl,
        mimeType,
        size: fileBuffer.length,
        fileData: fileBase64, // Salvar o base64 para persistência/recuperação posterior
      }
    });

    res.status(201).json(mediaAsset);
  } catch (error: any) {
    console.error("Erro no upload de mídia:", error);
    res.status(500).json({ error: error.message });
  }
});


// Delete media asset (scoped to account/user)
router.delete("/accounts/:accountId/media/:mediaId", async (req: Request, res: Response) => {
  const { accountId, mediaId } = req.params;
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado." });

    const mediaAsset = await prisma.mediaAsset.findFirst({
      where: { id: mediaId, accountId }
    });
    if (!mediaAsset) return res.status(404).json({ error: "Mídia não encontrada." });

    // Excluir arquivo físico se existir
    const filePath = path.join(__dirname, "../../uploads", mediaAsset.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Excluir do banco
    await prisma.mediaAsset.delete({
      where: { id: mediaId }
    });

    res.json({ success: true, message: "Mídia excluída com sucesso." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
