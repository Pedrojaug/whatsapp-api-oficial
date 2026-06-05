import { Router, Request, Response } from "express";
import axios from "axios";
import { prisma } from "../db";

const router = Router();

// ==========================================
// ACCOUNTS ROUTES
// ==========================================

// List WABA accounts
router.get("/accounts", async (req: Request, res: Response) => {
  try {
    const accounts = await prisma.account.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(accounts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create/Update WABA account
router.post("/accounts", async (req: Request, res: Response) => {
  const { name, wabaId, phoneNumberId, accessToken } = req.body;
  if (!name || !wabaId || !phoneNumberId || !accessToken) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const account = await prisma.account.upsert({
      where: { name },
      update: { wabaId, phoneNumberId, accessToken },
      create: { name, wabaId, phoneNumberId, accessToken },
    });
    res.status(201).json(account);
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

// Delete account
router.delete("/accounts/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.account.delete({ where: { id } });
    res.json({ message: "Account deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// TEMPLATES ROUTES
// ==========================================

// Sincronizar e listar templates da Meta para uma conta
router.get("/accounts/:accountId/templates", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  try {
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) return res.status(404).json({ error: "Account not found" });

    // Buscar templates direto da Meta
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v19.0/${account.wabaId}/message_templates`,
        {
          headers: { Authorization: `Bearer ${account.accessToken}` },
        }
      );

      const metaTemplates = response.data.data;

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
      console.error("Erro ao puxar da Meta, usando cache local:", metaError.response?.data || metaError.message);
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

// Criar template local e enviar para a Meta
router.post("/accounts/:accountId/templates", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { name, language, category, components } = req.body;

  if (!name || !category || !components) {
    return res.status(400).json({ error: "Missing name, category, or components" });
  }

  try {
    const account = await prisma.account.findUnique({ where: { id: accountId } });
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
      const response = await axios.post(
        `https://graph.facebook.com/v19.0/${account.wabaId}/message_templates`,
        {
          name,
          category,
          language: language || "pt_BR",
          components,
        },
        {
          headers: { Authorization: `Bearer ${account.accessToken}` },
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
      console.error("Meta API Template Error:", metaError.response?.data || metaError.message);
      res.status(400).json({
        error: "Erro retornado pela Meta ao tentar criar template",
        details: metaError.response?.data || metaError.message,
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Upload de arquivo de exemplo para obter o header_handle da Meta
router.post("/accounts/:accountId/templates/upload-sample", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { fileName, fileType, fileBase64 } = req.body;

  if (!fileName || !fileType || !fileBase64) {
    return res.status(400).json({ error: "Missing fileName, fileType, or fileBase64" });
  }

  try {
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) return res.status(404).json({ error: "Account not found" });

    // 1. Obter o App ID do token da Meta
    const appResponse = await axios.get(
      `https://graph.facebook.com/v19.0/app?access_token=${account.accessToken}`
    );
    const appId = appResponse.data.id;

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
          access_token: account.accessToken,
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
          Authorization: `Bearer ${account.accessToken}`,
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

// Excluir template local e na Meta
router.delete("/accounts/:accountId/templates/:templateId", async (req: Request, res: Response) => {
  const { accountId, templateId } = req.params;
  try {
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) return res.status(404).json({ error: "Conta não encontrada" });

    const template = await prisma.template.findUnique({ where: { id: templateId } });
    if (!template) return res.status(404).json({ error: "Template não encontrado" });

    // Se o template tem ID da Meta, deleta na Meta
    if (template.metaId) {
      try {
        await axios.delete(
          `https://graph.facebook.com/v19.0/${account.wabaId}/message_templates`,
          {
            params: {
              hsm_id: template.metaId,
            },
            headers: { Authorization: `Bearer ${account.accessToken}` },
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

// Listar listas de contatos
router.get("/accounts/:accountId/lists", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  try {
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

// Obter detalhes de uma lista de contatos (e seus contatos)
router.get("/accounts/:accountId/lists/:listId", async (req: Request, res: Response) => {
  const { accountId, listId } = req.params;
  try {
    const list = await prisma.contactList.findUnique({
      where: { id: listId },
      include: {
        contacts: {
          orderBy: { createdAt: "desc" }
        }
      }
    });
    if (!list || list.accountId !== accountId) {
      return res.status(404).json({ error: "Lista não encontrada" });
    }
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Criar lista e importar contatos
router.post("/accounts/:accountId/lists", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { name, contacts } = req.body; // contacts: Array<{ name?: string, phone: string, variables?: string[] }>

  if (!name || !contacts || !Array.isArray(contacts)) {
    return res.status(400).json({ error: "Nome da lista e contatos são obrigatórios." });
  }

  try {
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

// Excluir lista de contatos
router.delete("/accounts/:accountId/lists/:listId", async (req: Request, res: Response) => {
  const { accountId, listId } = req.params;
  try {
    await prisma.contactList.delete({
      where: { id: listId }
    });
    res.json({ success: true, message: "Lista excluída com sucesso." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Disparo em lote para uma lista
router.post("/accounts/:accountId/lists/:listId/send", async (req: Request, res: Response) => {
  const { accountId, listId } = req.params;
  const { templateName, variables, mediaUrl } = req.body;

  if (!templateName) {
    return res.status(400).json({ error: "Template é obrigatório." });
  }

  try {
    const list = await prisma.contactList.findUnique({
      where: { id: listId },
      include: { contacts: true }
    });
    if (!list || list.accountId !== accountId) {
      return res.status(404).json({ error: "Lista de contatos não encontrada." });
    }

    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) return res.status(404).json({ error: "Conta não encontrada." });

    const template = await prisma.template.findFirst({
      where: { accountId, name: templateName }
    });
    const templateComponents = template?.components as any[];
    const headerComp = templateComponents && Array.isArray(templateComponents)
      ? templateComponents.find((c: any) => c.type === "HEADER")
      : null;

    // Responder 200 OK imediatamente para liberar a UI do cliente
    res.json({
      success: true,
      message: `Disparo em lote iniciado para ${list.contacts.length} contatos.`
    });

    // Processar os envios em background
    (async () => {
      for (const contact of list.contacts) {
        try {
          // Mapear cada variável dinamicamente com base nas opções selecionadas
          const resolvedVars = variables.map((v: string) => {
            if (v === "CONTACT_NAME") return contact.name || "";
            if (v === "CONTACT_PHONE") return contact.phone;
            if (v.startsWith("CONTACT_VAR_")) {
              const idx = parseInt(v.replace("CONTACT_VAR_", "")) - 1;
              const contactVars = contact.variables as string[];
              return (contactVars && contactVars[idx]) || "";
            }
            return v; // valor estático
          });

          // Criar log da mensagem como PENDING
          const dbMessage = await prisma.message.create({
            data: {
              accountId,
              to: contact.phone,
              templateName,
              variables: resolvedVars ? { variables: resolvedVars, mediaUrl } : (mediaUrl ? { mediaUrl } : {}),
              status: "PENDING",
            }
          });

          const components: any[] = [];

          // 1. Processar cabeçalho de mídia
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
          if (resolvedVars && resolvedVars.length > 0) {
            components.push({
              type: "body",
              parameters: resolvedVars.map((v: any) => ({
                type: "text",
                text: String(v),
              })),
            });
          }

          // Chamar a Meta API
          try {
            const response = await axios.post(
              `https://graph.facebook.com/v19.0/${account.phoneNumberId}/messages`,
              {
                messaging_product: "whatsapp",
                to: contact.phone,
                type: "template",
                template: {
                  name: templateName,
                  language: {
                    code: template?.language || "pt_BR",
                  },
                  ...(components.length > 0 ? { components } : {}),
                },
              },
              {
                headers: { Authorization: `Bearer ${account.accessToken}` },
              }
            );

            const wamid = response.data.messages?.[0]?.id;

            // Atualizar status para SENT
            await prisma.message.update({
              where: { id: dbMessage.id },
              data: {
                wamid,
                status: "SENT",
              }
            });
          } catch (metaError: any) {
            console.error(`Erro ao disparar para ${contact.phone}:`, metaError.response?.data || metaError.message);
            const errMsg = metaError.response?.data?.error?.message || metaError.message;
            await prisma.message.update({
              where: { id: dbMessage.id },
              data: {
                status: "FAILED",
                errorMessage: errMsg,
              }
            });
          }
        } catch (err: any) {
          console.error(`Erro interno ao processar contato ${contact.phone}:`, err.message);
        }
        
        // Aguarda 200ms entre disparos
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    })();

  } catch (error: any) {
    console.error("Erro no disparo em lote:", error);
  }
});

// ==========================================
// MESSAGES ROUTES
// ==========================================

// Enviar mensagem via Template
router.post("/accounts/:accountId/messages/send", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { to, templateName, language, variables, mediaUrl } = req.body;

  if (!to || !templateName) {
    return res.status(400).json({ error: "Missing to or templateName" });
  }

  try {
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) return res.status(404).json({ error: "Account not found" });

    const template = await prisma.template.findFirst({
      where: { accountId, name: templateName },
    });

    // Criar o log no banco local como PENDING
    const dbMessage = await prisma.message.create({
      data: {
        accountId,
        to,
        templateName,
        variables: variables ? { variables, mediaUrl } : (mediaUrl ? { mediaUrl } : {}),
        status: "PENDING",
      },
    });

    const components: any[] = [];

    // 1. Processar cabeçalho de mídia se necessário
    const templateComponents = template?.components as any[];
    const headerComp = templateComponents && Array.isArray(templateComponents)
      ? templateComponents.find((c: any) => c.type === "HEADER")
      : null;

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
      const response = await axios.post(
        `https://graph.facebook.com/v19.0/${account.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to,
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
          headers: { Authorization: `Bearer ${account.accessToken}` },
        }
      );

      const wamid = response.data.messages?.[0]?.id;

      // Atualizar status para SENT
      const updatedMessage = await prisma.message.update({
        where: { id: dbMessage.id },
        data: {
          wamid,
          status: "SENT",
        },
      });

      res.json(updatedMessage);
    } catch (metaError: any) {
      console.error("Meta API Message Error:", metaError.response?.data || metaError.message);
      
      const errMsg = metaError.response?.data?.error?.message || metaError.message;
      await prisma.message.update({
        where: { id: dbMessage.id },
        data: {
          status: "FAILED",
          errorMessage: errMsg,
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

// List messages logs
router.get("/accounts/:accountId/messages", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  try {
    const messages = await prisma.message.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
      take: 200, // Limite de 200 logs
    });
    res.json(messages);
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
                  await prisma.message.update({
                    where: { wamid },
                    data: {
                      status,
                      ...(errorMessage ? { errorMessage } : {}),
                    },
                  });
                  console.log(`Mensagem ${wamid} atualizada para o status: ${status}`);
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

export default router;
