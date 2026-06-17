import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { prisma } from "../db";

export interface ApiKeyRequest extends Request {
  accountId?: string;
  apiKeyId?: string;
}

export async function apiKeyMiddleware(req: ApiKeyRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Chave de API obrigatória. Use 'Authorization: Bearer <api_key>'." });
  }

  const key = authHeader.slice(7).trim();
  if (!key.startsWith("sk_")) {
    return res.status(401).json({ error: "Formato de chave inválido. A chave deve iniciar com 'sk_'." });
  }

  const keyHash = crypto.createHash("sha256").update(key).digest("hex");
  const apiKey = await prisma.apiKey.findUnique({ where: { keyHash } });

  if (!apiKey) {
    return res.status(401).json({ error: "Chave de API inválida ou revogada." });
  }

  // Update lastUsedAt fire-and-forget
  prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  req.accountId = apiKey.accountId;
  req.apiKeyId = apiKey.id;
  next();
}
