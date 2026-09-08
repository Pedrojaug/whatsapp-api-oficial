import { Router, Request, Response } from "express";
import { prisma } from "../db";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth";
import { encryptToken, decryptToken } from "../utils/crypto";
import { metaService } from "../services/metaService";

const router = Router();

// Aplica autenticação a todas as rotas de onboarding
router.use(authMiddleware);

// Embedded Signup: trocar code por token de longa duração
// O waba_id e phone_number_id já vêm diretamente do callback do SDK
router.post("/accounts/facebook-onboard/exchange", async (req: Request, res: Response) => {
  const { code, wabaId, phoneNumberId, redirectUri } = req.body;
  if (!code || !wabaId) {
    return res.status(400).json({ error: "code e wabaId são obrigatórios." });
  }

  const rawAppId = process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || "1395411182414690";
  const rawSecret = process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET;

  if (!rawSecret) {
    return res.status(500).json({ error: "Segredo do aplicativo Meta/Facebook (META_APP_SECRET ou FACEBOOK_APP_SECRET) não configurado no servidor." });
  }

  const appId = rawAppId.trim().replace(/^["']|["']$/g, "");
  const appSecret = rawSecret.trim().replace(/^["']|["']$/g, "");
  const cleanCode = code.trim();

  console.log(`[OAuth Exchange] Using App ID: ${appId} | Secret length: ${appSecret.length} | Secret prefix: ${appSecret.substring(0, 4)}...`);

  try {
    // 1. Trocar code por token de acesso curto
    // No fluxo Embedded Signup do JS SDK, redirect_uri deve ser string vazia ("") para prevenir erro OAuth 100/191 da Meta
    const cleanRedirectUri = (redirectUri && redirectUri.startsWith("http") && !redirectUri.includes("localhost")) ? redirectUri.trim() : "";
    const tokenResponse = await metaService.exchangeOAuthToken(cleanCode, appId, appSecret, cleanRedirectUri);
    const shortToken = tokenResponse.data.access_token;

    // 2. Trocar por token de longa duração (60 dias)
    const longTokenResponse = await metaService.exchangeLongLivedToken(shortToken, appId, appSecret);
    const longLivedToken = longTokenResponse.data.access_token;

    // 3. Inscrever a WABA no aplicativo Tech Provider (subscribed_apps para webhooks automáticos)
    let webhookSubscribed = false;
    try {
      await metaService.subscribeWabaToApp(wabaId, longLivedToken);
      webhookSubscribed = true;
      console.log(`[Tech Provider] Webhook inscrito com sucesso para a WABA ${wabaId}`);
    } catch (subErr: any) {
      console.warn(`[Tech Provider] Aviso ao inscrever webhook para WABA ${wabaId}:`, subErr.response?.data || subErr.message);
    }

    // 4. Registrar o número de telefone na Meta Cloud API para ativação operacional imediata (se houver phoneNumberId)
    let phoneRegistered = false;
    const defaultPin = process.env.META_DEFAULT_PIN || "000000";
    if (phoneNumberId) {
      try {
        await metaService.registerPhoneNumber(phoneNumberId, longLivedToken, defaultPin);
        phoneRegistered = true;
        console.log(`[Tech Provider] Número ${phoneNumberId} registrado com sucesso na Cloud API`);
      } catch (regErr: any) {
        console.warn(`[Tech Provider] Aviso ao registrar número ${phoneNumberId} na Cloud API:`, regErr.response?.data || regErr.message);
      }
    }

    // 5. Buscar nome da WABA
    let wabaName = `WABA ${wabaId}`;
    try {
      const wabaRes = await metaService.getWabaInfo(wabaId, longLivedToken);
      if (wabaRes.data.name) wabaName = wabaRes.data.name;
    } catch (_) {}

    // 6. Buscar números de telefone associados
    let phoneNumbers: Array<{ id: string; displayPhoneNumber: string; verifiedName?: string }> = [];
    let phoneDisplay = phoneNumberId || "";

    if (phoneNumberId) {
      try {
        const phoneRes = await metaService.getPhoneInfo(phoneNumberId, longLivedToken);
        if (phoneRes.data.display_phone_number) phoneDisplay = phoneRes.data.display_phone_number;
        phoneNumbers = [{ id: phoneNumberId, displayPhoneNumber: phoneDisplay, verifiedName: phoneRes.data.verified_name || "" }];
      } catch (_) {
        phoneNumbers = [{ id: phoneNumberId, displayPhoneNumber: phoneNumberId }];
      }
    } else {
      // Caso o usuário não tenha selecionado um telefone no popup da Meta, busca todos os telefones da WABA
      try {
        const phonesRes = await metaService.getWabaPhoneNumbers(wabaId, longLivedToken);
        const list = phonesRes.data?.data || [];
        phoneNumbers = list.map((p: any) => ({
          id: p.id,
          displayPhoneNumber: p.display_phone_number || p.id,
          verifiedName: p.verified_name || "",
        }));
        if (phoneNumbers.length > 0) {
          phoneDisplay = phoneNumbers[0].displayPhoneNumber;
        }
      } catch (phoneErr: any) {
        console.warn(`[Tech Provider] Aviso ao buscar números de telefone da WABA ${wabaId}:`, phoneErr.response?.data || phoneErr.message);
      }
    }

    res.json({ longLivedToken, wabaName, phoneDisplay, phoneNumbers, webhookSubscribed, phoneRegistered });
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

    // Garantia secundária de inscrição de webhook
    try {
      await metaService.subscribeWabaToApp(wabaId, accessToken.trim());
      console.log(`[Tech Provider] Webhook reconfirmado/inscrito com sucesso ao salvar conta ${wabaId}`);
    } catch (subErr: any) {
      console.warn(`[Tech Provider] Aviso ao confirmar webhook para WABA ${wabaId}:`, subErr.response?.data || subErr.message);
    }

    // Garantia secundária de ativação/registro do número na Cloud API
    try {
      const defaultPin = process.env.META_DEFAULT_PIN || "000000";
      await metaService.registerPhoneNumber(phoneNumberId, accessToken.trim(), defaultPin);
      console.log(`[Tech Provider] Número ${phoneNumberId} confirmado/registrado na Cloud API`);
    } catch (regErr: any) {
      console.warn(`[Tech Provider] Aviso ao registrar número ${phoneNumberId} ao salvar:`, regErr.response?.data || regErr.message);
    }

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

    const raw = decryptToken(account.accessToken);
    res.status(201).json({
      ...account,
      accessToken: "[ENCRYPTED]",
      maskedToken: raw ? `${raw.slice(0, 6)}...${raw.slice(-4)}` : ""
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

