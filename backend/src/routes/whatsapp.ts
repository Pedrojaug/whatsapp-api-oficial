import { Router } from "express";
import accountRouter from "./accountRoutes";
import templateRouter from "./templateRoutes";
import messageRouter from "./messageRoutes";
import contactRouter from "./contactRoutes";
import chatRouter from "./chatRoutes";
import webhookRouter from "./webhookRoutes";
import n8nRouter from "./n8nRoutes";
import oauthRouter from "./oauthRoutes";
import mediaRouter from "./mediaRoutes";
import optoutRouter from "./optoutRoutes";

const router = Router();

// Agrega todos os sub-roteadores modulares sob o mesmo escopo /api
router.use(accountRouter);
router.use(templateRouter);
router.use(messageRouter);
router.use(contactRouter);
router.use(chatRouter);
router.use(webhookRouter);
router.use(n8nRouter);
router.use(oauthRouter);
router.use(mediaRouter);
router.use(optoutRouter);

export default router;
