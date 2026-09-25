interface ExecutiveReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountName: string;
  wabaId?: string;
  phoneNumber?: string;
  periodLabel: string;
  totals: {
    total: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    replies?: number;
    uniqueReplies?: number;
    responseRate?: number;
    validBase?: number;
    validDeliveryRate?: number;
    deliveryRate?: number;
    readRate?: number;
    optOuts?: number;
    optOutRate?: number;
  };
  failureDiagnosis: {
    invalidNumbers: number;
    frequencyCapped: number;
    metaExperiment: number;
    other: number;
  };
  templateMetrics?: Array<{
    templateName: string;
    total: number;
    sent: number;
    delivered?: number;
    read: number;
    failed: number;
    readRate?: number;
  }>;
  costs?: any;
}

export default function ExecutiveReportModal({
  isOpen,
  onClose,
  accountName,
  wabaId,
  phoneNumber,
  periodLabel,
  totals,
  failureDiagnosis,
  templateMetrics = [],
  costs,
}: ExecutiveReportModalProps) {
  if (!isOpen) return null;

  const total = totals.total || 0;
  const delivered = totals.delivered || 0;
  const read = totals.read || 0;
  const failed = totals.failed || 0;
  const replies = totals.uniqueReplies ?? totals.replies ?? 0;
  const invalidNumbers = failureDiagnosis.invalidNumbers || 0;
  const validBase = totals.validBase ?? Math.max(0, total - invalidNumbers);

  const deliveryRate = totals.deliveryRate ?? (total > 0 ? Math.round((delivered / total) * 100) : 0);
  const validDeliveryRate = totals.validDeliveryRate ?? (validBase > 0 ? Math.round((delivered / validBase) * 100) : 0);
  const readRate = totals.readRate ?? (total > 0 ? Math.round((read / total) * 100) : 0);
  const responseRate = totals.responseRate ?? (delivered > 0 ? Math.round((replies / delivered) * 100) : 0);
  const optOuts = totals.optOuts || 0;
  const optOutRate = totals.optOutRate ?? (delivered > 0 ? ((optOuts / delivered) * 100).toFixed(2) : "0.00");

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="report-modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        overflowY: "auto",
      }}
    >
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-executive-report, #printable-executive-report * {
            visibility: visible !important;
          }
          #printable-executive-report {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            min-height: 100% !important;
            margin: 0 !important;
            padding: 8mm 12mm !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .report-modal-overlay {
            position: static !important;
            padding: 0 !important;
            background: none !important;
            backdrop-filter: none !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 6mm;
          }
        }
      `}</style>

      {/* Modal Container */}
      <div
        style={{
          width: "100%",
          maxWidth: "880px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Top Control Bar (Screen only) */}
        <div
          className="no-print"
          style={{
            padding: "14px 24px",
            background: "#1e1b4b",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#fff", fontWeight: "600" }}>
            <span style={{ fontSize: "1.2rem" }}>📄</span>
            <span>Pré-visualização do Relatório Executivo</span>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={handlePrint}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                background: "#6366f1",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: "600",
                fontSize: "0.85rem",
                cursor: "pointer",
                transition: "background 0.2s",
              }}
            >
              <span>🖨️</span> Imprimir / Salvar em PDF
            </button>
            <button
              onClick={onClose}
              style={{
                padding: "8px 14px",
                background: "rgba(255,255,255,0.1)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              ✕ Fechar
            </button>
          </div>
        </div>

        {/* Printable Executive Document Area */}
        <div
          id="printable-executive-report"
          style={{
            backgroundColor: "#ffffff",
            color: "#0f172a",
            padding: "32px 36px",
            overflowY: "auto",
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            lineHeight: 1.4,
          }}
        >
          {/* Header Banner */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              borderBottom: "2px solid #e2e8f0",
              paddingBottom: "14px",
              marginBottom: "18px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                <span style={{ fontSize: "1.5rem" }}>⚡</span>
                <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: "800", color: "#1e1b4b", letterSpacing: "-0.5px" }}>
                  SEND INTELIGENTTE
                </h1>
              </div>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b", fontWeight: "500" }}>
                Relatório Executivo de Disparos • WhatsApp Business API Oficial
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  display: "inline-block",
                  padding: "3px 8px",
                  borderRadius: "5px",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  fontSize: "0.72rem",
                  fontWeight: "700",
                  marginBottom: "3px",
                  textTransform: "uppercase",
                }}
              >
                Oficial & Auditado
              </div>
              <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                Emissão: <strong>{new Date().toLocaleDateString("pt-BR")}</strong>
              </div>
            </div>
          </div>

          {/* Account & Period Meta Card */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "10px 16px",
              marginBottom: "18px",
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px",
              fontSize: "0.82rem",
            }}
          >
            <div>
              <span style={{ color: "#64748b" }}>Conta: </span>
              <strong style={{ color: "#0f172a" }}>{accountName}</strong>
              {wabaId && <span style={{ color: "#94a3b8", fontSize: "0.72rem", marginLeft: "6px" }}>(WABA: {wabaId})</span>}
            </div>
            <div>
              <span style={{ color: "#64748b" }}>Período Analisado: </span>
              <strong style={{ color: "#1e1b4b" }}>{periodLabel}</strong>
            </div>
            {phoneNumber && (
              <div>
                <span style={{ color: "#64748b" }}>Remetente: </span>
                <strong style={{ color: "#0f172a" }}>{phoneNumber}</strong>
              </div>
            )}
          </div>

          {/* KPI Cards Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "10px",
              marginBottom: "18px",
            }}
          >
            {/* Card 1: Total Disparado */}
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: "600", color: "#64748b", textTransform: "uppercase", marginBottom: "3px" }}>
                Total Disparado
              </div>
              <div style={{ fontSize: "1.4rem", fontWeight: "800", color: "#1e1b4b" }}>
                {total.toLocaleString("pt-BR")}
              </div>
              <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "2px" }}>
                100% da base processada
              </div>
            </div>

            {/* Card 2: Entrega Real Base Válida */}
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "12px" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: "600", color: "#166534", textTransform: "uppercase", marginBottom: "3px" }}>
                Entrega Base Válida
              </div>
              <div style={{ fontSize: "1.4rem", fontWeight: "800", color: "#15803d" }}>
                {validDeliveryRate}%
              </div>
              <div style={{ fontSize: "0.7rem", color: "#16a34a", marginTop: "2px" }}>
                {delivered.toLocaleString("pt-BR")} entregues
              </div>
            </div>

            {/* Card 3: Taxa de Leitura */}
            <div style={{ background: "#ecfeff", border: "1px solid #a5f3fc", borderRadius: "8px", padding: "12px" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: "600", color: "#155e75", textTransform: "uppercase", marginBottom: "3px" }}>
                Taxa de Abertura
              </div>
              <div style={{ fontSize: "1.4rem", fontWeight: "800", color: "#0891b2" }}>
                {readRate}%
              </div>
              <div style={{ fontSize: "0.7rem", color: "#0e7490", marginTop: "2px" }}>
                {read.toLocaleString("pt-BR")} mensagens lidas
              </div>
            </div>

            {/* Card 4: Taxa de Resposta / Conversão */}
            <div style={{ background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: "8px", padding: "12px" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: "600", color: "#6b21a8", textTransform: "uppercase", marginBottom: "3px" }}>
                Taxa de Resposta
              </div>
              <div style={{ fontSize: "1.4rem", fontWeight: "800", color: "#7e22ce" }}>
                {responseRate}%
              </div>
              <div style={{ fontSize: "0.7rem", color: "#9333ea", marginTop: "2px" }}>
                {replies.toLocaleString("pt-BR")} leads engajados
              </div>
            </div>
          </div>

          {/* Section: Funil Comercial & Diagnóstico em 2 Colunas */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "18px" }}>
            {/* Coluna 1: Funil Comercial */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "14px", background: "#fff" }}>
              <h3 style={{ margin: "0 0 10px 0", fontSize: "0.9rem", fontWeight: "700", color: "#1e1b4b" }}>
                📊 Funil de Conversão Comercial
              </h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "9px", fontSize: "0.8rem" }}>
                {/* Etapa 1: Disparados */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                    <span>1. Mensagens Disparadas</span>
                    <strong>{total.toLocaleString("pt-BR")} (100%)</strong>
                  </div>
                  <div style={{ height: "6px", background: "#e2e8f0", borderRadius: "3px" }}>
                    <div style={{ width: "100%", height: "100%", background: "#6366f1", borderRadius: "3px" }}></div>
                  </div>
                </div>

                {/* Etapa 2: Entregues no Aparelho */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                    <span>2. Entregues no Celular</span>
                    <strong style={{ color: "#0891b2" }}>{delivered.toLocaleString("pt-BR")} ({deliveryRate}%)</strong>
                  </div>
                  <div style={{ height: "6px", background: "#e2e8f0", borderRadius: "3px" }}>
                    <div style={{ width: `${deliveryRate}%`, height: "100%", background: "#06b6d4", borderRadius: "3px" }}></div>
                  </div>
                </div>

                {/* Etapa 3: Lidas */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                    <span>3. Lidas pelo Destinatário</span>
                    <strong style={{ color: "#16a34a" }}>{read.toLocaleString("pt-BR")} ({readRate}%)</strong>
                  </div>
                  <div style={{ height: "6px", background: "#e2e8f0", borderRadius: "3px" }}>
                    <div style={{ width: `${readRate}%`, height: "100%", background: "#10b981", borderRadius: "3px" }}></div>
                  </div>
                </div>

                {/* Etapa 4: Respostas */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                    <span>4. Respostas (Engajamento / Leads)</span>
                    <strong style={{ color: "#7e22ce" }}>{replies.toLocaleString("pt-BR")} ({responseRate}%)</strong>
                  </div>
                  <div style={{ height: "6px", background: "#e2e8f0", borderRadius: "3px" }}>
                    <div style={{ width: `${Math.min(100, responseRate * 3)}%`, height: "100%", background: "#8b5cf6", borderRadius: "3px" }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna 2: Diagnóstico Assertivo de Falhas & Base Válida */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "14px", background: "#fff" }}>
              <h3 style={{ margin: "0 0 10px 0", fontSize: "0.9rem", fontWeight: "700", color: "#1e1b4b" }}>
                🎯 Diagnóstico & Auditoria da Base
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.8rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px dashed #e2e8f0" }}>
                  <span style={{ color: "#475569" }}>Base com WhatsApp Ativo:</span>
                  <strong style={{ color: "#15803d" }}>{validBase.toLocaleString("pt-BR")} contatos</strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px dashed #e2e8f0" }}>
                  <span style={{ color: "#475569" }}>Taxa de Entrega na Base Válida:</span>
                  <strong style={{ color: "#15803d" }}>{validDeliveryRate}% de eficácia</strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px dashed #e2e8f0" }}>
                  <span style={{ color: "#475569" }}>Total de Não-Entregas:</span>
                  <strong style={{ color: failed > 0 ? "#dc2626" : "#64748b" }}>{failed.toLocaleString("pt-BR")}</strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px dashed #e2e8f0" }}>
                  <span style={{ color: "#dc2626" }}>• Números Inválidos / Sem WhatsApp:</span>
                  <strong style={{ color: "#dc2626" }}>{invalidNumbers} ({total > 0 ? Math.round((invalidNumbers / total) * 100) : 0}%)</strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px dashed #e2e8f0" }}>
                  <span style={{ color: "#d97706" }}>• Limite de Frequência Meta (sem custo):</span>
                  <strong>{failureDiagnosis.frequencyCapped || 0}</strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                  <span style={{ color: "#475569" }}>• Pedidos de Descadastro (Opt-Outs):</span>
                  <strong>{optOuts} ({optOutRate}%)</strong>
                </div>
              </div>

              <div style={{ marginTop: "8px", padding: "6px 8px", background: "#f8fafc", borderRadius: "6px", fontSize: "0.7rem", color: "#64748b" }}>
                ℹ️ <strong>Nota:</strong> Falhas por números inválidos (erro 131026) decorrem de contatos desativados na lista cadastral, protegendo a qualidade do número.
              </div>
            </div>
          </div>

          {/* Section: Auditoria Financeira Meta API */}
          {costs && (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px 14px", background: "#f8fafc", marginBottom: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <h3 style={{ margin: 0, fontSize: "0.88rem", fontWeight: "700", color: "#1e1b4b" }}>
                  💰 Auditoria Financeira & Meta API (WhatsApp Cloud)
                </h3>
                <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                  Tarifas Oficiais Meta: Marketing ~R$ 0,36 | Utilidade ~R$ 0,20
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", fontSize: "0.75rem" }}>
                <div style={{ background: "#fff", padding: "8px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <div style={{ color: "#64748b", fontSize: "0.68rem" }}>Investimento no Período</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#0f172a" }}>
                    R$ {(costs?.period?.totalSpentBrl ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: "0.65rem" }}>
                    US$ {(costs?.period?.totalSpentUsd ?? 0).toFixed(2)}
                  </div>
                </div>

                <div style={{ background: "#fff", padding: "8px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <div style={{ color: "#64748b", fontSize: "0.68rem" }}>Disparos Faturados</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#059669" }}>
                    {(costs?.period?.totalDeliveredBilled ?? delivered).toLocaleString("pt-BR")}
                  </div>
                  <div style={{ color: "#10b981", fontSize: "0.65rem" }}>Apenas entregues</div>
                </div>

                <div style={{ background: "#fff", padding: "8px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <div style={{ color: "#64748b", fontSize: "0.68rem" }}>Falhas Isentas</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#0284c7" }}>
                    {(costs?.period?.totalFailedFree ?? failed).toLocaleString("pt-BR")}
                  </div>
                  <div style={{ color: "#0284c7", fontSize: "0.65rem" }}>Custo R$ 0,00 na Meta</div>
                </div>

                <div style={{ background: "#fff", padding: "8px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <div style={{ color: "#64748b", fontSize: "0.68rem" }}>Previsão Fatura Mês</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#7c3aed" }}>
                    R$ {(costs?.billingForecast?.projectedMonthEndCostBrl ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ color: "#8b5cf6", fontSize: "0.65rem" }}>Projeção mês atual</div>
                </div>
              </div>
            </div>
          )}

          {/* Section: Desempenho por Template */}
          {templateMetrics.length > 0 && (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px 14px", background: "#fff", marginBottom: "14px" }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "0.88rem", fontWeight: "700", color: "#1e1b4b" }}>
                📋 Performance Comparativa & Investimento por Template
              </h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                    <th style={{ padding: "5px 8px", color: "#475569" }}>Template</th>
                    <th style={{ padding: "5px 8px", color: "#475569" }}>Disparados</th>
                    <th style={{ padding: "5px 8px", color: "#475569" }}>Entregues</th>
                    <th style={{ padding: "5px 8px", color: "#475569" }}>Lidos</th>
                    <th style={{ padding: "5px 8px", color: "#475569" }}>Taxa Leitura</th>
                    <th style={{ padding: "5px 8px", color: "#475569" }}>Falhas (R$ 0)</th>
                    <th style={{ padding: "5px 8px", color: "#475569" }}>Custo Estimado</th>
                  </tr>
                </thead>
                <tbody>
                  {templateMetrics.slice(0, 5).map((t, idx) => {
                    const deliveredCount = t.delivered || t.sent || 0;
                    const readRatePct = deliveredCount > 0 ? Math.round((t.read / deliveredCount) * 100) : 0;
                    const matchedCost = costs?.templateCosts?.find((tc: any) => tc.templateName === t.templateName);
                    const costBrl = matchedCost ? matchedCost.totalCostBrl : (deliveredCount * 0.36);

                    return (
                      <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "5px 8px", fontWeight: "600", color: "#0f172a" }}>{t.templateName}</td>
                        <td style={{ padding: "5px 8px" }}>{t.total.toLocaleString("pt-BR")}</td>
                        <td style={{ padding: "5px 8px", color: "#0891b2" }}>{deliveredCount.toLocaleString("pt-BR")}</td>
                        <td style={{ padding: "5px 8px", color: "#15803d" }}>{t.read.toLocaleString("pt-BR")}</td>
                        <td style={{ padding: "5px 8px", fontWeight: "700", color: "#15803d" }}>{readRatePct}%</td>
                        <td style={{ padding: "5px 8px", color: t.failed > 0 ? "#dc2626" : "#64748b" }}>{t.failed}</td>
                        <td style={{ padding: "5px 8px", fontWeight: "700", color: "#0f172a" }}>
                          R$ {costBrl.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer Note */}
          <div
            style={{
              borderTop: "1px solid #e2e8f0",
              paddingTop: "8px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.7rem",
              color: "#94a3b8",
            }}
          >
            <span>Send Inteligentte • Gestão de WhatsApp API Oficial</span>
            <span>Relatório executivo confidencial</span>
          </div>
        </div>
      </div>
    </div>
  );
}
