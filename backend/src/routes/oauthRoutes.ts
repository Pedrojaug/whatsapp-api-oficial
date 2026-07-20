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
  if (!code || !wabaId || !phoneNumberId) {
    return res.status(400).json({ error: "code, wabaId e phoneNumberId são obrigatórios." });
  }

  const appId = process.env.FACEBOOK_APP_ID || "1395411182414690";
  const appSecret = process.env.FACEBOOK_APP_SECRET;

  if (!appSecret) {
    return res.status(500).json({ error: "Segredo do aplicativo do Facebook (FACEBOOK_APP_SECRET) não configurado no servidor." });
  }

  try {
    // 1. Trocar code por token de acesso curto
    const tokenResponse = await metaService.exchangeOAuthToken(code, appId, appSecret, redirectUri || "");
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

    // 4. Buscar nome da WABA e número de telefone para exibição
    let wabaName = `WABA ${wabaId}`;
    let phoneDisplay = phoneNumberId;

    try {
      const wabaRes = await metaService.getWabaInfo(wabaId, longLivedToken);
      if (wabaRes.data.name) wabaName = wabaRes.data.name;
    } catch (_) {}

    try {
      const phoneRes = await metaService.getPhoneInfo(phoneNumberId, longLivedToken);
      if (phoneRes.data.display_phone_number) phoneDisplay = phoneRes.data.display_phone_number;
    } catch (_) {}

    res.json({ longLivedToken, wabaName, phoneDisplay, webhookSubscribed });
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
