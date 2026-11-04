import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useAccount } from "../contexts/AccountContext";
import { hasPermission } from "../utils/permissions";
import { useAlert } from "../contexts/AlertContext";
import { useConfirm } from "../hooks/useConfirm";
import { useSSE } from "../hooks/useSSE";
import { useAuth, API_BASE_URL } from "../contexts/AuthContext";
import { formatMessageStatus, formatPhone, formatDateTime, formatTemplateCategory } from "../utils/formatters";
import { formatBRL, getTemplateUnitCost } from "../utils/pricing";
import PhoneSimulator from "../components/PhoneSimulator";
import SegmentedControl from "../components/SegmentedControl";
import { RefreshCw, Search } from "lucide-react";

function ModalPortal({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body);
}

interface Template {
  id: string;
  metaId: string | null;
  name: string;
  language: string;
  category: string;
  status: string;
  components: any;
}

interface MessageLog {
  id: string;
  wamid: string | null;
  to: string;
  status: string;
  errorMessage: string | null;
  templateName: string | null;
  messageType?: string;
  body?: string | null;
  variables: any;
  createdAt: string;
}

export default function MessagesPage() {
  const { token } = useAuth();
  const { selectedAccount } = useAccount();
  // Visualizador acompanha os logs, mas não dispara nem mexe em agendamentos.
  const canDispatch = hasPermission(selectedAccount?.accountRole, "dispatch");
  const { showAlert } = useAlert();
  const confirm = useConfirm();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([]);
  const [messagesSearch, setMessagesSearch] = useState("");
  const [messagesStatus, setMessagesStatus] = useState("");
  const [messagesTemplateFilter, setMessagesTemplateFilter] = useState("");
  const [messagesPage, setMessagesPage] = useState(1);
  const [messagesLimit] = useState(25);
  const [totalMessages, setTotalMessages] = useState(0);
  const [loading, setLoading] = useState(false);

  // Lists & Media selections
  const [contactLists, setContactLists] = useState<any[]>([]);
  const [listTagFilter, setListTagFilter] = useState("");
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [mediaAssets, setMediaAssets] = useState<any[]>([]);
  const [, setLoadingMedia] = useState(false);
  const [showMediaSelectModal, setShowMediaSelectModal] = useState(false);
  const [mediaSelectCallback, setMediaSelectCallback] = useState<((url: string) => void) | null>(null);

  // Manual Send Message States
  const [selectedTemplateName, setSelectedTemplateName] = useState("");
  const [recipientNumber, setRecipientNumber] = useState("");
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);
  const [messageMediaUrl, setMessageMediaUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  // Bulk / single sender states
  const [recipientType, setRecipientType] = useState<"single" | "list">("single");
  const [selectedListId, setSelectedListId] = useState("");
  const [variableMappings, setVariableMappings] = useState<string[]>([]);

  // XLSX and Scheduled Messages states
  const [logsView, setLogsView] = useState<"recent" | "scheduled">("recent");
  const [scheduledMessages, setScheduledMessages] = useState<any[]>([]);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");

  const fetchTemplates = async (accountId: string) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/accounts/${accountId}/templates`);
      setTemplates(res.data);
    } catch (err: any) {
      console.error("Erro ao buscar templates:", err);
    }
  };

  const fetchContactLists = async (accountId: string) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/accounts/${accountId}/lists`);
      setContactLists(res.data);
    } catch (err: any) {
      console.error("Erro ao buscar listas de contatos:", err);
    }
  };

  const fetchMedia = async (accountId: string) => {
    setLoadingMedia(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/accounts/${accountId}/media`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      setMediaAssets(res.data);
    } catch (err: any) {
      console.error("Erro ao buscar mídias:", err);
    } finally {
      setLoadingMedia(false);
    }
  };

  const fetchMessages = async (
    accountId: string,
    page = 1,
    search = "",
    status = "",
    template = ""
  ) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/accounts/${accountId}/messages`, {
        params: {
          page,
          limit: messagesLimit,
          search,
          status,
          templateName: template,
        },
      });

      if (res.data && Array.isArray(res.data.messages)) {
        setMessageLogs(res.data.messages);
        setTotalMessages(res.data.total);
      } else {
        setMessageLogs(res.data);
        setTotalMessages(res.data.length);
      }
    } catch (err: any) {
      console.error("Erro ao buscar logs de mensagens:", err);
    }
  };

  const fetchScheduledMessages = async (accountId: string) => {
    setLoadingScheduled(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/accounts/${accountId}/scheduled`);
      setScheduledMessages(res.data);
    } catch (err) {
      console.error("Erro ao buscar mensagens agendadas:", err);
    } finally {
      setLoadingScheduled(false);
    }
  };

  const handleCancelScheduled = async (messageId: string) => {
    if (!selectedAccount) return;
    const ok = await confirm({
      title: "Cancelar este disparo agendado?",
      description: "A mensagem não será enviada e o agendamento é excluído.",
      confirmLabel: "Cancelar disparo",
      cancelLabel: "Manter",
      tone: "danger",
    });
    if (!ok) return;

    try {
      showAlert("Cancelando agendamento...");
      await axios.delete(`${API_BASE_URL}/accounts/${selectedAccount.id}/scheduled/${messageId}`);
      showAlert("Agendamento cancelado com sucesso!", "success");
      fetchScheduledMessages(selectedAccount.id);
      fetchMessages(selectedAccount.id, messagesPage, messagesSearch, messagesStatus, messagesTemplateFilter);
    } catch (err: any) {
      showAlert(err.response?.data?.error || "Erro ao cancelar agendamento", "error");
    }
  };

  const handleReschedule = async (messageId: string) => {
    if (!selectedAccount || !rescheduleDate) return;
    try {
      showAlert("Reagendando...");
      await axios.post(`${API_BASE_URL}/accounts/${selectedAccount.id}/scheduled/${messageId}/reschedule`, {
        scheduledAt: rescheduleDate
      });
      showAlert("Mensagem reagendada com sucesso!", "success");
      setShowRescheduleModal(null);
      setRescheduleDate("");
      fetchScheduledMessages(selectedAccount.id);
      fetchMessages(selectedAccount.id, messagesPage, messagesSearch, messagesStatus, messagesTemplateFilter);
    } catch (err: any) {
      showAlert(err.response?.data?.error || "Erro ao reagendar mensagem", "error");
    }
  };

  const getVariablesCount = (bodyText: string) => {
    const matches = bodyText.match(/\{\{\d+\}\}/g);
    return matches ? new Set(matches).size : 0;
  };

  const handleTemplateSelectionChange = (name: string) => {
    setSelectedTemplateName(name);
    setMessageMediaUrl("");
    const tmpl = templates.find((t) => t.name === name);
    if (tmpl) {
      const bodyComp = Array.isArray(tmpl.components) ? tmpl.components.find((c: any) => c.type === "BODY") : null;
      const varCount = bodyComp ? getVariablesCount(bodyComp.text) : 0;
      setTemplateVariables(Array(varCount).fill(""));
      setVariableMappings(Array(varCount).fill("STATIC_VALUE"));
    } else {
      setTemplateVariables([]);
      setVariableMappings([]);
    }
  };

  const handleVariableChange = (index: number, val: string) => {
    const updated = [...templateVariables];
    updated[index] = val;
    setTemplateVariables(updated);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    if (!selectedTemplateName) {
      showAlert("Selecione o template.", "error");
      return;
    }

    const tmpl = templates.find((t) => t.name === selectedTemplateName);
    const headerComp = tmpl?.components?.find((c: any) => c.type === "HEADER");
    const hasMedia = headerComp && ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerComp.format);
    if (hasMedia && !messageMediaUrl.trim()) {
      showAlert(`Este template exige uma URL de mídia (${headerComp.format}).`, "error");
      return;
    }

    if (recipientType === "single") {
      if (!recipientNumber) {
        showAlert("Insira o telefone destinatário.", "error");
        return;
      }
      setLoading(true);
      try {
        await axios.post(`${API_BASE_URL}/accounts/${selectedAccount.id}/messages/send`, {
          to: recipientNumber.replace(/\D/g, ""),
          templateName: selectedTemplateName,
          variables: templateVariables,
          mediaUrl: messageMediaUrl || undefined,
          scheduledAt: scheduledAt || undefined,
        });

        if (scheduledAt) {
          showAlert("Mensagem agendada com sucesso!", "success");
        } else {
          showAlert("Mensagem enviada com sucesso!", "success");
        }

        setRecipientNumber("");
        setSelectedTemplateName("");
        setTemplateVariables([]);
        setMessageMediaUrl("");
        setScheduledAt("");
        fetchMessages(selectedAccount.id);
      } catch (err: any) {
        const metaMsg = err.response?.data?.details?.error?.message || err.response?.data?.details?.message;
        const friendly = err.response?.data?.error || "Falha no envio.";
        const detail = metaMsg ? `\n\nDetalhe da Meta: ${metaMsg}` : "";
        showAlert(`${friendly}${detail}`, "error");
        fetchMessages(selectedAccount.id);
      } finally {
        setLoading(false);
      }
    } else {
      if (!selectedListId) {
        showAlert("Selecione a lista de contatos destinatária.", "error");
        return;
      }
      setLoading(true);
      try {
        const mappedVars = variableMappings.map((m) => {
          if (m.startsWith("STATIC:")) {
            return m.replace("STATIC:", "");
          }
          if (m === "STATIC_VALUE") {
            return "";
          }
          return m;
        });

        await axios.post(`${API_BASE_URL}/accounts/${selectedAccount.id}/lists/${selectedListId}/send`, {
          templateName: selectedTemplateName,
          variables: mappedVars,
          mediaUrl: messageMediaUrl || undefined,
          scheduledAt: scheduledAt || undefined,
        });

        if (scheduledAt) {
          showAlert("Disparo em lote agendado com sucesso!", "success");
        } else {
          showAlert("Disparo em lote iniciado com sucesso!", "success");
        }

        setSelectedTemplateName("");
        setTemplateVariables([]);
        setVariableMappings([]);
        setMessageMediaUrl("");
        setSelectedListId("");
        setScheduledAt("");
        
        setTimeout(() => fetchMessages(selectedAccount.id), 1000);
      } catch (err: any) {
        const details = err.response?.data?.error || "Erro desconhecido";
        showAlert(`Falha ao iniciar disparo em lote: ${details}`, "error");
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (selectedAccount) {
      fetchTemplates(selectedAccount.id);
      fetchContactLists(selectedAccount.id);
      fetchMessages(selectedAccount.id, messagesPage, messagesSearch, messagesStatus, messagesTemplateFilter);
      fetchScheduledMessages(selectedAccount.id);
      fetchMedia(selectedAccount.id);
    } else {
      setTemplates([]);
      setContactLists([]);
      setMessageLogs([]);
      setScheduledMessages([]);
      setMediaAssets([]);
    }
  }, [selectedAccount]);

  // Coalesce de refetch: durante um disparo em massa chegam centenas de
  // eventos SSE; sem isto cada um refazia buscas completas (auto-DDoS).
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefetch = () => {
    if (refetchTimer.current || !selectedAccount) return;
    refetchTimer.current = setTimeout(() => {
      refetchTimer.current = null;
      if (selectedAccount) {
        fetchMessages(selectedAccount.id, messagesPage, messagesSearch, messagesStatus, messagesTemplateFilter);
      }
    }, 4000);
  };

  // Se inscreve em atualizações SSE em tempo real
  useSSE((data: any) => {
    if (!selectedAccount) return;

    if (data.type === "messageUpdated") {
      setMessageLogs((prevLogs) => {
        const index = prevLogs.findIndex((log) => log.id === data.messageId);
        if (index !== -1) {
          const updated = [...prevLogs];
          updated[index] = {
            ...updated[index],
            status: data.status,
            wamid: data.wamid !== undefined ? data.wamid : updated[index].wamid,
            errorMessage: data.errorMessage !== undefined ? data.errorMessage : updated[index].errorMessage,
          };
          return updated;
        }
        // Novo envio fora da página atual — agenda um refetch coalescido
        scheduleRefetch();
        return prevLogs;
      });
    }
  });

  // Filtros do histórico aplicam na hora (sem botão "Filtrar"); a busca aplica com Enter.
  const applyLogFilters = (overrides: Partial<{ search: string; status: string; template: string }> = {}) => {
    if (!selectedAccount) return;
    setMessagesPage(1);
    fetchMessages(
      selectedAccount.id,
      1,
      overrides.search ?? messagesSearch,
      overrides.status ?? messagesStatus,
      overrides.template ?? messagesTemplateFilter
    );
  };
  const hasLogFilters = !!(messagesSearch || messagesStatus || messagesTemplateFilter);

  const exportLogs = async () => {
    if (!selectedAccount) return;
    setExportingXlsx(true);
    try {
      const res = await axios.get(
        `${API_BASE_URL}/accounts/${selectedAccount.id}/reports/export?type=messages&period=30days`,
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mensagens_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showAlert("Erro ao exportar a planilha.", "error");
    } finally {
      setExportingXlsx(false);
    }
  };

  const selectedTemplate = templates.find((t) => t.name === selectedTemplateName);
  const mediaHeader = selectedTemplate?.components?.find((c: any) => c.type === "HEADER");
  const needsMedia = !!mediaHeader && ["IMAGE", "VIDEO", "DOCUMENT"].includes(mediaHeader.format);

  const costPreview = (() => {
    if (!selectedTemplateName) return null;
    const { brl: unitRate, category } = getTemplateUnitCost(selectedTemplate?.category);
    const selList = recipientType === "list" ? contactLists.find((l) => l.id === selectedListId) : null;
    const count = recipientType === "single" ? 1 : (selList?.contactCount ?? selList?._count?.contacts ?? 0);
    return { unitRate, category, count, total: count * unitRate };
  })();

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div>
        <h1 className="page-heading">Disparos &amp; Logs</h1>
        <p className="page-subheading">Envie um template para um número ou uma lista e acompanhe a entrega de cada mensagem.</p>
      </div>

      {/* ── Novo disparo: formulário + prévia lado a lado ── */}
      <section className="glass panel send-panel" aria-labelledby="send-title">
        <div className="panel__header">
          <h2 id="send-title" className="panel__title">Novo disparo</h2>
          {!canDispatch && <span className="panel__hint">Seu cargo (Visualizador) permite apenas acompanhar os disparos.</span>}
        </div>

        <div className="send-panel__body">
          <form onSubmit={handleSendMessage} className="send-form">
            <div className="send-form__row">
              <div className="field">
                <label htmlFor="send-template" className="field-label">Template</label>
                <select id="send-template" value={selectedTemplateName} onChange={(e) => handleTemplateSelectionChange(e.target.value)} className="field-input">
                  <option value="">Selecione um template aprovado</option>
                  {templates.filter((t) => t.status === "APPROVED").map((t) => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <span id="send-recipient-type" className="field-label">Enviar para</span>
                <SegmentedControl
                  ariaLabel="Tipo de destinatário"
                  value={recipientType}
                  onChange={setRecipientType}
                  options={[
                    { value: "single", label: "Um número" },
                    { value: "list", label: "Lista de contatos" },
                  ]}
                />
              </div>
            </div>

            {recipientType === "single" ? (
              <div className="field">
                <label htmlFor="send-number" className="field-label">Celular com DDI e DDD</label>
                <input
                  id="send-number"
                  type="tel"
                  inputMode="numeric"
                  placeholder="Ex.: 5511999999999"
                  value={recipientNumber}
                  onChange={(e) => setRecipientNumber(e.target.value)}
                  className="field-input"
                />
              </div>
            ) : (
              <div className="send-form__row">
                <div className="field">
                  <label htmlFor="send-list" className="field-label">Lista</label>
                  <select id="send-list" value={selectedListId} onChange={(e) => setSelectedListId(e.target.value)} className="field-input">
                    <option value="">Selecione uma lista</option>
                    {contactLists
                      .filter((list) => !listTagFilter || (list.tags && list.tags.includes(listTagFilter)))
                      .map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.name} ({list._count?.contacts || 0} contatos)
                        </option>
                      ))}
                  </select>
                </div>
                {(() => {
                  const allTags = Array.from(new Set(contactLists.flatMap((l) => l.tags || []))) as string[];
                  return allTags.length > 0 ? (
                    <div className="field">
                      <label htmlFor="send-list-tag" className="field-label">Filtrar listas por etiqueta</label>
                      <select id="send-list-tag" value={listTagFilter} onChange={(e) => { setListTagFilter(e.target.value); setSelectedListId(""); }} className="field-input">
                        <option value="">Todas as etiquetas</option>
                        {allTags.map((tag) => (
                          <option key={tag} value={tag}>#{tag}</option>
                        ))}
                      </select>
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            {needsMedia && (
              <div className="field">
                <label htmlFor="send-media" className="field-label">Mídia do cabeçalho ({mediaHeader.format === "IMAGE" ? "imagem" : mediaHeader.format === "VIDEO" ? "vídeo" : "documento"})</label>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <input
                    id="send-media"
                    type="url"
                    placeholder={`https://site.com/arquivo.${mediaHeader.format === "IMAGE" ? "jpg" : mediaHeader.format === "VIDEO" ? "mp4" : "pdf"}`}
                    value={messageMediaUrl}
                    onChange={(e) => setMessageMediaUrl(e.target.value)}
                    className="field-input"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setMediaSelectCallback(() => (url: string) => setMessageMediaUrl(url));
                      if (selectedAccount) fetchMedia(selectedAccount.id);
                      setShowMediaSelectModal(true);
                    }}
                    className="btn btn-secondary"
                  >
                    Galeria
                  </button>
                </div>
              </div>
            )}

            {templateVariables.length > 0 && (
              <fieldset className="send-form__vars">
                <legend className="field-label">Variáveis do template</legend>
                {recipientType === "list" && (
                  <p className="field-hint" style={{ margin: 0 }}>Var 1, 2 e 3 são as colunas extras da lista (além de nome e telefone).</p>
                )}
                <div className="send-form__vars-grid">
                  {templateVariables.map((variable, idx) => {
                    if (recipientType === "single") {
                      return (
                        <div key={idx} className="field">
                          <label htmlFor={`send-var-${idx}`} className="send-form__var-label">{"{{" + (idx + 1) + "}}"}</label>
                          <input
                            id={`send-var-${idx}`}
                            type="text"
                            placeholder={`Valor para {{${idx + 1}}}`}
                            value={variable}
                            onChange={(e) => handleVariableChange(idx, e.target.value)}
                            className="field-input"
                          />
                        </div>
                      );
                    }
                    const mapping = variableMappings[idx] || "STATIC_VALUE";
                    const isStatic = mapping.startsWith("STATIC:") || mapping === "STATIC_VALUE";
                    const staticVal = mapping.startsWith("STATIC:") ? mapping.replace("STATIC:", "") : "";
                    return (
                      <div key={idx} className="field">
                        <label htmlFor={`send-map-${idx}`} className="send-form__var-label">{"{{" + (idx + 1) + "}}"}</label>
                        <select
                          id={`send-map-${idx}`}
                          value={isStatic ? "STATIC_VALUE" : mapping}
                          onChange={(e) => {
                            const val = e.target.value;
                            const updated = [...variableMappings];
                            updated[idx] = val === "STATIC_VALUE" ? "STATIC:" : val;
                            setVariableMappings(updated);
                          }}
                          className="field-input"
                        >
                          <option value="STATIC_VALUE">Valor fixo</option>
                          <option value="CONTACT_NAME">Nome do contato</option>
                          <option value="CONTACT_PHONE">Telefone do contato</option>
                          <option value="CONTACT_VAR_1">Coluna var1 da lista</option>
                          <option value="CONTACT_VAR_2">Coluna var2 da lista</option>
                          <option value="CONTACT_VAR_3">Coluna var3 da lista</option>
                        </select>
                        {isStatic && (
                          <input
                            type="text"
                            aria-label={`Valor fixo para {{${idx + 1}}}`}
                            placeholder="Digite o valor fixo"
                            value={staticVal}
                            onChange={(e) => {
                              const updated = [...variableMappings];
                              updated[idx] = `STATIC:${e.target.value}`;
                              setVariableMappings(updated);
                            }}
                            className="field-input"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {selectedTemplateName && (
              <div className="send-form__schedule">
                <label htmlFor="enable-scheduling-checkbox" className="send-form__check">
                  <input
                    type="checkbox"
                    id="enable-scheduling-checkbox"
                    checked={!!scheduledAt}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const initDate = new Date();
                        initDate.setHours(initDate.getHours() + 1);
                        initDate.setMinutes(0);
                        const pad = (n: number) => String(n).padStart(2, "0");
                        setScheduledAt(`${initDate.getFullYear()}-${pad(initDate.getMonth() + 1)}-${pad(initDate.getDate())}T${pad(initDate.getHours())}:${pad(initDate.getMinutes())}`);
                      } else {
                        setScheduledAt("");
                      }
                    }}
                  />
                  Agendar para depois
                </label>
                {scheduledAt && (
                  <input
                    type="datetime-local"
                    aria-label="Data e hora do envio"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    min={(() => {
                      const now = new Date();
                      const pad = (n: number) => String(n).padStart(2, "0");
                      return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
                    })()}
                    className="field-input"
                    style={{ width: "auto" }}
                    required
                  />
                )}
              </div>
            )}

            {/* Rodapé: custo estimado + ação */}
            <div className="send-form__footer">
              {costPreview ? (
                <div className="send-cost" aria-live="polite">
                  <span className="send-cost__label">Custo estimado na Meta</span>
                  <span className="send-cost__value">{formatBRL(costPreview.total)}</span>
                  <span className="send-cost__detail">
                    {costPreview.count.toLocaleString("pt-BR")} {costPreview.count === 1 ? "destinatário" : "destinatários"} × {formatBRL(costPreview.unitRate)} · {formatTemplateCategory(costPreview.category)} · falhas não são cobradas
                  </span>
                </div>
              ) : (
                <span className="send-cost__detail">Escolha um template para ver a prévia e o custo.</span>
              )}
              <button type="submit" disabled={loading || !selectedAccount || !canDispatch} className="btn btn-primary send-form__submit">
                {loading
                  ? (scheduledAt ? "Agendando..." : "Enviando...")
                  : scheduledAt
                  ? "Agendar disparo"
                  : recipientType === "single" ? "Enviar mensagem" : "Iniciar disparo em lote"}
              </button>
            </div>
          </form>

          {/* Prévia */}
          <aside className="send-preview" aria-label="Prévia da mensagem">
            {selectedTemplate ? (() => {
              const componentsList = Array.isArray(selectedTemplate.components) ? selectedTemplate.components : [];
              const bodyComp = componentsList.find((c: any) => c.type === "BODY");
              const headerComp = componentsList.find((c: any) => c.type === "HEADER");
              const footerComp = componentsList.find((c: any) => c.type === "FOOTER");
              const buttonsComp = componentsList.find((c: any) => c.type === "BUTTONS");
              const resolvedPreviewVars = recipientType === "list"
                ? templateVariables.map((_, idx) => {
                    const mapping = variableMappings[idx] || "STATIC_VALUE";
                    if (mapping.startsWith("STATIC:")) return mapping.replace("STATIC:", "");
                    if (mapping === "CONTACT_NAME") return "[Nome]";
                    if (mapping === "CONTACT_PHONE") return "[Telefone]";
                    if (mapping === "CONTACT_VAR_1") return "[Var 1]";
                    if (mapping === "CONTACT_VAR_2") return "[Var 2]";
                    if (mapping === "CONTACT_VAR_3") return "[Var 3]";
                    return `{{${idx + 1}}}`;
                  })
                : templateVariables;
              return (
                <PhoneSimulator
                  headerFormat={headerComp ? headerComp.format : "NONE"}
                  headerText={headerComp ? headerComp.text : ""}
                  mediaUrl={messageMediaUrl}
                  bodyText={bodyComp ? bodyComp.text : ""}
                  variables={resolvedPreviewVars}
                  footerText={footerComp ? footerComp.text : ""}
                  buttons={buttonsComp ? buttonsComp.buttons : []}
                  businessName={selectedAccount?.name}
                />
              );
            })() : (
              <div className="send-preview__empty">
                <span aria-hidden="true">📱</span>
                A prévia da mensagem aparece aqui quando você escolhe um template.
              </div>
            )}
          </aside>
        </div>
      </section>

      {/* ── Histórico ── */}
      <section className="glass panel" aria-labelledby="logs-title">
        <div className="panel__header">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", flexWrap: "wrap" }}>
            <h2 id="logs-title" className="panel__title">Histórico</h2>
            <SegmentedControl
              ariaLabel="Tipo de histórico"
              value={logsView}
              onChange={(v) => {
                setLogsView(v);
                if (v === "scheduled" && selectedAccount) fetchScheduledMessages(selectedAccount.id);
              }}
              options={[
                { value: "recent", label: "Enviadas" },
                { value: "scheduled", label: "Agendadas" },
              ]}
            />
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
            {logsView === "recent" && (
              <button type="button" disabled={exportingXlsx || !selectedAccount} onClick={exportLogs} className="btn btn-secondary btn-sm">
                {exportingXlsx ? "Exportando..." : "Exportar planilha"}
              </button>
            )}
            <button
              type="button"
              className="icon-action"
              aria-label={logsView === "recent" ? "Atualizar histórico" : "Atualizar agendamentos"}
              title="Atualizar"
              onClick={() => {
                if (!selectedAccount) return;
                if (logsView === "recent") fetchMessages(selectedAccount.id, messagesPage, messagesSearch, messagesStatus, messagesTemplateFilter);
                else fetchScheduledMessages(selectedAccount.id);
              }}
            >
              <RefreshCw size={15} aria-hidden="true" />
            </button>
          </div>
        </div>

        {logsView === "recent" ? (
          <>
            <div className="logs-filters" role="search" aria-label="Filtrar histórico">
              <div className="field-with-icon logs-filters__search">
                <Search size={15} aria-hidden="true" />
                <label htmlFor="logs-search" className="sr-only">Buscar por número ou template</label>
                <input
                  id="logs-search"
                  type="search"
                  placeholder="Buscar por número ou template (Enter)"
                  value={messagesSearch}
                  onChange={(e) => setMessagesSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") applyLogFilters(); }}
                  className="field-input"
                />
              </div>
              <label htmlFor="logs-status" className="sr-only">Status</label>
              <select
                id="logs-status"
                value={messagesStatus}
                onChange={(e) => { setMessagesStatus(e.target.value); applyLogFilters({ status: e.target.value }); }}
                className="field-input logs-filters__select"
              >
                <option value="">Todos os status</option>
                <option value="PENDING">Pendente</option>
                <option value="SENT">Enviada</option>
                <option value="DELIVERED">Entregue</option>
                <option value="READ">Lida</option>
                <option value="FAILED">Falhou</option>
              </select>
              <label htmlFor="logs-template" className="sr-only">Template</label>
              <select
                id="logs-template"
                value={messagesTemplateFilter}
                onChange={(e) => { setMessagesTemplateFilter(e.target.value); applyLogFilters({ template: e.target.value }); }}
                className="field-input logs-filters__select"
              >
                <option value="">Todos os templates</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
              {hasLogFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setMessagesSearch("");
                    setMessagesStatus("");
                    setMessagesTemplateFilter("");
                    applyLogFilters({ search: "", status: "", template: "" });
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  Limpar filtros
                </button>
              )}
            </div>

            {messageLogs.length === 0 ? (
              <p className="panel__empty">{hasLogFilters ? "Nenhuma mensagem com esses filtros." : "Nenhuma mensagem enviada por esta conta."}</p>
            ) : (
              <>
                <div className="table-scroll-container" tabIndex={0} role="region" aria-label="Mensagens enviadas">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Destinatário</th>
                        <th scope="col">Template</th>
                        <th scope="col">Data e hora</th>
                        <th scope="col">Status</th>
                        <th scope="col">Erro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {messageLogs.map((log) => (
                        <tr key={log.id} title={log.wamid ? `ID da mensagem na Meta: ${log.wamid}` : undefined}>
                          <td style={{ fontWeight: 600, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{formatPhone(log.to)}</td>
                          <td>
                            {log.templateName || (
                              <span className="logs-chat-tag" title={log.body || "Mensagem de texto livre enviada pelo chat"}>
                                Resposta no chat{log.variables?.sentBy === "SDR" ? " (bot)" : ""}
                              </span>
                            )}
                          </td>
                          <td style={{ color: "var(--text-secondary)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{formatDateTime(log.createdAt)}</td>
                          <td>
                            <span className={`badge badge-${log.status.toLowerCase()}`}>{formatMessageStatus(log.status)}</span>
                          </td>
                          <td className="logs-error">
                            {log.errorMessage ? <span title={log.errorMessage}>{log.errorMessage}</span> : <span aria-label="Sem erro">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {(() => {
                  const totalPages = Math.max(1, Math.ceil(totalMessages / messagesLimit));
                  const goTo = (p: number) => {
                    setMessagesPage(p);
                    if (selectedAccount) fetchMessages(selectedAccount.id, p, messagesSearch, messagesStatus, messagesTemplateFilter);
                  };
                  const pageNumbers: (number | "...")[] = [];
                  for (let p = 1; p <= totalPages; p++) {
                    if (p === 1 || p === totalPages || Math.abs(p - messagesPage) <= 1) pageNumbers.push(p);
                    else if (pageNumbers[pageNumbers.length - 1] !== "...") pageNumbers.push("...");
                  }
                  return (
                    <nav className="pager" aria-label="Paginação do histórico">
                      <span className="pager__info">
                        {totalMessages === 0 ? "Nenhum registro" : `${((messagesPage - 1) * messagesLimit) + 1}–${Math.min(messagesPage * messagesLimit, totalMessages)} de ${totalMessages.toLocaleString("pt-BR")}`}
                      </span>
                      <div className="pager__buttons">
                        <button aria-label="Página anterior" disabled={messagesPage === 1} onClick={() => goTo(messagesPage - 1)} className="pager__btn">‹</button>
                        {pageNumbers.map((p, i) =>
                          p === "..." ? (
                            <span key={`e-${i}`} className="pager__ellipsis" aria-hidden="true">…</span>
                          ) : (
                            <button
                              key={p}
                              onClick={() => goTo(p as number)}
                              className={`pager__btn${p === messagesPage ? " is-active" : ""}`}
                              aria-current={p === messagesPage ? "page" : undefined}
                              aria-label={`Página ${p}`}
                            >{p}</button>
                          )
                        )}
                        <button aria-label="Próxima página" disabled={messagesPage >= totalPages} onClick={() => goTo(messagesPage + 1)} className="pager__btn">›</button>
                      </div>
                    </nav>
                  );
                })()}
              </>
            )}
          </>
        ) : loadingScheduled ? (
          <p className="panel__empty">Carregando agendamentos...</p>
        ) : scheduledMessages.length === 0 ? (
          <p className="panel__empty">Nenhum disparo agendado.</p>
        ) : (
          <div className="table-scroll-container" tabIndex={0} role="region" aria-label="Disparos agendados">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Destinatário</th>
                  <th scope="col">Template</th>
                  <th scope="col">Envio previsto</th>
                  {canDispatch && <th scope="col" style={{ textAlign: "right" }}>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {scheduledMessages.map((msg) => (
                  <tr key={msg.id}>
                    <td style={{ fontWeight: 600, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{formatPhone(msg.to)}</td>
                    <td>{msg.templateName}</td>
                    <td style={{ color: "var(--text-secondary)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{formatDateTime(msg.scheduledAt)}</td>
                    {canDispatch && (
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: "var(--space-1-5)" }}>
                          <button
                            type="button"
                            onClick={() => {
                              const date = new Date(msg.scheduledAt);
                              const pad = (n: number) => String(n).padStart(2, "0");
                              setRescheduleDate(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`);
                              setShowRescheduleModal(msg.id);
                            }}
                            className="btn btn-secondary btn-sm"
                          >
                            Reagendar
                          </button>
                          <button type="button" onClick={() => handleCancelScheduled(msg.id)} className="btn btn-danger btn-sm">
                            Cancelar
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Reschedule Modal */}
      {showRescheduleModal !== null && (
        <ModalPortal>
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
            <div className="glass fade-in" style={{ width: "420px", maxWidth: "90vw", display: "flex", flexDirection: "column", borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 28px", borderBottom: "1px solid var(--border-color)" }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>📅</span> Reagendar Mensagem
                </h3>
                <button type="button" onClick={() => { setShowRescheduleModal(null); setRescheduleDate(""); }} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.2rem", cursor: "pointer", opacity: 0.8 }}>✕</button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); if (showRescheduleModal) handleReschedule(showRescheduleModal); }} style={{ padding: "24px 30px", display: "flex", flexDirection: "column", gap: "18px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>Nova Data e Hora de Envio</label>
                  <input
                    type="datetime-local"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    min={(() => {
                      const now = new Date();
                      const pad = (n: number) => String(n).padStart(2, "0");
                      return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
                    })()}
                    className="field-input"
                    style={{ padding: "10px", borderRadius: "var(--radius-md)", fontSize: "0.9rem" }}
                    required
                  />
                </div>

                <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "10px" }}>
                  <button type="button" onClick={() => { setShowRescheduleModal(null); setRescheduleDate(""); }} className="btn btn-secondary">Cancelar</button>
                  <button type="submit" className="btn btn-primary">Reagendar</button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal de Seleção de Mídia */}
      {showMediaSelectModal && (
        <ModalPortal>
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1001 }}>
            <div className="glass fade-in" style={{ width: "720px", maxWidth: "95vw", maxHeight: "90vh", display: "flex", flexDirection: "column", borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 28px", borderBottom: "1px solid var(--border-color)", background: "rgba(0,0,0,0.1)" }}>
                <h3 style={{ fontSize: "1.3rem", fontWeight: "700" }}>🎞️ Selecionar da Galeria</h3>
                <button type="button" onClick={() => { setShowMediaSelectModal(false); setMediaSelectCallback(null); }} style={{ background: "none", border: "none", color: "var(--text-primary)", fontSize: "1.3rem", cursor: "pointer", opacity: 0.7 }}>✕</button>
              </div>
              {/* Filter tabs */}
              <div style={{ display: "flex", gap: "8px", padding: "14px 28px", borderBottom: "1px solid var(--border-color)", background: "rgba(0,0,0,0.05)" }}>
                {(["all", "image", "video", "document"] as const).map((f) => {
                  const labels: Record<string, string> = { all: "🗂️ Todos", image: "🖼️ Imagens", video: "🎬 Vídeos", document: "📄 Docs" };
                  const activeF = (window as any).__modalMediaFilter || "all";
                  return (
                    <button key={f} type="button" className={`btn ${activeF === f ? "btn-primary" : "btn-secondary"}`} style={{ padding: "5px 14px", fontSize: "0.8rem" }}
                      onClick={() => { (window as any).__modalMediaFilter = f; setLoadingMedia(() => { setTimeout(() => setLoadingMedia(false), 10); return true; }); }}>
                      {labels[f]}
                    </button>
                  );
                })}
              </div>
              {/* Grid */}
              <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: "15px", overflowY: "auto", flex: 1 }}>
                {mediaAssets.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                    Nenhuma mídia encontrada. Faça upload na aba <strong>Galeria de Mídias</strong> primeiro.
                  </div>
                ) : (() => {
                  const mf = (window as any).__modalMediaFilter || "all";
                  const filteredModal = mediaAssets.filter((a: any) =>
                    mf === "all" ? true :
                    mf === "image" ? a.mimeType?.startsWith("image/") :
                    mf === "video" ? a.mimeType?.startsWith("video/") :
                    a.mimeType === "application/pdf"
                  );
                  return filteredModal.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>Nenhum arquivo deste tipo disponível.</div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(145px, 1fr))", gap: "14px" }}>
                      {filteredModal.map((asset: any) => {
                        const isVideo = asset.mimeType?.startsWith("video/");
                        const isImage = asset.mimeType?.startsWith("image/");
                        const typeBg = isVideo ? "rgba(139,92,246,0.75)" : isImage ? "rgba(16,185,129,0.75)" : "rgba(245,158,11,0.75)";
                        const typeLabel = isVideo ? "🎬" : isImage ? "🖼️" : "📄";
                        return (
                          <div key={asset.id} onClick={() => { if (mediaSelectCallback) mediaSelectCallback(asset.url); setShowMediaSelectModal(false); setMediaSelectCallback(null); }}
                            className="glass-interactive"
                            style={{ borderRadius: "var(--radius-sm)", overflow: "hidden", display: "flex", flexDirection: "column", border: "1px solid var(--border-color)", cursor: "pointer", transition: "transform 0.15s ease, border-color 0.15s ease" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--primary)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-color)"; (e.currentTarget as HTMLDivElement).style.transform = ""; }}>
                            <div style={{ height: "100px", background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
                              {isImage ? (
                                <img src={asset.url} alt={asset.filename} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              ) : isVideo ? (
                                <>
                                  <video src={asset.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted preload="metadata" playsInline />
                                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.25)", pointerEvents: "none" }}>
                                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem" }}>▶</div>
                                  </div>
                                </>
                              ) : (
                                <span style={{ fontSize: "2.5rem" }}>📄</span>
                              )}
                              <div style={{ position: "absolute", top: "6px", left: "6px", background: typeBg, backdropFilter: "blur(4px)", padding: "2px 7px", borderRadius: "20px", fontSize: "0.65rem", fontWeight: "700", color: "#fff", pointerEvents: "none" }}>
                                {typeLabel} {asset.mimeType?.split("/")[1]?.toUpperCase()}
                              </div>
                            </div>
                            <div style={{ padding: "8px 10px", fontSize: "0.72rem", fontWeight: "500", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", color: "var(--text-secondary)" }} title={asset.filename}>
                              {asset.filename.replace(/^\d+-/, "")}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
              {/* Footer */}
              <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--border-color)", padding: "14px 28px", background: "rgba(0,0,0,0.05)" }}>
                <button type="button" onClick={() => { setShowMediaSelectModal(false); setMediaSelectCallback(null); }} className="btn btn-secondary">Cancelar</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

    </div>
  );
}
