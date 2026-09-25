import { Router, Request, Response } from "express";
import ExcelJS from "exceljs";
import { prisma } from "../db";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth";
import { findAccountForUser } from "../utils/accountAccess";
import { getAccountFinancialMetrics } from "../utils/pricing";

const router = Router();
router.use(authMiddleware);

async function getAccount(accountId: string, userId: string) {
  return await findAccountForUser(accountId, userId);
}

// GET /accounts/:accountId/reports/export?type=messages|metrics&period=7days&status=...
router.get("/accounts/:accountId/reports/export", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { type = "messages", period = "7days", status, templateName, startDate, endDate } = req.query;
  const userId = (req as AuthenticatedRequest).userId!;

  const account = await getAccount(accountId, userId);
  if (!account) return res.status(404).json({ error: "Conta não encontrada." });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Send Inteligentte";
  workbook.created = new Date();

  if (type === "messages") {
    // ── Exportação de histórico de mensagens ──────────────────────────────────
    const where: any = { accountId };
    if (status) where.status = status as string;
    if (templateName) where.templateName = templateName as string;

    // Filtro de data por período
    const now = new Date();
    let dateFrom: Date | undefined;
    if (period === "today") {
      dateFrom = new Date(now); dateFrom.setHours(0, 0, 0, 0);
    } else if (period === "yesterday") {
      dateFrom = new Date(now); dateFrom.setDate(dateFrom.getDate() - 1); dateFrom.setHours(0, 0, 0, 0);
      const dateTo = new Date(now); dateTo.setDate(dateTo.getDate() - 1); dateTo.setHours(23, 59, 59, 999);
      where.createdAt = { gte: dateFrom, lte: dateTo };
    } else if (period === "7days") {
      dateFrom = new Date(now); dateFrom.setDate(dateFrom.getDate() - 7);
    } else if (period === "30days") {
      dateFrom = new Date(now); dateFrom.setDate(dateFrom.getDate() - 30);
    } else if (period === "custom" && startDate) {
      dateFrom = new Date(startDate as string);
      if (endDate) {
        const dt = new Date(endDate as string); dt.setHours(23, 59, 59, 999);
        where.createdAt = { gte: dateFrom, lte: dt };
      }
    }
    if (dateFrom && !where.createdAt) where.createdAt = { gte: dateFrom };

    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50_000,
    });

    const sheet = workbook.addWorksheet("Mensagens");
    sheet.columns = [
      { header: "Data", key: "date", width: 22 },
      { header: "Destinatário", key: "to", width: 18 },
      { header: "Template", key: "template", width: 28 },
      { header: "Status", key: "status", width: 14 },
      { header: "Mensagem", key: "body", width: 60 },
      { header: "Erro", key: "error", width: 40 },
    ];

    // Header row styling
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1a1a2e" } };
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

    const STATUS_PT: Record<string, string> = {
      PENDING: "Pendente", SENT: "Enviado", DELIVERED: "Entregue",
      READ: "Lido", FAILED: "Falhou", CANCELLED: "Cancelado",
      RECEIVED: "Recebido", PROCESSING: "Processando",
    };

    for (const msg of messages) {
      sheet.addRow({
        date: new Date(msg.createdAt).toLocaleString("pt-BR"),
        to: msg.to,
        template: msg.templateName ?? "–",
        status: STATUS_PT[msg.status] ?? msg.status,
        body: msg.body ?? "",
        error: msg.errorMessage ?? "",
      });
    }

    // Alternate row coloring
    for (let i = 2; i <= sheet.rowCount; i++) {
      if (i % 2 === 0) {
        sheet.getRow(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
      }
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="mensagens_${accountId.slice(0, 8)}.xlsx"`);
    await workbook.xlsx.write(res);
    return res.end();
  }

  if (type === "metrics") {
    // ── Exportação de métricas ────────────────────────────────────────────────
    const now = new Date();
    const start = new Date();
    const end = new Date();

    if (period === "today") {
      start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);
    } else if (period === "yesterday") {
      start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1); end.setHours(23, 59, 59, 999);
    } else if (period === "7days") {
      start.setDate(start.getDate() - 7); start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);
    } else if (period === "30days") {
      start.setDate(start.getDate() - 30); start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);
    } else if (period === "custom" && startDate) {
      start.setTime(new Date(startDate as string).getTime()); start.setHours(0, 0, 0, 0);
      if (endDate) { end.setTime(new Date(endDate as string).getTime()); end.setHours(23, 59, 59, 999); }
    }

    const [messages, incomingMsgs, optOutsCount, financialMetrics] = await Promise.all([
      prisma.message.findMany({
        where: { accountId, direction: "OUTGOING", messageType: "TEMPLATE", createdAt: { gte: start, lte: end } },
        select: { status: true, createdAt: true, templateName: true, errorMessage: true, to: true },
      }),
      prisma.message.findMany({
        where: { accountId, direction: "INCOMING", createdAt: { gte: start, lte: end } },
        select: { to: true, createdAt: true },
      }),
      prisma.optOut.count({
        where: { accountId, createdAt: { gte: start, lte: end } },
      }),
      getAccountFinancialMetrics(accountId, start, end).catch(() => null),
    ]);

    const periodLabel = `${start.toLocaleDateString("pt-BR")} – ${end.toLocaleDateString("pt-BR")}`;

    let sent = 0, delivered = 0, read = 0, failed = 0;
    let invalidNumbers = 0, frequencyCapped = 0, metaExperiment = 0, otherFailures = 0;

    messages.forEach(m => {
      if (m.status === "READ") { read++; delivered++; sent++; }
      else if (m.status === "DELIVERED") { delivered++; sent++; }
      else if (m.status === "SENT") { sent++; }
      else if (m.status === "FAILED") {
        failed++;
        const err = (m.errorMessage || "").toLowerCase();
        if (err.includes("131026") || err.includes("undeliverable") || err.includes("inválido") || err.includes("sem whatsapp")) {
          invalidNumbers++;
        } else if (err.includes("131049") || err.includes("frequência") || err.includes("healthy ecosystem") || err.includes("frequencia")) {
          frequencyCapped++;
        } else if (err.includes("130472") || err.includes("experiment") || err.includes("experimento")) {
          metaExperiment++;
        } else {
          otherFailures++;
        }
      }
    });

    const total = messages.length;
    const validBase = Math.max(0, total - invalidNumbers);
    const validDeliveryRate = validBase > 0 ? Math.round((delivered / validBase) * 100) : 0;
    const deliveryRate = total > 0 ? Math.round((delivered / total) * 100) : 0;
    const readRate = total > 0 ? Math.round((read / total) * 100) : 0;
    const totalReplies = incomingMsgs.length;
    const uniqueRepliedPhones = new Set(incomingMsgs.map(m => m.to)).size;
    const responseRate = delivered > 0 ? Math.round((uniqueRepliedPhones / delivered) * 100) : 0;
    const optOutRate = delivered > 0 ? ((optOutsCount / delivered) * 100).toFixed(2) : "0.00";

    // ── Sheet 1: Resumo Executivo ──────────────────────────────────────────
    const summarySheet = workbook.addWorksheet("Resumo Executivo", {
      views: [{ showGridLines: true }],
      pageSetup: {
        paperSize: 9, // A4
        orientation: "portrait",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
      },
    });

    summarySheet.columns = [
      { key: "metric", width: 44 },
      { key: "val", width: 22 },
      { key: "note", width: 38 },
    ];

    // Banner de cabeçalho corporativo
    summarySheet.addRow(["SEND INTELIGENTTE • RELATÓRIO EXECUTIVO DE DISPAROS", "", ""]);
    summarySheet.addRow([`Conta: ${account.name} | Período: ${periodLabel} | Emissão: ${new Date().toLocaleDateString("pt-BR")}`, "", ""]);
    summarySheet.addRow(["", "", ""]); // Espaço

    // Seção 1: Funil Comercial de Conversão
    summarySheet.addRow(["📊 FUNIL DE CONVERSÃO & PERFORMANCE", "VALOR", "OBSERVAÇÃO / TAXA"]);
    summarySheet.addRow(["Total de Disparos Solicitados", total, "100% da base processada"]);
    summarySheet.addRow(["Mensagens Enviadas (Meta)", sent, `${total > 0 ? Math.round((sent / total) * 100) : 0}% dos disparos`]);
    summarySheet.addRow(["Mensagens Entregues no Aparelho", delivered, `${deliveryRate}% de entrega bruta`]);
    summarySheet.addRow(["Mensagens Abertas / Lidas", read, `${readRate}% taxa de leitura`]);
    summarySheet.addRow(["Respostas de Clientes (Leads Ativos)", uniqueRepliedPhones, `${responseRate}% taxa de resposta / conversão`]);
    summarySheet.addRow(["Total de Mensagens Recebidas", totalReplies, "Volume total de interações"]);
    summarySheet.addRow(["", "", ""]); // Espaço

    // Seção 2: Diagnóstico Transparente da Base & Falhas
    summarySheet.addRow(["🎯 AUDITORIA DE ENTREGA & BASE VÁLIDA", "VALOR", "DIAGNÓSTICO TÉCNICO"]);
    summarySheet.addRow(["Base Real com WhatsApp Ativo", validBase, "Descontando telefones inexistentes"]);
    summarySheet.addRow(["Taxa Real de Entrega na Base Válida", `${validDeliveryRate}%`, "Aproveitamento real da campanha"]);
    summarySheet.addRow(["Total de Falhas de Envio", failed, "Detalhadas abaixo"]);
    summarySheet.addRow(["  • Números Inválidos / Sem WhatsApp (131026)", invalidNumbers, "Telefone desativado/fixo na lista do cliente"]);
    summarySheet.addRow(["  • Limite de Frequência da Meta (131049)", frequencyCapped, "Destinatário saturado de anúncios (sem custo)"]);
    summarySheet.addRow(["  • Grupo de Teste da Meta (130472)", metaExperiment, "Experimento interno da Meta (sem custo)"]);
    summarySheet.addRow(["  • Outras Falhas / Bloqueios Operacionais", otherFailures, "Falhas pontuais"]);
    summarySheet.addRow(["", "", ""]); // Espaço

    // Seção 3: Saúde da Base & Compliance
    summarySheet.addRow(["🛡️ SAÚDE DA BASE & COMPLIANCE", "VALOR", "AVALIAÇÃO"]);
    summarySheet.addRow(["Pedidos de Descadastro (Opt-Outs)", optOutsCount, "Solicitaram 'SAIR' ou 'PARAR'"]);
    summarySheet.addRow(["Taxa de Rejeição / Descadastro", `${optOutRate}%`, Number(optOutRate) < 1 ? "Excelente saúde da lista (< 1%)" : "Atenção à segmentação"]);
    summarySheet.addRow(["", "", ""]); // Espaço

    // Seção 4: Auditoria Financeira & Meta API
    summarySheet.addRow(["💰 AUDITORIA FINANCEIRA & META API (WHATSAPP)", "VALOR", "DETALHE DE COBRANÇA"]);
    const periodSpentBrl = financialMetrics ? `R$ ${financialMetrics.period.totalSpentBrl.toFixed(2)}` : "R$ 0,00";
    const periodSpentUsd = financialMetrics ? `US$ ${financialMetrics.period.totalSpentUsd.toFixed(2)}` : "US$ 0.00";
    const billedCount = financialMetrics ? financialMetrics.period.totalDeliveredBilled : delivered;
    const freeCount = financialMetrics ? financialMetrics.period.totalFailedFree : failed;
    const savingsBrl = financialMetrics ? `R$ ${financialMetrics.period.savingsFromFailuresBrl.toFixed(2)}` : "R$ 0,00";
    const monthSpentBrl = financialMetrics ? `R$ ${financialMetrics.billingForecast.currentMonthSpentBrl.toFixed(2)}` : "–";
    const monthProjectedBrl = financialMetrics ? `R$ ${financialMetrics.billingForecast.projectedMonthEndCostBrl.toFixed(2)}` : "–";

    summarySheet.addRow(["Gasto Total Estimado no Período", periodSpentBrl, `${periodSpentUsd} tarifados na Meta`]);
    summarySheet.addRow(["Disparos Cobrados (Entregues)", billedCount, "Apenas mensagens entregues geram custo"]);
    summarySheet.addRow(["Disparos Isentos (Falhas / Bloqueios)", freeCount, "Custo R$ 0,00 (Meta não cobra falhas)"]);
    summarySheet.addRow(["Economia Real em Falhas", savingsBrl, "Valor não cobrado pela Meta"]);
    summarySheet.addRow(["Gasto Acumulado Mês Atual", monthSpentBrl, "Ciclo atual de cobrança"]);
    summarySheet.addRow(["Previsão de Fechamento do Mês", monthProjectedBrl, "Projeção com base no ritmo diário"]);

    // Estilização das linhas do Resumo Executivo
    summarySheet.getRow(1).font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
    summarySheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E1B4B" } };
    summarySheet.getRow(2).font = { size: 10, color: { argb: "FF6366F1" }, italic: true };

    const sectionHeaderRows = [4, 12, 20, 25];
    sectionHeaderRows.forEach(r => {
      const row = summarySheet.getRow(r);
      row.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF312E81" } };
    });

    // ── Sheet 2: Breakdown Diário ──────────────────────────────────────────
    const dailySheet = workbook.addWorksheet("Por Dia", {
      views: [{ showGridLines: true }],
      pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 1, orientation: "portrait" },
    });
    dailySheet.columns = [
      { header: "Data", key: "date", width: 16 },
      { header: "Disparadas", key: "sent", width: 14 },
      { header: "Lidas", key: "read", width: 14 },
      { header: "Respostas", key: "replies", width: 14 },
      { header: "Falharam", key: "failed", width: 14 },
    ];
    dailySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    dailySheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E1B4B" } };

    const dailyMap = new Map<string, { sent: number; read: number; failed: number; replies: number }>();
    messages.forEach(m => {
      const d = new Date(m.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!dailyMap.has(key)) dailyMap.set(key, { sent: 0, read: 0, failed: 0, replies: 0 });
      const row = dailyMap.get(key)!;
      if (m.status === "READ") { row.read++; row.sent++; }
      else if (m.status === "DELIVERED" || m.status === "SENT") { row.sent++; }
      else if (m.status === "FAILED") { row.failed++; }
    });

    incomingMsgs.forEach(m => {
      const d = new Date(m.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (dailyMap.has(key)) {
        dailyMap.get(key)!.replies++;
      }
    });

    Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([date, v]) => dailySheet.addRow({ date, ...v }));

    // ── Sheet 3: Por Template ──────────────────────────────────────────────
    const tplSheet = workbook.addWorksheet("Por Template", {
      views: [{ showGridLines: true }],
      pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 1, orientation: "portrait" },
    });
    tplSheet.columns = [
      { header: "Template", key: "name", width: 34 },
      { header: "Categoria", key: "category", width: 18 },
      { header: "Tarifa Meta", key: "unitRate", width: 16 },
      { header: "Total", key: "total", width: 12 },
      { header: "Entregues", key: "delivered", width: 14 },
      { header: "Lidas", key: "read", width: 12 },
      { header: "Taxa Leitura", key: "rate", width: 16 },
      { header: "Falharam (R$ 0)", key: "failed", width: 16 },
      { header: "Total Cobrado (R$)", key: "costBrl", width: 20 },
    ];
    tplSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    tplSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E1B4B" } };

    const tplMap = new Map<string, { total: number; delivered: number; read: number; failed: number }>();
    messages.forEach(m => {
      const name = m.templateName ?? "Envio Direto";
      if (!tplMap.has(name)) tplMap.set(name, { total: 0, delivered: 0, read: 0, failed: 0 });
      const row = tplMap.get(name)!;
      row.total++;
      if (m.status === "READ") { row.read++; row.delivered++; }
      else if (m.status === "DELIVERED") { row.delivered++; }
      else if (m.status === "FAILED") { row.failed++; }
    });

    const costMap = new Map<string, any>();
    if (financialMetrics?.templateCosts) {
      financialMetrics.templateCosts.forEach(tc => costMap.set(tc.templateName, tc));
    }

    Array.from(tplMap.entries())
      .sort(([, a], [, b]) => b.total - a.total)
      .forEach(([name, v]) => {
        const costInfo = costMap.get(name);
        const category = costInfo?.category || "MARKETING";
        const unitRate = costInfo ? `R$ ${costInfo.unitCostBrl.toFixed(2)}` : "R$ 0,36";
        const totalBrl = costInfo ? `R$ ${costInfo.totalCostBrl.toFixed(2)}` : `R$ ${(v.delivered * 0.36).toFixed(2)}`;

        tplSheet.addRow({
          name,
          category,
          unitRate,
          total: v.total,
          delivered: v.delivered,
          read: v.read,
          rate: v.delivered > 0 ? `${Math.round((v.read / v.delivered) * 100)}%` : "0%",
          failed: v.failed,
          costBrl: totalBrl,
        });
      });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="relatorio_executivo_${accountId.slice(0, 8)}.xlsx"`);
    await workbook.xlsx.write(res);
    return res.end();
  }

  res.status(400).json({ error: "Parâmetro 'type' deve ser 'messages' ou 'metrics'." });
});

export default router;
