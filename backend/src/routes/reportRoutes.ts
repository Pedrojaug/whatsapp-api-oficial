import { Router, Request, Response } from "express";
import ExcelJS from "exceljs";
import { prisma } from "../db";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth";
import { findAccountForUser } from "../utils/accountAccess";

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

    const messages = await prisma.message.findMany({
      where: { accountId, createdAt: { gte: start, lte: end } },
      select: { status: true, createdAt: true, templateName: true },
    });

    const periodLabel = `${start.toLocaleDateString("pt-BR")} – ${end.toLocaleDateString("pt-BR")}`;

    // Sheet 1: Resumo
    const summarySheet = workbook.addWorksheet("Resumo");
    summarySheet.columns = [{ header: "Indicador", key: "label", width: 28 }, { header: "Valor", key: "value", width: 14 }];
    summarySheet.getRow(1).font = { bold: true };

    let sent = 0, delivered = 0, read = 0, failed = 0;
    messages.forEach(m => {
      if (m.status === "READ") { read++; delivered++; sent++; }
      else if (m.status === "DELIVERED") { delivered++; sent++; }
      else if (m.status === "SENT") { sent++; }
      else if (m.status === "FAILED") { failed++; }
    });

    summarySheet.addRows([
      { label: "Período", value: periodLabel },
      { label: "Total de mensagens", value: messages.length },
      { label: "Enviadas", value: sent },
      { label: "Entregues", value: delivered },
      { label: "Lidas", value: read },
      { label: "Falharam", value: failed },
      { label: "Taxa de Entrega", value: messages.length > 0 ? `${Math.round((delivered / messages.length) * 100)}%` : "0%" },
      { label: "Taxa de Leitura", value: messages.length > 0 ? `${Math.round((read / messages.length) * 100)}%` : "0%" },
    ]);

    // Sheet 2: Breakdown diário
    const dailySheet = workbook.addWorksheet("Por Dia");
    dailySheet.columns = [
      { header: "Data", key: "date", width: 16 },
      { header: "Enviadas", key: "sent", width: 14 },
      { header: "Lidas", key: "read", width: 14 },
      { header: "Falharam", key: "failed", width: 14 },
    ];
    dailySheet.getRow(1).font = { bold: true };

    const dailyMap = new Map<string, { sent: number; read: number; failed: number }>();
    messages.forEach(m => {
      const d = new Date(m.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!dailyMap.has(key)) dailyMap.set(key, { sent: 0, read: 0, failed: 0 });
      const row = dailyMap.get(key)!;
      if (m.status === "READ") { row.read++; row.sent++; }
      else if (m.status === "DELIVERED" || m.status === "SENT") { row.sent++; }
      else if (m.status === "FAILED") { row.failed++; }
    });

    Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([date, v]) => dailySheet.addRow({ date, ...v }));

    // Sheet 3: Por template
    const tplSheet = workbook.addWorksheet("Por Template");
    tplSheet.columns = [
      { header: "Template", key: "name", width: 32 },
      { header: "Total", key: "total", width: 12 },
      { header: "Enviadas", key: "sent", width: 12 },
      { header: "Lidas", key: "read", width: 12 },
      { header: "Falharam", key: "failed", width: 12 },
      { header: "Taxa Leitura", key: "rate", width: 16 },
    ];
    tplSheet.getRow(1).font = { bold: true };

    const tplMap = new Map<string, { total: number; sent: number; read: number; failed: number }>();
    messages.forEach(m => {
      const name = m.templateName ?? "Envio Direto";
      if (!tplMap.has(name)) tplMap.set(name, { total: 0, sent: 0, read: 0, failed: 0 });
      const row = tplMap.get(name)!;
      row.total++;
      if (m.status === "READ") { row.read++; row.sent++; }
      else if (m.status === "DELIVERED" || m.status === "SENT") { row.sent++; }
      else if (m.status === "FAILED") { row.failed++; }
    });

    Array.from(tplMap.entries())
      .sort(([, a], [, b]) => b.total - a.total)
      .forEach(([name, v]) => tplSheet.addRow({
        name, ...v,
        rate: v.sent > 0 ? `${Math.round((v.read / v.sent) * 100)}%` : "0%",
      }));

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="metricas_${accountId.slice(0, 8)}.xlsx"`);
    await workbook.xlsx.write(res);
    return res.end();
  }

  res.status(400).json({ error: "Parâmetro 'type' deve ser 'messages' ou 'metrics'." });
});

export default router;
