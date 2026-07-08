import { Router, Request, Response } from "express";
import { prisma } from "../db";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth";
import { decryptToken } from "../utils/crypto";
import { metaService } from "../services/metaService";
import { findAccountForUser } from "../utils/accountAccess";

const router = Router();

// Aplica autenticação a todas as rotas de templates
router.use(authMiddleware);

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
        const response = await metaService.fetchTemplates(account.wabaId, decryptedToken);

        const META_DEFAULT_TEMPLATES = [
          "hello_world", 
          "sample_issue_resolution", 
          "sample_shipping_confirmation", 
          "sample_movie_ticket_confirmation", 
          "sample_flight_confirmation", 
          "sample_purchase_feedback", 
          "sample_happy_hour_announcement", 
          "sample_business_updates"
        ];
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

      // Normalizar componentes: converter tipos legados/incorretos para o schema atual da Meta
      const normalizedComponents = (components as any[]).map((c: any) => {
        const type = String(c.type || "").toUpperCase();
        // Corrige caso antigo onde o tipo era "image", "video", "document" em vez de "HEADER"
        if (["IMAGE", "VIDEO", "DOCUMENT", "AUDIO"].includes(type) && !c.format) {
          return { ...c, type: "HEADER", format: type };
        }
        // Garantir que tipos conhecidos estejam em maiúsculas
        return { ...c, type };
      });

      const response = await metaService.createTemplate(account.wabaId, decryptedToken, {
        name,
        category,
        language: language || "pt_BR",
        components: normalizedComponents,
      });

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
    const userId = (req as AuthenticatedRequest).userId!;
    const account = await findAccountForUser(accountId, userId);
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
  const subcode = metaErr.error_subcode;
  const msg: string = metaErr.message || "";

  if (code === 2388024 || subcode === 2388024) {
    return "A Meta ainda está processando a exclusão da versão anterior deste template. Por favor, mude levemente o nome (ex: adicione '_v2' no final) ou aguarde cerca de 15 minutos antes de tentar novamente.";
  }
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
    const sessionResponse = await metaService.initiateResumableUpload(appId, decryptedToken, {
      filename: fileName,
      file_size: fileBuffer.length,
      file_type: fileType
    });
    const uploadSessionId = sessionResponse.data.id;

    // 3. Fazer o upload do buffer binário
    const uploadResponse = await metaService.uploadBinaryChunk(
      uploadSessionId,
      decryptedToken,
      0,
      fileBuffer,
      "application/octet-stream"
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
        // Usamos metaService.deleteTemplate passando os parâmetros necessários
        await metaService.deleteTemplate(account.wabaId, decryptedToken, template.name);
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

export default router;
