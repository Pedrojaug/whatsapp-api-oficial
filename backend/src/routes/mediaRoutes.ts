import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { prisma } from "../db";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

// Aplica autenticação a todas as rotas de mídia
router.use(authMiddleware);

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
    const uploadsDir = path.join(__dirname, "../uploads"); // Nota: modificado de ../../uploads para ../uploads dependendo da estrutura de pastas de build (src/routes/mediaRoutes.ts -> src/uploads é um nível acima)
    
    // Garantir que a pasta uploads existe
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

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
    const filePath = path.join(__dirname, "../uploads", mediaAsset.filename);
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
