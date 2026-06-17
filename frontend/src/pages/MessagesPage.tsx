import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useAccount } from "../contexts/AccountContext";
import { useAlert } from "../contexts/AlertContext";
import { useSSE } from "../hooks/useSSE";
import { useAuth, API_BASE_URL } from "../contexts/AuthContext";
import PhoneSimulator from "../components/PhoneSimulator";

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
  templateName: string;
  variables: any;
  createdAt: string;
}

export default function MessagesPage() {
  const { token } = useAuth();
  const { selectedAccount } = useAccount();
  const { showAlert } = useAlert();

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
    if (!window.confirm("Tem certeza que deseja cancelar e excluir este agendamento?")) return;

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
        // Se for um novo envio que não está na lista, recarrega logs
        fetchMessages(selectedAccount.id, messagesPage, messagesSearch, messagesStatus, messagesTemplateFilter);
        return prevLogs;
      });

      // Recarrega mensagens agendadas se necessário
      fetchScheduledMessages(selectedAccount.id);
    }
  });

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
      <div>
        <h1 className="page-heading">Disparador & Logs</h1>
        <p className="page-subheading">Realize disparos de teste ou acompanhe a entrega das automações do n8n</p>
      </div>

      <div className="messages-grid">
        {/* Testador Manual de Disparo */}
        <form onSubmit={handleSendMessage} className="glass" style={{ padding: "24px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "18px" }}>
          <h3 style={{ fontSize: "1.15rem", fontWeight: "600" }}>Disparo de Mensagens</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: "600" }}>Template</label>
            <select
              value={selectedTemplateName}
              onChange={(e) => handleTemplateSelectionChange(e.target.value)}
              style={{ padding: "10px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none", fontSize: "0.9rem" }}
            >
              <option value="">Selecione um template</option>
              {templates
                .filter((t) => t.status === "APPROVED")
                .map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: "600" }}>Destinatário</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setRecipientType("single")}
                className={`btn ${recipientType === "single" ? "btn-primary" : "btn-secondary"}`}
                style={{ flex: 1, padding: "8px", fontSize: "0.85rem" }}
              >
                Número Único
              </button>
              <button
                type="button"
                onClick={() => setRecipientType("list")}
                className={`btn ${recipientType === "list" ? "btn-primary" : "btn-secondary"}`}
                style={{ flex: 1, padding: "8px", fontSize: "0.85rem" }}
              >
                Lista de Contatos
              </button>
            </div>
          </div>

          {recipientType === "single" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: "600" }}>Celular Destinatário</label>
              <input
                type="text"
                placeholder="DDI + DDD + Número (ex: 5511999999999)"
                value={recipientNumber}
                onChange={(e) => setRecipientNumber(e.target.value)}
                style={{ padding: "10px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none", fontSize: "0.9rem" }}
              />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {/* Tag filter for lists */}
              {(() => {
                const allTags = Array.from(new Set(contactLists.flatMap((l) => l.tags || []))) as string[];
                return allTags.length > 0 ? (
                  <select
                    value={listTagFilter}
                    onChange={(e) => { setListTagFilter(e.target.value); setSelectedListId(""); }}
                    style={{ padding: "8px 10px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: listTagFilter ? "#fff" : "var(--text-muted)", outline: "none", fontSize: "0.8rem" }}
                  >
                    <option value="">🏷️ Filtrar por tag (todas)</option>
                    {allTags.map((tag) => (
                      <option key={tag} value={tag}>#{tag}</option>
                    ))}
                  </select>
                ) : null;
              })()}
              <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: "600" }}>Selecionar Lista</label>
              <select
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
                style={{ padding: "10px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none", fontSize: "0.9rem" }}
              >
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
          )}

          {/* Media Header URL Input if selected template has media header */}
          {selectedTemplateName && (() => {
            const tmpl = templates.find(t => t.name === selectedTemplateName);
            const headerComp = tmpl?.components?.find((c: any) => c.type === "HEADER");
            const hasMedia = headerComp && ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerComp.format);
            if (!hasMedia) return null;

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: "600" }}>
                  URL da Mídia ({headerComp.format})
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    placeholder={`https://site.com/media.${headerComp.format === "IMAGE" ? "jpg" : headerComp.format === "VIDEO" ? "mp4" : "pdf"}`}
                    value={messageMediaUrl}
                    onChange={(e) => setMessageMediaUrl(e.target.value)}
                    style={{ flex: 1, padding: "10px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none", fontSize: "0.9rem" }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setMediaSelectCallback(() => (url: string) => setMessageMediaUrl(url));
                      if (selectedAccount) fetchMedia(selectedAccount.id);
                      setShowMediaSelectModal(true);
                    }}
                    className="btn btn-secondary"
                    style={{ padding: "10px 14px", fontSize: "0.85rem" }}
                  >
                    🖼️ Galeria
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Dynamic Variables Inputs / Mapper */}
          {templateVariables.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "12px" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--text-secondary)", textTransform: "uppercase" }}>Variáveis do Template</label>
              {templateVariables.map((variable, idx) => {
                if (recipientType === "single") {
                  return (
                    <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Variável {"{{" + (idx + 1) + "}}"}</label>
                      <input
                        type="text"
                        placeholder={`Valor para {{${idx + 1}}}`}
                        value={variable}
                        onChange={(e) => handleVariableChange(idx, e.target.value)}
                        style={{ padding: "8px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", fontSize: "0.85rem", outline: "none" }}
                      />
                    </div>
                  );
                } else {
                  const mapping = variableMappings[idx] || "STATIC_VALUE";
                  const isStatic = mapping.startsWith("STATIC:") || mapping === "STATIC_VALUE";
                  const staticVal = mapping.startsWith("STATIC:") ? mapping.replace("STATIC:", "") : "";

                  return (
                    <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "6px", background: "rgba(255,255,255,0.02)", padding: "10px", borderRadius: "var(--radius-md)", border: "1px solid rgba(255,255,255,0.03)" }}>
                      <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: "600" }}>Mapeamento de {"{{" + (idx + 1) + "}}"}</label>
                      
                      <select
                        value={isStatic ? "STATIC_VALUE" : mapping}
                        onChange={(e) => {
                          const val = e.target.value;
                          const updated = [...variableMappings];
                          if (val === "STATIC_VALUE") {
                            updated[idx] = "STATIC:";
                          } else {
                            updated[idx] = val;
                          }
                          setVariableMappings(updated);
                        }}
                        style={{ padding: "6px 10px", borderRadius: "var(--radius-sm)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none", fontSize: "0.8rem" }}
                      >
                        <option value="STATIC_VALUE">Valor Fixo (Estático)</option>
                        <option value="CONTACT_NAME">Nome do Contato</option>
                        <option value="CONTACT_PHONE">Telefone do Contato</option>
                        <option value="CONTACT_VAR_1">Variável da Lista 1 (var1)</option>
                        <option value="CONTACT_VAR_2">Variável da Lista 2 (var2)</option>
                        <option value="CONTACT_VAR_3">Variável da Lista 3 (var3)</option>
                      </select>

                      {isStatic && (
                        <input
                          type="text"
                          placeholder={`Digite o valor fixo para {{${idx + 1}}}`}
                          value={staticVal}
                          onChange={(e) => {
                            const updated = [...variableMappings];
                            updated[idx] = `STATIC:${e.target.value}`;
                            setVariableMappings(updated);
                          }}
                          style={{ padding: "6px 10px", borderRadius: "var(--radius-sm)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", fontSize: "0.8rem", outline: "none" }}
                        />
                      )}
                    </div>
                  );
                }
              })}
            </div>
          )}

          {/* Agendamento */}
          {selectedTemplateName && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "12px", marginTop: "5px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
                      const formatted = `${initDate.getFullYear()}-${pad(initDate.getMonth() + 1)}-${pad(initDate.getDate())}T${pad(initDate.getHours())}:${pad(initDate.getMinutes())}`;
                      setScheduledAt(formatted);
                    } else {
                      setScheduledAt("");
                    }
                  }}
                  style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "var(--primary)" }}
                />
                <label htmlFor="enable-scheduling-checkbox" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600", cursor: "pointer" }}>
                  📅 Agendar Envio?
                </label>
              </div>

              {scheduledAt && (
                <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Data e Hora de Envio</label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    min={(() => {
                      const now = new Date();
                      const pad = (n: number) => String(n).padStart(2, "0");
                      return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
                    })()}
                    style={{ padding: "10px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none", fontSize: "0.9rem" }}
                    required
                  />
                </div>
              )}
            </div>
          )}

          <button type="submit" disabled={loading || !selectedAccount} className="btn btn-primary" style={{ width: "100%", marginTop: "10px" }}>
            {loading ? (scheduledAt ? "Agendando..." : "Enviando...") : scheduledAt ? "Agendar Disparo 📅" : (recipientType === "single" ? "Disparar WhatsApp" : "Iniciar Disparo em Lote")}
          </button>
        </form>

        {/* Simulator Preview Column */}
        <div className="glass" style={{ padding: "20px 24px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Pré-visualização</span>
          
          {selectedTemplateName ? (() => {
            const tmpl = templates.find(t => t.name === selectedTemplateName);
            if (!tmpl) return null;
            const componentsList = Array.isArray(tmpl.components) ? tmpl.components : [];
            const bodyComp = componentsList.find((c: any) => c.type === "BODY");
            const headerComp = componentsList.find((c: any) => c.type === "HEADER");
            const footerComp = componentsList.find((c: any) => c.type === "FOOTER");
            const buttonsComp = componentsList.find((c: any) => c.type === "BUTTONS");

            const resolvedPreviewVars = recipientType === "list"
              ? templateVariables.map((_, idx) => {
                  const mapping = variableMappings[idx] || "STATIC_VALUE";
                  if (mapping.startsWith("STATIC:")) {
                    return mapping.replace("STATIC:", "");
                  }
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
              />
            );
          })() : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, minHeight: "300px", color: "var(--text-muted)", fontSize: "0.9rem", textAlign: "center", padding: "0 10px" }}>
              <span style={{ fontSize: "2.5rem", marginBottom: "10px" }}>📱</span>
              Selecione um template para ver a simulação da mensagem.
            </div>
          )}
        </div>

        {/* Logs de Mensagens */}
        <div className="glass" style={{ padding: "30px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px" }}>
            <div style={{ display: "flex", gap: "6px", background: "rgba(255,255,255,0.03)", padding: "4px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
              <button
                type="button"
                onClick={() => setLogsView("recent")}
                className={`btn ${logsView === "recent" ? "btn-primary" : "btn-secondary"}`}
                style={{ padding: "6px 14px", fontSize: "0.8rem", border: "none" }}
              >
                📋 Histórico Recente
              </button>
              <button
                type="button"
                onClick={() => {
                  setLogsView("scheduled");
                  if (selectedAccount) fetchScheduledMessages(selectedAccount.id);
                }}
                className={`btn ${logsView === "scheduled" ? "btn-primary" : "btn-secondary"}`}
                style={{ padding: "6px 14px", fontSize: "0.8rem", border: "none" }}
              >
                📅 Agendamentos Futuros
              </button>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              {logsView === "recent" && (
                <button
                  type="button"
                  disabled={exportingXlsx || !selectedAccount}
                  onClick={async () => {
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
                      alert("Erro ao exportar XLSX.");
                    } finally {
                      setExportingXlsx(false);
                    }
                  }}
                  className="btn btn-secondary"
                  style={{ padding: "8px 14px", fontSize: "0.8rem" }}
                >
                  {exportingXlsx ? "Exportando..." : "📊 Exportar XLSX"}
                </button>
              )}
              <button
                onClick={() => {
                  if (selectedAccount) {
                    if (logsView === "recent") {
                      fetchMessages(selectedAccount.id, messagesPage, messagesSearch, messagesStatus, messagesTemplateFilter);
                    } else {
                      fetchScheduledMessages(selectedAccount.id);
                    }
                  }
                }}
                className="btn btn-secondary"
                style={{ padding: "8px 14px", fontSize: "0.8rem" }}
              >
                🔄 {logsView === "recent" ? "Atualizar Logs" : "Atualizar Agendamentos"}
              </button>
            </div>
          </div>

          {logsView === "recent" ? (
            <>
              {/* Filtros e Busca */}
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end", background: "rgba(255,255,255,0.02)", padding: "16px", borderRadius: "var(--radius-lg)", border: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, minWidth: "180px" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "600" }}>Buscar por Contato / Template</label>
                  <input
                    type="text"
                    placeholder="Pesquisar..."
                    value={messagesSearch}
                    onChange={(e) => setMessagesSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && selectedAccount) {
                        setMessagesPage(1);
                        fetchMessages(selectedAccount.id, 1, messagesSearch, messagesStatus, messagesTemplateFilter);
                      }
                    }}
                    style={{ padding: "8px 12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none", fontSize: "0.85rem" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "130px" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "600" }}>Filtrar Status</label>
                  <select
                    value={messagesStatus}
                    onChange={(e) => setMessagesStatus(e.target.value)}
                    style={{ padding: "8px 10px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none", fontSize: "0.85rem" }}
                  >
                    <option value="">Todos</option>
                    <option value="PENDING">PENDING</option>
                    <option value="SENT">SENT</option>
                    <option value="DELIVERED">DELIVERED</option>
                    <option value="READ">READ</option>
                    <option value="FAILED">FAILED</option>
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "170px" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "600" }}>Filtrar Template</label>
                  <select
                    value={messagesTemplateFilter}
                    onChange={(e) => setMessagesTemplateFilter(e.target.value)}
                    style={{ padding: "8px 10px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none", fontSize: "0.85rem" }}
                  >
                    <option value="">Todos</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => {
                      if (selectedAccount) {
                        setMessagesPage(1);
                        fetchMessages(selectedAccount.id, 1, messagesSearch, messagesStatus, messagesTemplateFilter);
                      }
                    }}
                    className="btn btn-primary"
                    style={{ padding: "8px 14px", fontSize: "0.85rem" }}
                  >
                    🔍 Filtrar
                  </button>
                  <button
                    onClick={() => {
                      setMessagesSearch("");
                      setMessagesStatus("");
                      setMessagesTemplateFilter("");
                      setMessagesPage(1);
                      if (selectedAccount) {
                        fetchMessages(selectedAccount.id, 1, "", "", "");
                      }
                    }}
                    className="btn btn-secondary"
                    style={{ padding: "8px 12px", fontSize: "0.85rem" }}
                  >
                    Limpar
                  </button>
                </div>
              </div>

              {messageLogs.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>Nenhuma mensagem enviada por esta conta.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ overflowX: "auto" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Destinatário</th>
                          <th>Template</th>
                          <th>Data/Hora</th>
                          <th>Status</th>
                          <th>Detalhes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {messageLogs.map((log) => (
                          <tr key={log.id}>
                            <td style={{ fontWeight: "500" }}>{log.to}</td>
                            <td>{log.templateName}</td>
                            <td style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td>
                              <span className={`badge badge-${log.status.toLowerCase()}`}>
                                {log.status}
                              </span>
                            </td>
                            <td style={{ color: "var(--text-muted)", fontSize: "0.8rem", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {log.errorMessage ? (
                                <span style={{ color: "var(--error)" }} title={log.errorMessage}>
                                  ⚠️ {log.errorMessage}
                                </span>
                              ) : (
                                <span title={log.wamid || ""}>{log.wamid ? `${log.wamid.slice(0, 15)}...` : "-"}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginação */}
                  {(() => {
                    const totalPages = Math.max(1, Math.ceil(totalMessages / messagesLimit));
                    const goTo = (p: number) => {
                      setMessagesPage(p);
                      if (selectedAccount) fetchMessages(selectedAccount.id, p, messagesSearch, messagesStatus, messagesTemplateFilter);
                    };

                    const pageNumbers: (number | "...")[] = [];
                    for (let p = 1; p <= totalPages; p++) {
                      if (p === 1 || p === totalPages || Math.abs(p - messagesPage) <= 1) {
                        pageNumbers.push(p);
                      } else if (pageNumbers[pageNumbers.length - 1] !== "...") {
                        pageNumbers.push("...");
                      }
                    }

                    return (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "16px", marginTop: "10px", flexWrap: "wrap", gap: "10px" }}>
                        <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                          {totalMessages === 0 ? "Nenhum registro" : `${((messagesPage - 1) * messagesLimit) + 1}–${Math.min(messagesPage * messagesLimit, totalMessages)} de ${totalMessages} disparos`}
                        </span>
                        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                          <button disabled={messagesPage === 1} onClick={() => goTo(1)} className="btn btn-secondary" style={{ padding: "5px 10px", fontSize: "0.78rem" }}>«</button>
                          <button disabled={messagesPage === 1} onClick={() => goTo(messagesPage - 1)} className="btn btn-secondary" style={{ padding: "5px 10px", fontSize: "0.78rem" }}>‹</button>
                          {pageNumbers.map((p, i) =>
                            p === "..." ? (
                              <span key={`ellipsis-${i}`} style={{ padding: "5px 8px", color: "var(--text-muted)", fontSize: "0.82rem" }}>…</span>
                            ) : (
                              <button
                                key={p}
                                onClick={() => goTo(p as number)}
                                className="btn"
                                style={{
                                  padding: "5px 10px",
                                  fontSize: "0.82rem",
                                  background: p === messagesPage ? "var(--primary)" : "rgba(255,255,255,0.05)",
                                  border: p === messagesPage ? "1px solid var(--primary)" : "1px solid rgba(255,255,255,0.1)",
                                  color: p === messagesPage ? "#fff" : "var(--text-secondary)",
                                  fontWeight: p === messagesPage ? "700" : "400",
                                  minWidth: "34px"
                                }}
                              >{p}</button>
                            )
                          )}
                          <button disabled={messagesPage >= totalPages} onClick={() => goTo(messagesPage + 1)} className="btn btn-secondary" style={{ padding: "5px 10px", fontSize: "0.78rem" }}>›</button>
                          <button disabled={messagesPage >= totalPages} onClick={() => goTo(totalPages)} className="btn btn-secondary" style={{ padding: "5px 10px", fontSize: "0.78rem" }}>»</button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </>
          ) : (
            <>
              {loadingScheduled ? (
                <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>Carregando agendamentos futuros...</p>
              ) : scheduledMessages.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>Nenhum agendamento futuro encontrado para esta conta.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Destinatário</th>
                        <th>Template</th>
                        <th>Data/Hora de Envio</th>
                        <th>Status</th>
                        <th style={{ textAlign: "right" }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scheduledMessages.map((msg) => (
                        <tr key={msg.id}>
                          <td style={{ fontWeight: "500" }}>{msg.to}</td>
                          <td>{msg.templateName}</td>
                          <td style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                            {new Date(msg.scheduledAt).toLocaleString()}
                          </td>
                          <td>
                            <span className="badge badge-pending">PENDING</span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  const date = new Date(msg.scheduledAt);
                                  const pad = (n: number) => String(n).padStart(2, "0");
                                  const formatted = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
                                  setRescheduleDate(formatted);
                                  setShowRescheduleModal(msg.id);
                                }}
                                className="btn btn-secondary"
                                style={{ padding: "6px 12px", fontSize: "0.78rem", background: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.2)", color: "#3b82f6", cursor: "pointer" }}
                              >
                                📅 Reagendar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancelScheduled(msg.id)}
                                className="btn btn-secondary"
                                style={{ padding: "6px 12px", fontSize: "0.78rem", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "var(--error)", cursor: "pointer" }}
                              >
                                🗑️ Cancelar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Reschedule Modal */}
      {showRescheduleModal !== null && (
        <ModalPortal>
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
            <div className="glass fade-in" style={{ width: "420px", maxWidth: "90vw", display: "flex", flexDirection: "column", borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 28px", borderBottom: "1px solid var(--border-color)", background: "rgba(0,0,0,0.1)" }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>📅</span> Reagendar Mensagem
                </h3>
                <button type="button" onClick={() => { setShowRescheduleModal(null); setRescheduleDate(""); }} style={{ background: "none", border: "none", color: "#fff", fontSize: "1.2rem", cursor: "pointer", opacity: 0.7 }}>✕</button>
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
                    style={{ padding: "10px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none", fontSize: "0.9rem" }}
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
