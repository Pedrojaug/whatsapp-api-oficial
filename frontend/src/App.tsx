import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import "./App.css";
import SetupWizard from "./components/SetupWizard";
import PhoneSimulator from "./components/PhoneSimulator";
import AuthPages from "./components/AuthPages";

/** Renders children directly in document.body, escaping any overflow/stacking-context ancestor */
function ModalPortal({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body);
}


const API_BASE_URL = "http://localhost:3001/api";

const parseJwt = (token: string) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
};

interface Account {
  id: string;
  name: string;
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
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

interface TemplateButton {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;
  url?: string;
  phoneNumber?: string;
}

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [user, setUser] = useState<{ id: string; email: string; name: string | null; role?: string } | null>(
    localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")!) : null
  );

  // Theme state — default dark, persisted in localStorage
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(
    localStorage.getItem("theme") !== "light"
  );
  useEffect(() => {
    if (isDarkTheme) {
      document.body.classList.remove("light-theme");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.add("light-theme");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkTheme]);

  const [activeTab, setActiveTab] = useState<"metrics" | "accounts" | "templates" | "messages" | "lists" | "admin" | "media">("metrics");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  // Form states
  const [templates, setTemplates] = useState<Template[]>([]);
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([]);
  const [messagesSearch, setMessagesSearch] = useState("");
  const [messagesStatus, setMessagesStatus] = useState("");
  const [messagesTemplateFilter, setMessagesTemplateFilter] = useState("");
  const [messagesPage, setMessagesPage] = useState(1);
  const [messagesLimit] = useState(50);
  const [totalMessages, setTotalMessages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [syncingTemplates, setSyncingTemplates] = useState(false);

  // Admin and Impersonation states
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [loadingAdminUsers, setLoadingAdminUsers] = useState(false);

  // Dashboard Metrics states
  const [metricsPeriod, setMetricsPeriod] = useState<"today" | "yesterday" | "7days" | "30days" | "custom">("7days");
  const [metricsStartDate, setMetricsStartDate] = useState("");
  const [metricsEndDate, setMetricsEndDate] = useState("");
  const [metricsData, setMetricsData] = useState<{
    totals: { sent: number; delivered: number; read: number; failed: number; total: number };
    chartData: Array<{ date: string; sent: number; read: number; failed: number }>;
    templateMetrics?: Array<{ templateName: string; sent: number; read: number; failed: number; total: number }>;
  }>({
    totals: { sent: 0, delivered: 0, read: 0, failed: 0, total: 0 },
    chartData: [],
    templateMetrics: []
  });

  // XLSX and Scheduled Messages states
  const [xlsxContacts, setXlsxContacts] = useState<any[]>([]);
  const [logsView, setLogsView] = useState<"recent" | "scheduled">("recent");
  const [scheduledMessages, setScheduledMessages] = useState<any[]>([]);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");

  const handleLoginSuccess = (newToken: string, newUser: any) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    setToken(null);
    setUser(null);
    setAccounts([]);
    setSelectedAccount(null);
  };

  const fetchAdminUsers = async () => {
    setLoadingAdminUsers(true);
    try {
      const res = await axios.get("http://localhost:3001/api/admin/users");
      setAdminUsers(res.data);
    } catch (err: any) {
      if (err.response?.status === 401) {
        handleLogout();
      } else {
        showAlert("Erro ao buscar usuários do sistema.", "error");
      }
    } finally {
      setLoadingAdminUsers(false);
    }
  };

  const handleImpersonate = async (targetUserId: string) => {
    try {
      showAlert("Iniciando sessão de suporte...");
      const currentToken = localStorage.getItem("token")!;
      const currentUser = localStorage.getItem("user")!;
      
      const res = await axios.post("http://localhost:3001/api/admin/impersonate", { targetUserId });
      
      // Save original admin details
      localStorage.setItem("admin_token", currentToken);
      localStorage.setItem("admin_user", currentUser);
      
      // Load client session
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      
      // Update React states
      setToken(res.data.token);
      setUser(res.data.user);
      setActiveTab("metrics");
      showAlert("Sessão de suporte iniciada!", "success");
    } catch (err: any) {
      showAlert(err.response?.data?.error || "Erro ao iniciar suporte.", "error");
    }
  };

  const handleStopImpersonating = () => {
    const adminToken = localStorage.getItem("admin_token");
    const adminUser = localStorage.getItem("admin_user");
    
    if (adminToken && adminUser) {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
      
      localStorage.setItem("token", adminToken);
      localStorage.setItem("user", adminUser);
      
      setToken(adminToken);
      setUser(JSON.parse(adminUser));
      setActiveTab("admin");
      showAlert("Retornado ao painel de administrador.", "success");
    }
  };

  // New Template Form States (Template Builder)
  const [showNewTemplateModal, setShowNewTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateCategory, setNewTemplateCategory] = useState("MARKETING");
  const [newTemplateLanguage, setNewTemplateLanguage] = useState("pt_BR");
  const [newTemplateHeaderFormat, setNewTemplateHeaderFormat] = useState<"NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT">("NONE");
  const [newTemplateHeaderText, setNewTemplateHeaderText] = useState("");
  const [newTemplateBodyText, setNewTemplateBodyText] = useState("");
  const [newTemplateFooterText, setNewTemplateFooterText] = useState("");
  
  // Variables examples states
  const [newTemplateBodyVariables, setNewTemplateBodyVariables] = useState<string[]>([]);
  
  // Buttons states
  const [newTemplateButtonType, setNewTemplateButtonType] = useState<"NONE" | "QUICK_REPLY" | "CTA">("NONE");
  const [newTemplateButtons, setNewTemplateButtons] = useState<TemplateButton[]>([]);
  
  // Sample file state for header media
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [sampleFileBase64, setSampleFileBase64] = useState<string>("");
  const [sampleFilePreviewUrl, setSampleFilePreviewUrl] = useState<string>("");

  // Template editing state
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [deleteConfirmTemplate, setDeleteConfirmTemplate] = useState<{ id: string, name: string } | null>(null);

  // Contact lists states
  const [contactLists, setContactLists] = useState<any[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListRawContacts, setNewListRawContacts] = useState("");
  const [selectedList, setSelectedList] = useState<any | null>(null);
  const [importMode, setImportMode] = useState<"csv" | "manual">("csv");
  const [manualContacts, setManualContacts] = useState<Array<{ name: string; phone: string; variablesStr: string }>>([
    { name: "", phone: "", variablesStr: "" }
  ]);
  const [showEditListModal, setShowEditListModal] = useState<any | null>(null);
  const [editListName, setEditListName] = useState("");
  const [editContacts, setEditContacts] = useState<Array<{ id?: string; name: string; phone: string; variablesStr: string }>>([]);
  const [loadingEdit, setLoadingEdit] = useState(false);
  
  // Media manager states
  const [mediaAssets, setMediaAssets] = useState<any[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
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

  // Messages / Alerts
  const [alert, setAlert] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const detectBodyVariables = (text: string) => {
    const matches = text.match(/\{\{(\d+)\}\}/g);
    if (!matches) return [];
    const uniqueIds = Array.from(new Set(matches.map(m => {
      const numMatch = m.match(/\d+/);
      return numMatch ? parseInt(numMatch[0]) : 1;
    }))).sort((a, b) => a - b);
    return uniqueIds;
  };

  useEffect(() => {
    const vars = detectBodyVariables(newTemplateBodyText);
    setNewTemplateBodyVariables(prev => {
      const next = [...prev];
      if (next.length < vars.length) {
        for (let i = next.length; i < vars.length; i++) {
          next.push("");
        }
      }
      return next.slice(0, vars.length);
    });
  }, [newTemplateBodyText]);

  const resetTemplateForm = () => {
    setNewTemplateName("");
    setNewTemplateCategory("MARKETING");
    setNewTemplateLanguage("pt_BR");
    setNewTemplateHeaderFormat("NONE");
    setNewTemplateHeaderText("");
    setNewTemplateBodyText("");
    setNewTemplateFooterText("");
    setNewTemplateBodyVariables([]);
    setNewTemplateButtonType("NONE");
    setNewTemplateButtons([]);
    setSampleFile(null);
    setSampleFileBase64("");
    setEditingTemplateId(null);
    if (sampleFilePreviewUrl) {
      URL.revokeObjectURL(sampleFilePreviewUrl);
    }
    setSampleFilePreviewUrl("");
  };

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchAccounts();
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  const fetchMetrics = async (accountId: string) => {
    try {
      let url = `${API_BASE_URL}/accounts/${accountId}/metrics?period=${metricsPeriod}`;
      if (metricsPeriod === "custom" && metricsStartDate) {
        url += `&startDate=${metricsStartDate}`;
        if (metricsEndDate) {
          url += `&endDate=${metricsEndDate}`;
        }
      }
      const res = await axios.get(url);
      setMetricsData(res.data);
    } catch (err: any) {
      console.error("Erro ao buscar métricas:", err);
    }
  };

  useEffect(() => {
    if (selectedAccount) {
      fetchTemplates(selectedAccount.id);
      fetchMessages(selectedAccount.id);
      fetchContactLists(selectedAccount.id);
      fetchMetrics(selectedAccount.id);
      fetchMedia(selectedAccount.id);
      fetchScheduledMessages(selectedAccount.id);
    } else {
      setTemplates([]);
      setMessageLogs([]);
      setContactLists([]);
      setSelectedList(null);
      setMediaAssets([]);
      setScheduledMessages([]);
      setMetricsData({
        totals: { sent: 0, delivered: 0, read: 0, failed: 0, total: 0 },
        chartData: [],
        templateMetrics: []
      });
    }
  }, [selectedAccount]);

  // Sincronização de status das mensagens em tempo real (SSE)
  useEffect(() => {
    if (!selectedAccount || !token) return;

    const sseUrl = `${API_BASE_URL.replace("/api", "")}/api/accounts/${selectedAccount.id}/messages/events?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
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
            // Se for um log novo (ex: acabou de ser enviado via API), recarrega a página atual para exibir
            // Mas limitamos recarregamentos para evitar gargalos em lotes grandes.
            // Para maior robustez, faremos o fetch manual de mensagens se não encontrar
            return prevLogs;
          });

          // Atualiza as métricas do painel de controle
          fetchMetrics(selectedAccount.id);
          // Atualiza agendamentos futuros
          fetchScheduledMessages(selectedAccount.id);
        }
      } catch (err) {
        console.error("Erro ao processar atualização em tempo real:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("Erro na conexão com SSE de eventos. Reconectando...", err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [selectedAccount, token]);

  useEffect(() => {
    if (selectedAccount && activeTab === "lists") {
      fetchContactLists(selectedAccount.id);
    }
    if (selectedAccount && activeTab === "media") {
      fetchMedia(selectedAccount.id);
    }
    if (activeTab === "admin") {
      fetchAdminUsers();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedAccount && activeTab === "metrics") {
      fetchMetrics(selectedAccount.id);
    }
  }, [selectedAccount, activeTab, metricsPeriod, metricsStartDate, metricsEndDate]);

  const showAlert = (text: string, type: "success" | "error" = "success") => {
    setAlert({ text, type });
    setTimeout(() => setAlert(null), 5000);
  };

  const fetchAccounts = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/accounts`);
      setAccounts(res.data);
      if (res.data.length > 0) {
        const stillExists = res.data.some((a: any) => a.id === selectedAccount?.id);
        if (!stillExists) {
          setSelectedAccount(res.data[0]);
        }
      } else {
        setSelectedAccount(null);
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        handleLogout();
      } else {
        showAlert("Erro ao buscar contas Meta.", "error");
      }
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja remover esta conta e todo o histórico associado?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/accounts/${id}`);
      showAlert("Conta removida com sucesso.");
      if (selectedAccount?.id === id) {
        setSelectedAccount(null);
      }
      fetchAccounts();
    } catch (err) {
      showAlert("Erro ao deletar conta.", "error");
    }
  };

  const fetchTemplates = async (accountId: string, sync = false) => {
    try {
      const url = sync
        ? `${API_BASE_URL}/accounts/${accountId}/templates?sync=true`
        : `${API_BASE_URL}/accounts/${accountId}/templates`;
      const res = await axios.get(url);
      setTemplates(res.data);
    } catch (err: any) {
      console.error(err);
    }
  };

  const syncTemplates = async () => {
    if (!selectedAccount) return;
    setSyncingTemplates(true);
    try {
      showAlert("Sincronizando templates com a Meta...");
      await fetchTemplates(selectedAccount.id, true);
      showAlert("Templates atualizados com sucesso!");
    } catch (err) {
      showAlert("Erro ao sincronizar templates.", "error");
    } finally {
      setSyncingTemplates(false);
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
      console.error(err);
    }
  };

  const loadSheetJS = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).XLSX) {
        resolve((window as any).XLSX);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      script.onload = () => resolve((window as any).XLSX);
      script.onerror = (err) => reject(err);
      document.body.appendChild(script);
    });
  };

  const handleXlsxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      showAlert("Carregando leitor de planilhas...");
      const XLSX = await loadSheetJS();
      showAlert("Processando arquivo Excel...");

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const workbook = XLSX.read(bstr, { type: "binary" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

          if (data.length === 0) {
            showAlert("O arquivo Excel está vazio.", "error");
            return;
          }

          const headers = data[0].map(h => String(h || "").trim().toLowerCase());
          
          let phoneIdx = headers.findIndex(h => h.includes("tel") || h.includes("phone") || h.includes("celular") || h.includes("contato"));
          let nameIdx = headers.findIndex(h => h.includes("nome") || h.includes("name") || h.includes("cliente"));

          if (phoneIdx === -1) {
            if (headers.length === 1) {
              phoneIdx = 0;
              nameIdx = -1;
            } else {
              phoneIdx = 1;
              nameIdx = 0;
            }
          }

          const parsedContacts: any[] = [];
          for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;

            const phone = String(row[phoneIdx] || "").trim().replace(/\D/g, "");
            if (!phone || phone.length < 8) continue;

            const name = nameIdx !== -1 ? String(row[nameIdx] || "").trim() : "";
            
            const variables: string[] = [];
            row.forEach((cell, idx) => {
              if (idx !== phoneIdx && idx !== nameIdx) {
                if (cell !== undefined && cell !== null) {
                  variables.push(String(cell).trim());
                }
              }
            });

            parsedContacts.push({
              name: name || undefined,
              phone,
              variables
            });
          }

          if (parsedContacts.length === 0) {
            showAlert("Nenhum contato com telefone válido foi encontrado (mínimo 8 dígitos).", "error");
            return;
          }

          setXlsxContacts(parsedContacts);
          showAlert(`${parsedContacts.length} contatos lidos do Excel com sucesso!`, "success");
        } catch (err: any) {
          showAlert(`Erro ao ler Excel: ${err.message}`, "error");
        }
      };
      reader.readAsBinaryString(file);
    } catch (err: any) {
      console.error(err);
      showAlert("Falha ao carregar leitor de Excel de CDN externo.", "error");
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

  const fetchContactLists = async (accountId: string) => {
    setLoadingLists(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/accounts/${accountId}/lists`);
      setContactLists(res.data);
    } catch (err: any) {
      console.error("Erro ao buscar listas de contatos:", err);
    } finally {
      setLoadingLists(false);
    }
  };

  const fetchMedia = async (accountId: string) => {
    setLoadingMedia(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/accounts/${accountId}/media`);
      setMediaAssets(res.data);
    } catch (err: any) {
      console.error("Erro ao buscar mídias:", err);
    } finally {
      setLoadingMedia(false);
    }
  };

  const handleUploadMedia = async (file: File) => {
    if (!selectedAccount) return;

    // Validar tipo de arquivo
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/3gpp", "application/pdf"];
    if (!ALLOWED_TYPES.includes(file.type)) {
      showAlert(`Tipo de arquivo não suportado: ${file.type}. Use JPEG, PNG, WebP, MP4, 3GPP ou PDF.`, "error");
      return;
    }

    // Validar tamanho: 50 MB
    const MAX_MB = 50;
    if (file.size > MAX_MB * 1024 * 1024) {
      showAlert(`Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Limite: ${MAX_MB} MB.`, "error");
      return;
    }

    setLoadingMedia(true);
    try {
      showAlert(`Enviando ${file.type.startsWith("video/") ? "vídeo" : "mídia"}... aguarde.`);
      const reader = new FileReader();
      reader.onload = async (e) => {
        const fileBase64 = e.target?.result as string;
        try {
          await axios.post(`${API_BASE_URL}/accounts/${selectedAccount.id}/media`, {
            filename: file.name,
            mimeType: file.type,
            fileBase64
          });
          showAlert("Mídia enviada com sucesso! ✅");
          fetchMedia(selectedAccount.id);
        } catch (err: any) {
          showAlert(err.response?.data?.error || "Erro ao fazer upload.", "error");
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      showAlert(err.message, "error");
    } finally {
      setLoadingMedia(false);
    }
  };


  const handleDeleteMedia = async (mediaId: string) => {
    if (!selectedAccount) return;
    if (!window.confirm("Deseja realmente excluir esta mídia? Esta ação não pode ser desfeita.")) return;
    setLoadingMedia(true);
    try {
      showAlert("Excluindo mídia...");
      await axios.delete(`${API_BASE_URL}/accounts/${selectedAccount.id}/media/${mediaId}`);
      showAlert("Mídia excluída com sucesso.");
      fetchMedia(selectedAccount.id);
    } catch (err: any) {
      showAlert(err.response?.data?.error || "Erro ao excluir mídia.", "error");
    } finally {
      setLoadingMedia(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!selectedAccount) return;
    try {
      showAlert("Excluindo template...");
      await axios.delete(`${API_BASE_URL}/accounts/${selectedAccount.id}/templates/${templateId}`);
      showAlert("Template excluído com sucesso.");
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      setTimeout(() => fetchTemplates(selectedAccount.id), 2000);
    } catch (err: any) {
      const details = err.response?.data?.error || err.message;
      showAlert(`Erro ao excluir template: ${details}`, "error");
    }
  };

  const handleEditTemplate = (tmpl: Template) => {
    resetTemplateForm();
    setEditingTemplateId(tmpl.id);
    setNewTemplateName(tmpl.name);
    setNewTemplateCategory(tmpl.category);
    setNewTemplateLanguage(tmpl.language);
    
    const components = tmpl.components || [];
    const header = components.find((c: any) => c.type === "HEADER");
    const body = components.find((c: any) => c.type === "BODY");
    const footer = components.find((c: any) => c.type === "FOOTER");
    const buttons = components.find((c: any) => c.type === "BUTTONS");

    if (header) {
      setNewTemplateHeaderFormat(header.format);
      if (header.format === "TEXT") {
        setNewTemplateHeaderText(header.text || "");
      }
    } else {
      setNewTemplateHeaderFormat("NONE");
    }

    if (body) {
      setNewTemplateBodyText(body.text || "");
      if (body.example?.body_text?.[0]) {
        setNewTemplateBodyVariables(body.example.body_text[0]);
      }
    }

    if (footer) {
      setNewTemplateFooterText(footer.text || "");
    }

    if (buttons) {
      const mappedButtons = (buttons.buttons || []).map((btn: any) => {
        if (btn.type === "QUICK_REPLY") {
          return { type: "QUICK_REPLY", text: btn.text };
        } else if (btn.type === "URL") {
          return { type: "URL", text: btn.text, url: btn.url };
        } else if (btn.type === "PHONE_NUMBER") {
          return { type: "PHONE_NUMBER", text: btn.text, phoneNumber: btn.phone_number };
        }
        return null;
      }).filter(Boolean);

      setNewTemplateButtons(mappedButtons);
      
      if (mappedButtons.length > 0) {
        if (mappedButtons[0].type === "QUICK_REPLY") {
          setNewTemplateButtonType("QUICK_REPLY");
        } else {
          setNewTemplateButtonType("CTA");
        }
      } else {
        setNewTemplateButtonType("NONE");
      }
    } else {
      setNewTemplateButtonType("NONE");
    }

    setShowNewTemplateModal(true);
  };

  const parseRawContacts = (text: string) => {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const parsed: any[] = [];

    const cleanValue = (val: string) => {
      let s = val.trim();
      if (s.startsWith('"') && s.endsWith('"')) {
        s = s.slice(1, -1);
      } else if (s.startsWith("'") && s.endsWith("'")) {
        s = s.slice(1, -1);
      }
      return s.trim();
    };

    for (const line of lines) {
      const separator = line.includes(";") ? ";" : ",";
      let phone = "";
      let name = "";
      let variables: string[] = [];

      if (line.includes(separator)) {
        const parts = line.split(separator).map(p => p.trim());
        phone = cleanValue(parts[0] || "");
        name = cleanValue(parts[1] || "");
        variables = parts.slice(2).map(cleanValue);
      } else {
        phone = cleanValue(line);
      }

      const cleanPhone = phone.replace(/\D/g, "");
      // Skip headers or invalid lines (must have at least 8 digits to be a phone number)
      if (cleanPhone.length >= 8) {
        parsed.push({
          phone: cleanPhone,
          name: name || undefined,
          variables: variables.length > 0 ? variables : undefined
        });
      }
    }
    return parsed;
  };

  const handleCreateContactList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    if (!newListName.trim()) {
      showAlert("O nome da lista é obrigatório.", "error");
      return;
    }

    let parsedContacts: any[] = [];
    if (importMode === "csv") {
      if (!newListRawContacts.trim()) {
        showAlert("Insira ao menos um contato.", "error");
        return;
      }
      parsedContacts = parseRawContacts(newListRawContacts);
    } else if (importMode === "xlsx") {
      if (xlsxContacts.length === 0) {
        showAlert("Selecione um arquivo Excel válido e aguarde o processamento.", "error");
        return;
      }
      parsedContacts = xlsxContacts;
    } else {
      parsedContacts = manualContacts
        .map(c => ({
          name: c.name.trim() || undefined,
          phone: c.phone.trim().replace(/\D/g, ""),
          variables: c.variablesStr ? c.variablesStr.split(",").map(v => v.trim()).filter(Boolean) : []
        }))
        .filter(c => c.phone.length >= 8);
      
      if (parsedContacts.length === 0) {
        showAlert("Insira ao menos um contato com telefone válido (mínimo 8 dígitos).", "error");
        return;
      }
    }

    if (parsedContacts.length === 0) {
      showAlert("Nenhum contato válido encontrado.", "error");
      return;
    }
    if (parsedContacts.length > 1000) {
      showAlert("O limite de contatos por importação é de 1.000 registros.", "error");
      return;
    }

    setLoading(true);
    try {
      showAlert("Criando lista de contatos...");
      await axios.post(`${API_BASE_URL}/accounts/${selectedAccount.id}/lists`, {
        name: newListName,
        contacts: parsedContacts
      });
      showAlert("Lista de contatos criada com sucesso!");
      setNewListName("");
      setNewListRawContacts("");
      setManualContacts([{ name: "", phone: "", variablesStr: "" }]);
      setXlsxContacts([]);
      setImportMode("csv");
      setShowNewListModal(false);
      fetchContactLists(selectedAccount.id);
    } catch (err: any) {
      const details = err.response?.data?.error || err.message;
      showAlert(`Erro ao criar lista: ${details}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContactList = async (listId: string, listName: string) => {
    if (!selectedAccount) return;
    if (!window.confirm(`Tem certeza que deseja excluir a lista "${listName}"? Isso excluirá todos os contatos vinculados a ela.`)) return;

    try {
      showAlert("Excluindo lista...");
      await axios.delete(`${API_BASE_URL}/accounts/${selectedAccount.id}/lists/${listId}`);
      showAlert("Lista excluída com sucesso.");
      if (selectedList?.id === listId) {
        setSelectedList(null);
      }
      fetchContactLists(selectedAccount.id);
    } catch (err: any) {
      const details = err.response?.data?.error || err.message;
      showAlert(`Erro ao excluir lista: ${details}`, "error");
    }
  };

  const handleEditContactList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount || !showEditListModal) return;
    if (!editListName.trim()) {
      showAlert("O nome da lista é obrigatório.", "error");
      return;
    }

    const parsedContacts = editContacts
      .map(c => ({
        id: c.id || undefined,
        name: c.name.trim() || undefined,
        phone: c.phone.trim().replace(/\D/g, ""),
        variables: c.variablesStr ? c.variablesStr.split(",").map(v => v.trim()).filter(Boolean) : []
      }))
      .filter(c => c.phone.length >= 8);

    if (parsedContacts.length === 0) {
      showAlert("Insira ao menos um contato com telefone válido (mínimo 8 dígitos).", "error");
      return;
    }
    if (parsedContacts.length > 1000) {
      showAlert("O limite de contatos por lista é de 1.000 registros.", "error");
      return;
    }

    setLoadingEdit(true);
    try {
      showAlert("Salvando alterações da lista...");
      await axios.put(`${API_BASE_URL}/accounts/${selectedAccount.id}/lists/${showEditListModal.id}`, {
        name: editListName,
        contacts: parsedContacts
      });
      showAlert("Lista de contatos atualizada com sucesso!");
      
      // Update selected list details if active
      if (selectedList?.id === showEditListModal.id) {
        handleViewListDetails(showEditListModal);
      }

      setShowEditListModal(null);
      setEditListName("");
      setEditContacts([]);
      fetchContactLists(selectedAccount.id);
    } catch (err: any) {
      const details = err.response?.data?.error || err.message;
      showAlert(`Erro ao atualizar lista: ${details}`, "error");
    } finally {
      setLoadingEdit(false);
    }
  };

  const handleViewListDetails = async (list: any) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/accounts/${selectedAccount!.id}/lists/${list.id}`);
      setSelectedList(res.data);
    } catch (err: any) {
      showAlert("Erro ao buscar detalhes da lista.", "error");
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    if (!newTemplateName) {
      showAlert("Nome do template é obrigatório.", "error");
      return;
    }
    if (!newTemplateBodyText) {
      showAlert("Corpo da mensagem é obrigatório.", "error");
      return;
    }

    setLoading(true);
    try {
      let headerHandle = "";

      // 1. Se tem cabeçalho de mídia e foi carregado arquivo, faz upload
      if (["IMAGE", "VIDEO", "DOCUMENT"].includes(newTemplateHeaderFormat)) {
        if (sampleFileBase64) {
          try {
            showAlert("Enviando arquivo de exemplo para a Meta...");
            const uploadRes = await axios.post(`${API_BASE_URL}/accounts/${selectedAccount.id}/templates/upload-sample`, {
              fileName: sampleFile?.name || "sample_file",
              fileType: sampleFile?.type || "image/png",
              fileBase64: sampleFileBase64,
            });
            headerHandle = uploadRes.data.headerHandle;
          } catch (err: any) {
            const uploadErrMsg = err.response?.data?.details || err.response?.data?.error || err.message;
            throw new Error(`Falha no upload de mídia de exemplo: ${uploadErrMsg}`);
          }
        } else {
          throw new Error("Um arquivo de exemplo é obrigatório para templates de mídia.");
        }
      }

      // 2. Montar componentes do template
      const components: any[] = [];

      // HEADER Component
      if (newTemplateHeaderFormat === "TEXT") {
        if (!newTemplateHeaderText) {
          throw new Error("Texto do cabeçalho é obrigatório para o formato TEXTO.");
        }
        components.push({
          type: "HEADER",
          format: "TEXT",
          text: newTemplateHeaderText,
        });
      } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(newTemplateHeaderFormat)) {
        components.push({
          type: "HEADER",
          format: newTemplateHeaderFormat,
          example: {
            header_handle: [headerHandle],
          },
        });
      }

      // BODY Component
      const bodyComponent: any = {
        type: "BODY",
        text: newTemplateBodyText,
      };

      // Adicionar examples se tiver variáveis
      const varsCount = detectBodyVariables(newTemplateBodyText).length;
      if (varsCount > 0) {
        // Garantir que todos os campos de exemplo foram preenchidos
        const filledVars = newTemplateBodyVariables.map(v => v.trim());
        if (filledVars.some(v => !v)) {
          throw new Error("Preencha todos os exemplos de variáveis do corpo da mensagem.");
        }
        bodyComponent.example = {
          body_text: [filledVars],
        };
      }
      components.push(bodyComponent);

      // FOOTER Component
      if (newTemplateFooterText) {
        components.push({
          type: "FOOTER",
          text: newTemplateFooterText,
        });
      }

      // BUTTONS Component
      if (newTemplateButtonType !== "NONE" && newTemplateButtons.length > 0) {
        const processedButtons = newTemplateButtons.map(btn => {
          if (!btn.text) {
            throw new Error("Todos os botões precisam de texto.");
          }
          if (btn.type === "URL" && !btn.url) {
            throw new Error("Botões de link precisam de URL.");
          }
          if (btn.type === "PHONE_NUMBER" && !btn.phoneNumber) {
            throw new Error("Botões de ligação precisam de número de telefone.");
          }

          if (btn.type === "QUICK_REPLY") {
            return {
              type: "QUICK_REPLY",
              text: btn.text,
            };
          } else if (btn.type === "URL") {
            return {
              type: "URL",
              text: btn.text,
              url: btn.url,
            };
          } else if (btn.type === "PHONE_NUMBER") {
            return {
              type: "PHONE_NUMBER",
              text: btn.text,
              phone_number: btn.phoneNumber,
            };
          }
          return null;
        }).filter(Boolean);

        components.push({
          type: "BUTTONS",
          buttons: processedButtons,
        });
      }

      if (editingTemplateId) {
        try {
          showAlert("Removendo versão anterior do template...");
          await axios.delete(`${API_BASE_URL}/accounts/${selectedAccount.id}/templates/${editingTemplateId}`);
        } catch (err: any) {
          console.warn("Erro ao deletar versão anterior do template:", err.message);
        }
      }

      showAlert("Criando e registrando template na Meta...");
      const templateNameFormatted = newTemplateName
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "");

      await axios.post(`${API_BASE_URL}/accounts/${selectedAccount.id}/templates`, {
        name: templateNameFormatted,
        category: newTemplateCategory,
        language: newTemplateLanguage,
        components,
      });

      showAlert("Template enviado para aprovação com sucesso!");
      resetTemplateForm();
      setShowNewTemplateModal(false);
      fetchTemplates(selectedAccount.id);
    } catch (err: any) {
      const details = err.response?.data?.details?.error?.message || err.response?.data?.error || err.message;
      showAlert(`Erro: ${details}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // Detect quantity of variables in a template body
  const getVariablesCount = (bodyText: string) => {
    const matches = bodyText.match(/\{\{\d+\}\}/g);
    return matches ? new Set(matches).size : 0;
  };

  const handleTemplateSelectionChange = (name: string) => {
    setSelectedTemplateName(name);
    setMessageMediaUrl("");
    const tmpl = templates.find((t) => t.name === name);
    if (tmpl) {
      const bodyComp = tmpl.components.find((c: any) => c.type === "BODY");
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
          showAlert("Mensagem agendada com sucesso!");
        } else {
          showAlert("Mensagem enviada com sucesso!");
        }

        setRecipientNumber("");
        setSelectedTemplateName("");
        setTemplateVariables([]);
        setMessageMediaUrl("");
        setScheduledAt("");
        fetchMessages(selectedAccount.id);
      } catch (err: any) {
        const details = err.response?.data?.details?.error?.message || err.response?.data?.error || "Erro desconhecido";
        showAlert(`Falha no envio: ${details}`, "error");
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
          showAlert("Disparo em lote agendado com sucesso!");
        } else {
          showAlert("Disparo em lote iniciado com sucesso!");
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

  // Metrics processing mapped to active metricsData state
  const totalSent = metricsData.totals.sent;
  const totalDelivered = metricsData.totals.delivered;
  const totalRead = metricsData.totals.read;
  const totalFailed = metricsData.totals.failed;
  const totalAll = metricsData.totals.total;

  if (!token) {
    return <AuthPages onLoginSuccess={handleLoginSuccess} />;
  }

  const decoded = parseJwt(token);
  const isImpersonating = !!decoded?.impersonatorId;
  const impersonatorName = decoded?.impersonatorName;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", position: "relative" }}>
      {/* Background Ambient Glows */}
      <div className="ambient-glow-1"></div>
      <div className="ambient-glow-2"></div>

      {isImpersonating && (
        <div style={{
          backgroundColor: "#f59e0b",
          color: "#1e1b4b",
          padding: "10px 20px",
          fontSize: "0.95rem",
          fontWeight: "600",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 1001,
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
        }}>
          <span>
            ⚠️ MODO SUPORTE ATIVO: Visualizando e configurando o painel de <strong>{user?.name || user?.email}</strong> (por {impersonatorName}).
          </span>
          <button
            onClick={handleStopImpersonating}
            className="btn btn-secondary"
            style={{
              backgroundColor: "#fff",
              color: "#1e1b4b",
              border: "none",
              padding: "6px 14px",
              fontSize: "0.85rem",
              fontWeight: "700",
              cursor: "pointer"
            }}
          >
            Voltar para Administrador
          </button>
        </div>
      )}
      <div style={{ display: "flex", flex: 1 }}>
        {/* Sidebar */}
        <aside className="glass" style={{ width: "280px", padding: "20px 16px", display: "flex", flexDirection: "column", gap: "16px", borderRight: "1px solid var(--border-color)", height: "100vh", position: "sticky", top: 0, overflowY: "auto" }}>
          <div>
          <h2 style={{ fontSize: "1.6rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", fontFamily: "var(--font-sans)" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)", flexShrink: 0 }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span style={{ color: "var(--text-primary)" }}>Send</span>
            <span style={{ background: "linear-gradient(135deg, var(--primary) 0%, #10b981 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Inteligentte</span>
          </h2>
          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: "500" }}>por Inteligentte Lab</p>
        </div>

        {/* Account Switcher */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--text-secondary)", textTransform: "uppercase" }}>Conta Ativa</label>
          <select
            value={selectedAccount?.id || ""}
            onChange={(e) => {
              const acc = accounts.find((a) => a.id === e.target.value);
              if (acc) setSelectedAccount(acc);
            }}
            className="glass"
            style={{ width: "100%", padding: "10px", borderRadius: "var(--radius-md)", color: "var(--text-primary)", outline: "none", cursor: "pointer", border: "1px solid var(--border-color)", fontSize: "0.9rem" }}
          >
            {accounts.length === 0 ? (
              <option value="">Sem contas cadastradas</option>
            ) : (
              accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Navigation Menu */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <button
            onClick={() => setActiveTab("metrics")}
            className={`btn ${activeTab === "metrics" ? "btn-primary" : "btn-secondary"}`}
            style={{ justifyContent: "flex-start", width: "100%", padding: "10px 14px", fontSize: "0.85rem" }}
          >
            📊 Métricas
          </button>
          <button
            onClick={() => setActiveTab("templates")}
            className={`btn ${activeTab === "templates" ? "btn-primary" : "btn-secondary"}`}
            style={{ justifyContent: "flex-start", width: "100%", padding: "10px 14px", fontSize: "0.85rem" }}
          >
            📝 Templates Meta
          </button>
          <button
            onClick={() => setActiveTab("lists")}
            className={`btn ${activeTab === "lists" ? "btn-primary" : "btn-secondary"}`}
            style={{ justifyContent: "flex-start", width: "100%", padding: "10px 14px", fontSize: "0.85rem" }}
          >
            👥 Listas de Contatos
          </button>
          <button
            onClick={() => setActiveTab("messages")}
            className={`btn ${activeTab === "messages" ? "btn-primary" : "btn-secondary"}`}
            style={{ justifyContent: "flex-start", width: "100%", padding: "10px 14px", fontSize: "0.85rem" }}
          >
            🚀 Envio & Histórico
          </button>
          <button
            onClick={() => setActiveTab("media")}
            className={`btn ${activeTab === "media" ? "btn-primary" : "btn-secondary"}`}
            style={{ justifyContent: "flex-start", width: "100%", padding: "10px 14px", fontSize: "0.85rem" }}
          >
            🖼️ Galeria de Mídias
          </button>
          <button
            onClick={() => setActiveTab("accounts")}
            className={`btn ${activeTab === "accounts" ? "btn-primary" : "btn-secondary"}`}
            style={{ justifyContent: "flex-start", width: "100%", padding: "10px 14px", fontSize: "0.85rem" }}
          >
            ⚙️ Contas Meta API
          </button>
          {(user?.role === "SUPERUSER" || !!localStorage.getItem("admin_token")) && !isImpersonating && (
            <button
              onClick={() => setActiveTab("admin")}
              className={`btn ${activeTab === "admin" ? "btn-primary" : "btn-secondary"}`}
              style={{ justifyContent: "flex-start", width: "100%", padding: "10px 14px", fontSize: "0.85rem" }}
            >
              🛠️ Administração
            </button>
          )}
        </nav>

        {/* Bottom Section */}
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "14px", borderTop: "1px solid var(--border-color)", paddingTop: "15px" }}>
          {user && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-primary)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                  👤 {user.name || user.email}
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                  {user.email}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="btn btn-secondary"
                style={{
                  width: "100%",
                  background: "rgba(239, 68, 68, 0.08)",
                  color: "var(--error)",
                  borderColor: "rgba(239, 68, 68, 0.15)",
                  justifyContent: "flex-start",
                  padding: "8px 12px",
                  fontSize: "0.85rem",
                }}
              >
                🚪 Sair da Conta
              </button>
            </div>
          )}

          {/* Theme Toggle */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button
              id="theme-toggle-btn"
              onClick={() => setIsDarkTheme(!isDarkTheme)}
              title={isDarkTheme ? "Mudar para tema claro" : "Mudar para tema escuro"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "transparent",
                border: "1px solid var(--border-color)",
                borderRadius: "999px",
                padding: "5px 14px",
                cursor: "pointer",
                fontSize: "0.78rem",
                color: "var(--text-muted)",
                transition: "all 0.25s ease",
                backdropFilter: "blur(4px)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--primary)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--primary)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-color)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
              }}
            >
              {isDarkTheme ? "☀️ Tema Claro" : "🌙 Tema Escuro"}
            </button>
          </div>

          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center" }}>
            Desenvolvido por Inteligentte Lab | v1.0.0
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: "40px", overflowY: "auto" }}>
        
        {/* Alert Notifications */}
        {alert && (
          <div className="fade-in" style={{
            position: "fixed", top: "24px", right: "32px", zIndex: 2000,
            padding: "16px 24px", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", gap: "10px",
            background: alert.type === "success" ? "rgba(16, 185, 129, 0.92)" : "rgba(239, 68, 68, 0.92)",
            color: "#fff", backdropFilter: "blur(8px)", boxShadow: "0 10px 30px rgba(0, 0, 0, 0.35)",
            maxWidth: "420px",
          }}>
            {alert.type === "success" ? "✅" : "⚠️"} {alert.text}
          </div>
        )}


        {/* Tab 1: METRICS */}
        {activeTab === "metrics" && (
          <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px" }}>
              <div>
                <h1 style={{ fontSize: "2rem", fontWeight: "700", marginBottom: "8px" }}>Painel de Métricas</h1>
                <p style={{ color: "var(--text-secondary)" }}>Visão geral dos disparos efetuados pela conta <strong>{selectedAccount?.name || "Nenhuma conta selecionada"}</strong></p>
              </div>
              
              <button 
                type="button" 
                onClick={() => selectedAccount && fetchMetrics(selectedAccount.id)} 
                className="btn btn-secondary" 
                style={{ padding: "8px 14px", fontSize: "0.85rem" }}
                disabled={!selectedAccount}
              >
                🔄 Atualizar Dados
              </button>
            </div>

            {/* Filtros de Período */}
            <div className="glass" style={{ padding: "20px 24px", borderRadius: "var(--radius-lg)", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "15px" }}>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {(["7days", "today", "yesterday", "30days", "custom"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setMetricsPeriod(p)}
                    className={`btn ${metricsPeriod === p ? "btn-primary" : "btn-secondary"}`}
                    style={{ padding: "8px 14px", fontSize: "0.85rem" }}
                  >
                    {p === "7days" && "Últimos 7 dias"}
                    {p === "today" && "Hoje"}
                    {p === "yesterday" && "Ontem"}
                    {p === "30days" && "Últimos 30 dias"}
                    {p === "custom" && "Personalizado"}
                  </button>
                ))}
              </div>

              {metricsPeriod === "custom" && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>De:</label>
                    <input
                      type="date"
                      value={metricsStartDate}
                      onChange={(e) => setMetricsStartDate(e.target.value)}
                      style={{ padding: "6px 10px", borderRadius: "var(--radius-sm)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none", fontSize: "0.85rem" }}
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Até:</label>
                    <input
                      type="date"
                      value={metricsEndDate}
                      onChange={(e) => setMetricsEndDate(e.target.value)}
                      style={{ padding: "6px 10px", borderRadius: "var(--radius-sm)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none", fontSize: "0.85rem" }}
                    />
                  </div>
                </div>
              )}
            </div>

            {!selectedAccount ? (
              <div className="glass" style={{ padding: "40px", textAlign: "center", borderRadius: "var(--radius-xl)" }}>
                <p style={{ color: "var(--text-muted)" }}>Nenhuma conta Meta API selecionada. Configure ou ative uma conta para visualizar métricas.</p>
              </div>
            ) : (
              <>
                {/* Metrics cards grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
                  <div className="glass glass-interactive hover-glow-primary" style={{ padding: "24px", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: "600", textTransform: "uppercase" }}>Total Disparado</span>
                    <span style={{ fontSize: "2.5rem", fontWeight: "700" }}>{totalAll}</span>
                  </div>
                  <div className="glass glass-interactive hover-glow-purple" style={{ padding: "24px", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <span style={{ color: "#818cf8", fontSize: "0.85rem", fontWeight: "600", textTransform: "uppercase" }}>Enviado</span>
                    <span style={{ fontSize: "2.5rem", fontWeight: "700", color: "#818cf8" }}>{totalSent}</span>
                  </div>
                  <div className="glass glass-interactive hover-glow-cyan" style={{ padding: "24px", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <span style={{ color: "#22d3ee", fontSize: "0.85rem", fontWeight: "600", textTransform: "uppercase" }}>Entregue</span>
                    <span style={{ fontSize: "2.5rem", fontWeight: "700", color: "#22d3ee" }}>{totalDelivered}</span>
                  </div>
                  <div className="glass glass-interactive hover-glow-success" style={{ padding: "24px", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <span style={{ color: "var(--success)", fontSize: "0.85rem", fontWeight: "600", textTransform: "uppercase" }}>Lido</span>
                    <span style={{ fontSize: "2.5rem", fontWeight: "700", color: "var(--success)" }}>{totalRead}</span>
                  </div>
                  <div className="glass glass-interactive hover-glow-error" style={{ padding: "24px", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <span style={{ color: "var(--error)", fontSize: "0.85rem", fontWeight: "600", textTransform: "uppercase" }}>Falhas</span>
                    <span style={{ fontSize: "2.5rem", fontWeight: "700", color: "var(--error)" }}>{totalFailed}</span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: "25px", alignItems: "stretch" }}>
                  {/* Delivery Funnel */}
                  <div className="glass" style={{ padding: "30px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "20px" }}>
                    <h3 style={{ fontSize: "1.2rem", fontWeight: "600" }}>Funil de Entrega</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "24px", justifyContent: "center", flex: 1 }}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "0.9rem" }}>
                          <span>Taxa de Leitura (Abertura)</span>
                          <span style={{ fontWeight: "600" }}>{totalAll > 0 ? Math.round((totalRead / totalAll) * 100) : 0}%</span>
                        </div>
                        <div style={{ height: "10px", background: "rgba(255,255,255,0.05)", borderRadius: "5px", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${totalAll > 0 ? (totalRead / totalAll) * 100 : 0}%`, background: "var(--success)", borderRadius: "5px", transition: "width 0.4s ease" }}></div>
                        </div>
                      </div>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "0.9rem" }}>
                          <span>Taxa de Entrega (Recebimento)</span>
                          <span style={{ fontWeight: "600" }}>{totalAll > 0 ? Math.round(((totalDelivered + totalRead) / totalAll) * 100) : 0}%</span>
                        </div>
                        <div style={{ height: "10px", background: "rgba(255,255,255,0.05)", borderRadius: "5px", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${totalAll > 0 ? ((totalDelivered + totalRead) / totalAll) * 100 : 0}%`, background: "#06b6d4", borderRadius: "5px", transition: "width 0.4s ease" }}></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* HTML/CSS-based Daily Trends Bar Chart */}
                  <div className="glass" style={{ padding: "30px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                      <h3 style={{ fontSize: "1.2rem", fontWeight: "600" }}>Histórico de Envio Diário</h3>
                      <div style={{ display: "flex", gap: "12px", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "var(--primary)" }}></span> Enviados
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "#06b6d4" }}></span> Lidos
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "var(--error)" }}></span> Falhas
                        </div>
                      </div>
                    </div>

                    {metricsData.chartData.length === 0 ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, minHeight: "220px", color: "var(--text-muted)", fontSize: "0.95rem" }}>
                        Nenhum envio registrado neste período.
                      </div>
                                        ) : (() => {
                      const maxRaw = Math.max(...metricsData.chartData.map(d => Math.max(d.sent, d.failed)), 10);
                      // Arredonda para cima para múltiplos de 5 para as linhas guia ficarem com números inteiros limpos
                      const maxVal = maxRaw <= 10 ? 10 : Math.ceil(maxRaw / 5) * 5;

                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, justifyContent: "flex-end" }}>
                          {/* Y-Axis scale and chart layout */}
                          <div style={{ display: "flex", gap: "12px", height: "220px", position: "relative" }}>
                            {/* Y-Axis Labels */}
                            <div style={{
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                              alignItems: "flex-end",
                              width: "30px",
                              color: "var(--text-muted)",
                              fontSize: "0.75rem",
                              paddingBottom: "8px",
                              userSelect: "none"
                            }}>
                              <span>{maxVal}</span>
                              <span>{Math.round(maxVal * 0.75)}</span>
                              <span>{Math.round(maxVal * 0.50)}</span>
                              <span>{Math.round(maxVal * 0.25)}</span>
                              <span>0</span>
                            </div>

                            {/* Chart Area */}
                            <div style={{
                              flex: 1,
                              position: "relative",
                              height: "100%"
                            }}>
                              {/* Gridlines */}
                              <div style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: "8px",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                                pointerEvents: "none"
                              }}>
                                <div style={{ borderBottom: "1px dashed rgba(255,255,255,0.06)", width: "100%", height: 0 }}></div>
                                <div style={{ borderBottom: "1px dashed rgba(255,255,255,0.06)", width: "100%", height: 0 }}></div>
                                <div style={{ borderBottom: "1px dashed rgba(255,255,255,0.06)", width: "100%", height: 0 }}></div>
                                <div style={{ borderBottom: "1px dashed rgba(255,255,255,0.06)", width: "100%", height: 0 }}></div>
                                <div style={{ borderBottom: "1px solid var(--border-color)", width: "100%", height: 0 }}></div>
                              </div>

                              {/* Bars columns wrapper */}
                              <div style={{
                                display: "flex",
                                alignItems: "flex-end",
                                justifyContent: "space-between",
                                height: "100%",
                                paddingBottom: "8px",
                                gap: "8px",
                                position: "relative",
                                zIndex: 2
                              }}>
                                {metricsData.chartData.map((d, index) => {
                                  const dayMax = Math.max(d.sent, d.failed);
                                  const heightPercent = dayMax > 0 ? (dayMax / maxVal) * 100 : 0;
                                  const readPercent = d.sent > 0 ? (d.read / d.sent) * 100 : 0;

                                  const tooltip = `${new Date(d.date + "T00:00:00").toLocaleDateString()}:\n• Enviados/Entregues: ${d.sent}\n• Lidos: ${d.read}\n• Falhas: ${d.failed}`;

                                  return (
                                    <div
                                      key={index}
                                      title={tooltip}
                                      style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        flex: 1,
                                        height: `${heightPercent}%`,
                                        minWidth: "16px",
                                        position: "relative",
                                        cursor: "pointer"
                                      }}
                                    >
                                      <div style={{
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "flex-end",
                                        width: "100%",
                                        height: "100%",
                                        gap: "2px"
                                      }}>
                                        {/* Successful + Read Column */}
                                        {d.sent > 0 && (
                                          <div style={{
                                            width: "45%",
                                            height: "100%",
                                            position: "relative",
                                            display: "flex",
                                            flexDirection: "column",
                                            justifyContent: "flex-end"
                                          }}>
                                            {/* Read Layer (Cyan Overlay) */}
                                            {d.read > 0 && (
                                              <div style={{
                                                width: "100%",
                                                height: `${readPercent}%`,
                                                background: "linear-gradient(to top, #06b6d4, #22d3ee)",
                                                borderRadius: "2px 2px 0 0",
                                                position: "absolute",
                                                bottom: 0,
                                                zIndex: 2,
                                                boxShadow: "0 0 8px rgba(6,182,212,0.2)"
                                              }}></div>
                                            )}
                                            {/* Sent Base Layer (Green) */}
                                            <div style={{
                                              width: "100%",
                                              height: "100%",
                                              background: "linear-gradient(to top, var(--primary), #10b981)",
                                              borderRadius: "2px 2px 0 0",
                                              zIndex: 1,
                                              boxShadow: "0 0 8px rgba(0,194,107,0.2)"
                                            }}></div>
                                          </div>
                                        )}

                                        {/* Failed Column (Red) */}
                                        {d.failed > 0 && (
                                          <div style={{
                                            width: "45%",
                                            height: `${(d.failed / dayMax) * 100}%`,
                                            background: "linear-gradient(to top, var(--error), #ef4444)",
                                            borderRadius: "2px 2px 0 0",
                                            boxShadow: "0 0 8px rgba(239,68,68,0.2)"
                                          }}></div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {/* X Axis labels */}
                          <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                            padding: "0 4px",
                            marginLeft: "42px" // Deslocado para alinhar perfeitamente com a área de colunas (30px eixo Y + 12px gap)
                          }}>
                            <span>{new Date(metricsData.chartData[0].date + "T00:00:00").toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                            {metricsData.chartData.length > 2 && (
                              <span>{new Date(metricsData.chartData[Math.floor(metricsData.chartData.length / 2)].date + "T00:00:00").toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                            )}
                            <span>{new Date(metricsData.chartData[metricsData.chartData.length - 1].date + "T00:00:00").toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Desempenho por Template */}
                <div className="glass" style={{ padding: "30px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "20px", marginTop: "25px" }}>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: "600" }}>Desempenho por Template</h3>
                  {!metricsData.templateMetrics || metricsData.templateMetrics.length === 0 ? (
                    <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>Nenhuma métrica de template registrada neste período.</p>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                        <thead>
                          <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}>
                            <th style={{ padding: "12px 8px" }}>Nome do Template</th>
                            <th style={{ padding: "12px 8px" }}>Disparados</th>
                            <th style={{ padding: "12px 8px" }}>Enviados</th>
                            <th style={{ padding: "12px 8px" }}>Lidos</th>
                            <th style={{ padding: "12px 8px" }}>Falhas</th>
                            <th style={{ padding: "12px 8px" }}>Taxa de Leitura</th>
                          </tr>
                        </thead>
                        <tbody>
                          {metricsData.templateMetrics.map((t, idx) => {
                            const readRate = t.sent > 0 ? Math.round((t.read / t.sent) * 100) : 0;
                            return (
                              <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                <td style={{ padding: "12px 8px", fontWeight: "600" }}>{t.templateName}</td>
                                <td style={{ padding: "12px 8px" }}>{t.total}</td>
                                <td style={{ padding: "12px 8px", color: "#818cf8" }}>{t.sent}</td>
                                <td style={{ padding: "12px 8px", color: "var(--success)" }}>{t.read}</td>
                                <td style={{ padding: "12px 8px", color: "var(--error)" }}>{t.failed}</td>
                                <td style={{ padding: "12px 8px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span style={{ fontWeight: "600" }}>{readRate}%</span>
                                    <div style={{ width: "60px", height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", overflow: "hidden" }}>
                                      <div style={{ height: "100%", width: `${readRate}%`, background: "var(--success)", borderRadius: "3px" }}></div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 2: CONFIGURAÇÕES (ACCOUNTS) */}
        {activeTab === "accounts" && (
          <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
            <div>
              <h1 style={{ fontSize: "2rem", fontWeight: "700", marginBottom: "8px" }}>Configurações de Contas Meta API</h1>
              <p style={{ color: "var(--text-secondary)" }}>Gerencie suas contas do WhatsApp Business integradas</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "30px", alignItems: "start" }}>
              {/* Wizard de Conexão */}
              <div>
                <SetupWizard onSave={(newAcc) => {
                  fetchAccounts();
                  setSelectedAccount(newAcc);
                }} />
              </div>

              {/* Lista de Contas */}
              <div className="glass" style={{ padding: "30px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "20px" }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: "600" }}>Contas Configuradas</h3>

                {accounts.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>Nenhuma conta cadastrada ainda.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {accounts.map((acc) => (
                      <div key={acc.id} className="glass" style={{ padding: "20px", borderRadius: "var(--radius-md)", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span style={{ fontWeight: "600", fontSize: "1.1rem" }}>{acc.name}</span>
                          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}><strong>ID Interno (n8n/API):</strong> {acc.id}</span>
                          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>WABA ID: {acc.wabaId}</span>
                          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Phone ID: {acc.phoneNumberId}</span>
                        </div>
                        <button onClick={() => handleDeleteAccount(acc.id)} className="btn btn-danger" style={{ padding: "8px 14px", fontSize: "0.85rem" }}>
                          Excluir
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: TEMPLATES */}
        {activeTab === "templates" && (
          <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h1 style={{ fontSize: "2rem", fontWeight: "700", marginBottom: "8px" }}>Gestão de Templates</h1>
                <p style={{ color: "var(--text-secondary)" }}>Veja o status de aprovação da Meta ou crie novos templates</p>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={syncTemplates} disabled={syncingTemplates || !selectedAccount} className="btn btn-secondary">
                  🔄 {syncingTemplates ? "Sincronizando..." : "Sincronizar Meta"}
                </button>
                <button onClick={() => setShowNewTemplateModal(true)} disabled={!selectedAccount} className="btn btn-primary">
                  ➕ Novo Template
                </button>
              </div>
            </div>

            {!selectedAccount ? (
              <div className="glass" style={{ padding: "40px", textAlign: "center", borderRadius: "var(--radius-xl)" }}>
                <p style={{ color: "var(--text-muted)" }}>Cadastre uma conta da Meta primeiro nas Configurações.</p>
              </div>
            ) : templates.length === 0 ? (
              <div className="glass" style={{ padding: "40px", textAlign: "center", borderRadius: "var(--radius-xl)", color: "var(--text-muted)" }}>
                <p>Nenhum template encontrado para esta conta. Clique em Sincronizar ou crie um novo template.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
                {templates.map((tmpl) => {
                  const bodyComp = tmpl.components.find((c: any) => c.type === "BODY");
                  const headerComp = tmpl.components.find((c: any) => c.type === "HEADER");
                  const footerComp = tmpl.components.find((c: any) => c.type === "FOOTER");

                  return (
                    <div key={tmpl.id} className="glass glass-interactive" style={{ padding: "24px", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", gap: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", width: "100%" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{ fontSize: "1.1rem", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={tmpl.name}>{tmpl.name}</h4>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>{tmpl.category} • {tmpl.language}</span>
                        </div>
                        <span className={`badge badge-${tmpl.status.toLowerCase()}`} style={{ flexShrink: 0 }}>
                          {tmpl.status}
                        </span>
                      </div>

                      {/* Preview Box */}
                      <div style={{ padding: "16px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", fontSize: "0.9rem", flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                        {headerComp && <div style={{ fontWeight: "700", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "4px" }}>{headerComp.text}</div>}
                        <div style={{ whiteSpace: "pre-wrap", color: "#e5e7eb" }}>{bodyComp?.text}</div>
                        {footerComp && <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "4px" }}>{footerComp.text}</div>}
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "12px" }}>
                        <button
                          onClick={() => handleEditTemplate(tmpl)}
                          className="btn btn-secondary"
                          style={{ padding: "8px 14px", fontSize: "0.85rem" }}
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => setDeleteConfirmTemplate({ id: tmpl.id, name: tmpl.name })}
                          className="btn btn-danger"
                          style={{ padding: "8px 14px", fontSize: "0.85rem" }}
                        >
                          🗑️ Excluir
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {deleteConfirmTemplate && (<ModalPortal>
              <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
                <div className="glass fade-in" style={{ width: "450px", maxWidth: "90vw", padding: "30px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "20px" }}>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: "700" }}>Confirmar Exclusão</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: "1.5" }}>
                    Tem certeza que deseja excluir o template <strong>{deleteConfirmTemplate.name}</strong> permanentemente da Meta e do banco de dados? Esta ação não pode ser desfeita.
                  </p>
                  <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "10px" }}>
                    <button type="button" onClick={() => setDeleteConfirmTemplate(null)} className="btn btn-secondary">Cancelar</button>
                    <button
                      type="button"
                      onClick={async () => {
                        const { id } = deleteConfirmTemplate;
                        setDeleteConfirmTemplate(null);
                        await handleDeleteTemplate(id);
                      }}
                      className="btn btn-danger"
                    >
                      Excluir Template
                    </button>
                  </div>
                </div>
              </div>
            </ModalPortal>)}

            {/* Modal de Criação de Template (Template Builder Premium) */}
            {showNewTemplateModal && (<ModalPortal>
              <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
                <div className="glass fade-in" style={{ width: "950px", maxWidth: "95vw", height: "90vh", display: "flex", flexDirection: "column", borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
                  
                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 30px", borderBottom: "1px solid var(--border-color)", background: "rgba(0,0,0,0.1)" }}>
                    <h3 style={{ fontSize: "1.3rem", fontWeight: "700" }}>
                      {editingTemplateId ? "Editar Template (Reenvio para Aprovação)" : "Criar Novo Template"}
                    </h3>
                    <button type="button" onClick={() => { resetTemplateForm(); setShowNewTemplateModal(false); }} style={{ background: "none", border: "none", color: "#fff", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
                  </div>

                  {/* Content split in columns */}
                  <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                    
                    {/* Left Side: Form */}
                    <form onSubmit={handleCreateTemplate} style={{ flex: 1.2, padding: "24px 30px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "18px", borderRight: "1px solid var(--border-color)" }}>
                      
                      {editingTemplateId && (
                        <div style={{
                          background: "rgba(245, 158, 11, 0.1)",
                          border: "1px solid rgba(245, 158, 11, 0.2)",
                          color: "#f59e0b",
                          padding: "10px 14px",
                          borderRadius: "var(--radius-md)",
                          fontSize: "0.8rem",
                          lineHeight: "1.4"
                        }}>
                          ⚠️ <strong>Aviso de Re-aprovação:</strong> Alterar as mídias ou textos deste template exigirá que a Meta o re-avalie. A versão antiga será deletada ao salvar as alterações.
                        </div>
                      )}

                      {/* Name, Category, Language */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>Nome do Template</label>
                        <input
                          type="text"
                          placeholder="Somente letras minúsculas e _ (ex: confirmacao_compra)"
                          value={newTemplateName}
                          onChange={(e) => setNewTemplateName(e.target.value)}
                          disabled={!!editingTemplateId}
                          style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none", opacity: editingTemplateId ? 0.6 : 1 }}
                        />
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>Categoria</label>
                          <select
                            value={newTemplateCategory}
                            onChange={(e) => setNewTemplateCategory(e.target.value)}
                            style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none" }}
                          >
                            <option value="MARKETING">Marketing</option>
                            <option value="UTILITY">Utilidade</option>
                          </select>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>Idioma</label>
                          <input
                            type="text"
                            placeholder="pt_BR"
                            value={newTemplateLanguage}
                            onChange={(e) => setNewTemplateLanguage(e.target.value)}
                            style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none" }}
                          />
                        </div>
                      </div>

                      {/* HEADER Config */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "15px" }}>
                        <h4 style={{ fontSize: "0.95rem", fontWeight: "600", color: "var(--text-secondary)" }}>Cabeçalho (Opcional)</h4>
                        
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          {(["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"] as const).map((fmt) => (
                            <button
                              key={fmt}
                              type="button"
                              onClick={() => {
                                setNewTemplateHeaderFormat(fmt);
                                setNewTemplateHeaderText("");
                                setSampleFile(null);
                                setSampleFileBase64("");
                                if (sampleFilePreviewUrl) URL.revokeObjectURL(sampleFilePreviewUrl);
                                setSampleFilePreviewUrl("");
                              }}
                              className={`btn ${newTemplateHeaderFormat === fmt ? "btn-primary" : "btn-secondary"}`}
                              style={{ padding: "8px 14px", fontSize: "0.8rem", flex: 1, minWidth: "80px" }}
                            >
                              {fmt === "NONE" && "Nenhum"}
                              {fmt === "TEXT" && "Texto"}
                              {fmt === "IMAGE" && "Imagem"}
                              {fmt === "VIDEO" && "Vídeo"}
                              {fmt === "DOCUMENT" && "Documento"}
                            </button>
                          ))}
                        </div>

                        {newTemplateHeaderFormat === "TEXT" && (
                          <input
                            type="text"
                            placeholder="Texto do cabeçalho (ex: Bem-vindo!)"
                            value={newTemplateHeaderText}
                            onChange={(e) => setNewTemplateHeaderText(e.target.value)}
                            style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none" }}
                          />
                        )}

                        {["IMAGE", "VIDEO", "DOCUMENT"].includes(newTemplateHeaderFormat) && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                              Arquivo de Exemplo (.jpg, .png, .mp4, .pdf - Máx 5MB)
                            </label>
                            <input
                              type="file"
                              accept={newTemplateHeaderFormat === "IMAGE" ? "image/*" : newTemplateHeaderFormat === "VIDEO" ? "video/*" : "application/pdf,.doc,.docx"}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (file.size > 5 * 1024 * 1024) {
                                  showAlert("O tamanho do arquivo excede 5MB. Escolha um arquivo menor.", "error");
                                  return;
                                }
                                setSampleFile(file);
                                const objectUrl = URL.createObjectURL(file);
                                setSampleFilePreviewUrl(objectUrl);

                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setSampleFileBase64(reader.result as string);
                                };
                                reader.readAsDataURL(file);
                              }}
                              style={{
                                padding: "8px",
                                borderRadius: "var(--radius-md)",
                                background: "rgba(255,255,255,0.02)",
                                border: "1px dashed var(--border-color)",
                                color: "var(--text-secondary)",
                                fontSize: "0.85rem",
                                cursor: "pointer"
                              }}
                            />
                          </div>
                        )}
                      </div>

                      {/* BODY Config */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "15px" }}>
                        <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>Corpo da Mensagem (Obrigatório)</label>
                        <textarea
                          placeholder="Olá {{1}}, seu pedido {{2}} foi recebido!"
                          value={newTemplateBodyText}
                          onChange={(e) => setNewTemplateBodyText(e.target.value)}
                          rows={3}
                          style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", resize: "none", fontFamily: "inherit", outline: "none" }}
                        />
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Use {"{{1}}"}, {"{{2}}"} para indicar variáveis dinâmicas.</span>

                        {/* Dynamic Variables Examples Inputs */}
                        {newTemplateBodyVariables.length > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px", background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "var(--radius-md)", marginTop: "6px" }}>
                            <span style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--text-secondary)" }}>Exemplos das Variáveis (Obrigatório pela Meta)</span>
                            {newTemplateBodyVariables.map((val, idx) => (
                              <div key={idx} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <span style={{ fontSize: "0.8rem", color: "var(--primary)", fontWeight: "bold", width: "40px" }}>{"{{" + (idx + 1) + "}}"}</span>
                                <input
                                  type="text"
                                  placeholder={`Ex: João`}
                                  value={val}
                                  onChange={(e) => {
                                    const updated = [...newTemplateBodyVariables];
                                    updated[idx] = e.target.value;
                                    setNewTemplateBodyVariables(updated);
                                  }}
                                  style={{ flex: 1, padding: "8px", borderRadius: "var(--radius-sm)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", fontSize: "0.85rem", outline: "none" }}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* FOOTER Config */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "15px" }}>
                        <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>Rodapé (Opcional)</label>
                        <input
                          type="text"
                          placeholder="Texto pequeno no rodapé (ex: Cancelar inscrições digite SAIR)"
                          value={newTemplateFooterText}
                          onChange={(e) => setNewTemplateFooterText(e.target.value)}
                          style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none" }}
                        />
                      </div>

                      {/* BUTTONS Config */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "15px" }}>
                        <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>Botões interativos</label>
                        
                        <select
                          value={newTemplateButtonType}
                          onChange={(e) => {
                            const type = e.target.value as "NONE" | "QUICK_REPLY" | "CTA";
                            setNewTemplateButtonType(type);
                            setNewTemplateButtons([]);
                          }}
                          style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none" }}
                        >
                          <option value="NONE">Sem botões</option>
                          <option value="QUICK_REPLY">Respostas Rápidas (Até 10)</option>
                          <option value="CTA">Chamada para Ação (CTA - Link/Ligação - Máx 2)</option>
                        </select>

                        {newTemplateButtonType === "QUICK_REPLY" && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {newTemplateButtons.map((btn, idx) => (
                              <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                <input
                                  type="text"
                                  placeholder={`Texto do botão ${idx + 1} (máx 25 carac.)`}
                                  maxLength={25}
                                  value={btn.text}
                                  onChange={(e) => {
                                    const updated = [...newTemplateButtons];
                                    updated[idx].text = e.target.value;
                                    setNewTemplateButtons(updated);
                                  }}
                                  style={{ flex: 1, padding: "10px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none", fontSize: "0.85rem" }}
                                />
                                <button
                                  type="button"
                                  onClick={() => setNewTemplateButtons(prev => prev.filter((_, i) => i !== idx))}
                                  className="btn btn-secondary"
                                  style={{ padding: "10px 14px", background: "rgba(239, 68, 68, 0.1)", color: "var(--error)", border: "1px solid rgba(239, 68, 68, 0.2)" }}
                                >
                                  Remover
                                </button>
                              </div>
                            ))}
                            {newTemplateButtons.length < 10 && (
                              <button
                                type="button"
                                onClick={() => setNewTemplateButtons([...newTemplateButtons, { type: "QUICK_REPLY", text: "" }])}
                                className="btn btn-secondary"
                                style={{ fontSize: "0.85rem" }}
                              >
                                + Adicionar Botão de Resposta
                              </button>
                            )}
                          </div>
                        )}

                        {newTemplateButtonType === "CTA" && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                            {newTemplateButtons.map((btn, idx) => (
                              <div key={idx} className="glass" style={{ padding: "15px", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--primary)" }}>Botão {idx + 1}</span>
                                  <button
                                    type="button"
                                    onClick={() => setNewTemplateButtons(prev => prev.filter((_, i) => i !== idx))}
                                    className="btn btn-secondary"
                                    style={{ padding: "6px 12px", fontSize: "0.75rem", background: "rgba(239, 68, 68, 0.1)", color: "var(--error)", border: "1px solid rgba(239, 68, 68, 0.2)" }}
                                  >
                                    Remover
                                  </button>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                  <select
                                    value={btn.type}
                                    onChange={(e) => {
                                      const type = e.target.value as "URL" | "PHONE_NUMBER";
                                      const updated = [...newTemplateButtons];
                                      updated[idx].type = type;
                                      if (type === "URL") {
                                        updated[idx].url = "";
                                        delete updated[idx].phoneNumber;
                                      } else {
                                        updated[idx].phoneNumber = "";
                                        delete updated[idx].url;
                                      }
                                      setNewTemplateButtons(updated);
                                    }}
                                    style={{ padding: "8px", borderRadius: "var(--radius-sm)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none", fontSize: "0.85rem" }}
                                  >
                                    <option value="URL">Link Web (URL)</option>
                                    <option value="PHONE_NUMBER">Ligar para Telefone</option>
                                  </select>
                                  <input
                                    type="text"
                                    placeholder="Texto do botão (máx 25 carac.)"
                                    maxLength={25}
                                    value={btn.text}
                                    onChange={(e) => {
                                      const updated = [...newTemplateButtons];
                                      updated[idx].text = e.target.value;
                                      setNewTemplateButtons(updated);
                                    }}
                                    style={{ padding: "8px", borderRadius: "var(--radius-sm)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none", fontSize: "0.85rem" }}
                                  />
                                </div>

                                {btn.type === "URL" ? (
                                  <input
                                    type="text"
                                    placeholder="https://exemplo.com"
                                    value={btn.url || ""}
                                    onChange={(e) => {
                                      const updated = [...newTemplateButtons];
                                      updated[idx].url = e.target.value;
                                      setNewTemplateButtons(updated);
                                    }}
                                    style={{ padding: "8px", borderRadius: "var(--radius-sm)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none", fontSize: "0.85rem" }}
                                  />
                                ) : (
                                  <input
                                    type="text"
                                    placeholder="Número de telefone internacional (ex: +5511999999999)"
                                    value={btn.phoneNumber || ""}
                                    onChange={(e) => {
                                      const updated = [...newTemplateButtons];
                                      updated[idx].phoneNumber = e.target.value;
                                      setNewTemplateButtons(updated);
                                    }}
                                    style={{ padding: "8px", borderRadius: "var(--radius-sm)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none", fontSize: "0.85rem" }}
                                  />
                                )}
                              </div>
                            ))}
                            {newTemplateButtons.length < 2 && (
                              <button
                                type="button"
                                onClick={() => setNewTemplateButtons([...newTemplateButtons, { type: "URL", text: "" }])}
                                className="btn btn-secondary"
                                style={{ fontSize: "0.85rem" }}
                              >
                                + Adicionar Botão de Ação
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                    </form>

                    {/* Right Side: Simulator Preview */}
                    <div style={{ flex: 0.8, padding: "24px 30px", background: "rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "15px" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Pré-visualização em tempo real</span>
                      <PhoneSimulator
                        headerFormat={newTemplateHeaderFormat}
                        headerText={newTemplateHeaderText}
                        mediaUrl={sampleFilePreviewUrl}
                        bodyText={newTemplateBodyText}
                        variables={newTemplateBodyVariables}
                        footerText={newTemplateFooterText}
                        buttons={newTemplateButtons}
                      />
                    </div>

                  </div>

                  {/* Footer Actions */}
                  <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", padding: "20px 30px", borderTop: "1px solid var(--border-color)", background: "rgba(0,0,0,0.1)" }}>
                    <button type="button" onClick={() => { resetTemplateForm(); setShowNewTemplateModal(false); }} className="btn btn-secondary">Cancelar</button>
                    <button type="button" onClick={handleCreateTemplate} disabled={loading} className="btn btn-primary" style={{ minWidth: "150px" }}>
                      {loading ? "Processando..." : "Enviar para Meta"}
                    </button>
                  </div>

                </div>
              </div>
            </ModalPortal>)}
          </div>
        )}

        {/* Tab: CONTACT LISTS */}
        {activeTab === "lists" && (
          <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h1 style={{ fontSize: "2rem", fontWeight: "700", marginBottom: "8px" }}>👥 Listas de Contatos</h1>
                <p style={{ color: "var(--text-secondary)" }}>Crie e gerencie contatos para seus disparos em massa</p>
              </div>
              <button onClick={() => setShowNewListModal(true)} disabled={!selectedAccount} className="btn btn-primary">
                👥 Nova Lista
              </button>
            </div>

            {!selectedAccount ? (
              <div className="glass" style={{ padding: "40px", textAlign: "center", borderRadius: "var(--radius-xl)" }}>
                <p style={{ color: "var(--text-muted)" }}>Cadastre uma conta da Meta primeiro nas Configurações.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: "30px", alignItems: "start" }}>
                
                {/* Left Column: Lists list */}
                <div className="glass" style={{ padding: "30px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "20px" }}>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: "600" }}>Suas Listas</h3>
                  
                  {loadingLists ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div className="skeleton" style={{ width: "100%", height: "55px", borderRadius: "12px" }}></div>
                      <div className="skeleton" style={{ width: "100%", height: "55px", borderRadius: "12px" }}></div>
                      <div className="skeleton" style={{ width: "100%", height: "55px", borderRadius: "12px" }}></div>
                    </div>
                  ) : contactLists.length === 0 ? (
                    <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>Nenhuma lista cadastrada. Crie uma nova lista para importar contatos!</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      {contactLists.map((list) => (
                        <div
                          key={list.id}
                          onClick={() => handleViewListDetails(list)}
                          className="glass glass-interactive"
                          style={{
                            padding: "20px",
                            borderRadius: "var(--radius-md)",
                            cursor: "pointer",
                            border: selectedList?.id === list.id ? "1.5px solid var(--primary)" : "1px solid rgba(255,255,255,0.05)",
                            background: selectedList?.id === list.id ? "rgba(0, 194, 107, 0.05)" : undefined,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <span style={{ fontWeight: "600", fontSize: "1.1rem" }}>{list.name}</span>
                            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                              👤 {list._count?.contacts || 0} Contatos
                            </span>
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                              Criado em: {new Date(list.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteContactList(list.id, list.name);
                            }}
                            className="btn btn-danger"
                            style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                          >
                            Excluir
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right Column: List details / Contacts */}
                <div className="glass" style={{ padding: "30px", borderRadius: "var(--radius-xl)", minHeight: "400px", display: "flex", flexDirection: "column", gap: "20px" }}>
                  {selectedList ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "15px" }}>
                        <div>
                          <h3 style={{ fontSize: "1.3rem", fontWeight: "700" }}>{selectedList.name}</h3>
                          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Detalhamento de contatos importados</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setEditListName(selectedList.name);
                              setEditContacts(
                                (selectedList.contacts || []).map((c: any) => ({
                                  id: c.id,
                                  name: c.name || "",
                                  phone: c.phone,
                                  variablesStr: c.variables ? c.variables.join(", ") : ""
                                }))
                              );
                              setShowEditListModal(selectedList);
                            }}
                            className="btn btn-secondary"
                            style={{ padding: "6px 12px", fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
                          >
                            ✏️ Editar Lista
                          </button>
                          <span style={{ background: "var(--primary)", color: "#fff", padding: "6px 14px", borderRadius: "20px", fontSize: "0.8rem", fontWeight: "600" }}>
                            {selectedList.contacts?.length || 0} contatos
                          </span>
                        </div>
                      </div>

                      {selectedList.contacts?.length === 0 ? (
                        <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "40px" }}>Esta lista não possui contatos.</p>
                      ) : (
                        <div style={{ overflowX: "auto", maxHeight: "450px" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                            <thead>
                              <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}>
                                <th style={{ padding: "12px 8px" }}>Nome</th>
                                <th style={{ padding: "12px 8px" }}>Telefone</th>
                                <th style={{ padding: "12px 8px" }}>Variáveis Extra</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedList.contacts.map((contact: any) => (
                                <tr key={contact.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                  <td style={{ padding: "12px 8px", fontWeight: "500" }}>{contact.name || "-"}</td>
                                  <td style={{ padding: "12px 8px" }}>{contact.phone}</td>
                                  <td style={{ padding: "12px 8px", color: "var(--text-secondary)" }}>
                                    {contact.variables && contact.variables.length > 0 ? (
                                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                        {contact.variables.map((v: string, i: number) => (
                                          <span key={i} style={{ background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: "4px", fontSize: "0.75rem" }}>
                                            var{i+1}: {v}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      "-"
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text-muted)", textAlign: "center", padding: "40px" }}>
                      <span style={{ fontSize: "3rem", marginBottom: "15px" }}>👥</span>
                      Selecione uma lista à esquerda para visualizar seus contatos e mapeamentos.
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* Modal de Nova Lista */}
            {showNewListModal && (<ModalPortal>
              <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
                <div className="glass fade-in" style={{ width: "750px", maxWidth: "95vw", display: "flex", flexDirection: "column", borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
                  
                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 30px", borderBottom: "1px solid var(--border-color)", background: "rgba(0,0,0,0.1)" }}>
                    <h3 style={{ fontSize: "1.3rem", fontWeight: "700" }}>Criar Nova Lista de Contatos</h3>
                    <button type="button" onClick={() => { setNewListName(""); setNewListRawContacts(""); setManualContacts([{ name: "", phone: "", variablesStr: "" }]); setXlsxContacts([]); setImportMode("csv"); setShowNewListModal(false); }} style={{ background: "none", border: "none", color: "#fff", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
                  </div>

                  <form onSubmit={handleCreateContactList} style={{ padding: "24px 30px", display: "flex", flexDirection: "column", gap: "18px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>Nome da Lista</label>
                      <input
                        type="text"
                        placeholder="Ex: Clientes VIP - Ofertas de Junho"
                        value={newListName}
                        onChange={(e) => setNewListName(e.target.value)}
                        style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none" }}
                        required
                      />
                    </div>

                    {/* Seletor de Modo de Importação */}
                    <div style={{ display: "flex", gap: "10px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "12px" }}>
                      <button
                        type="button"
                        onClick={() => setImportMode("csv")}
                        className={`btn ${importMode === "csv" ? "btn-primary" : "btn-secondary"}`}
                        style={{ flex: 1, padding: "8px 12px", fontSize: "0.85rem", gap: "6px" }}
                      >
                        📄 Importar CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportMode("xlsx")}
                        className={`btn ${importMode === "xlsx" ? "btn-primary" : "btn-secondary"}`}
                        style={{ flex: 1, padding: "8px 12px", fontSize: "0.85rem", gap: "6px" }}
                      >
                        📊 Importar Excel (.xlsx)
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportMode("manual")}
                        className={`btn ${importMode === "manual" ? "btn-primary" : "btn-secondary"}`}
                        style={{ flex: 1, padding: "8px 12px", fontSize: "0.85rem", gap: "6px" }}
                      >
                        ✍️ Cadastro Manual
                      </button>
                    </div>

                    {importMode === "csv" && (
                      <>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>Importar de Planilha (.csv)</label>
                          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                            Selecione um arquivo de planilha exportado como CSV. Suporta separação por vírgula ou ponto-e-vírgula.
                          </div>
                          <input
                            type="file"
                            accept=".csv"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const text = event.target?.result as string;
                                setNewListRawContacts(text);
                                showAlert("Planilha CSV carregada com sucesso!");
                              };
                              reader.readAsText(file);
                            }}
                            style={{
                              padding: "10px",
                              borderRadius: "var(--radius-md)",
                              background: "rgba(255,255,255,0.02)",
                              border: "1px dashed var(--border-color)",
                              color: "var(--text-secondary)",
                              fontSize: "0.85rem",
                              cursor: "pointer"
                            }}
                          />
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>Contatos Carregados / Copiar & Colar</label>
                          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                            Edite abaixo ou cole novos contatos diretamente. Formatos aceitos:<br />
                            • Telefone simples: <code>5583986241167</code><br />
                            • Planilha CSV: <code>5583986241167, Pedro, VIP, 20%</code> (Telefone, Nome, Var 1, Var 2...)
                          </div>
                          <textarea
                            placeholder={`5583986241167, Pedro, VIP, Desconto de 20%\n5511999999999, João, Standard, Frete Grátis`}
                            value={newListRawContacts}
                            onChange={(e) => setNewListRawContacts(e.target.value)}
                            rows={6}
                            style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", resize: "none", fontFamily: "monospace", fontSize: "0.85rem", outline: "none" }}
                            required={importMode === "csv"}
                          />
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Limite máximo de 1.000 contatos por lote de importação. As linhas de cabeçalho da planilha serão ignoradas automaticamente.</span>
                        </div>
                      </>
                    )}

                    {importMode === "xlsx" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>Importar de Planilha (.xlsx)</label>
                          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                            Selecione um arquivo Excel (.xlsx). A primeira linha será interpretada como o cabeçalho.<br />
                            Procuramos colunas contendo <strong>telefone/celular</strong> para o número e <strong>nome/name</strong> para o nome.
                          </div>
                          <input
                            type="file"
                            accept=".xlsx"
                            onChange={handleXlsxUpload}
                            style={{
                              padding: "10px",
                              borderRadius: "var(--radius-md)",
                              background: "rgba(255,255,255,0.02)",
                              border: "1px dashed var(--border-color)",
                              color: "var(--text-secondary)",
                              fontSize: "0.85rem",
                              cursor: "pointer"
                            }}
                          />
                        </div>
                        {xlsxContacts.length > 0 && (
                          <div style={{ background: "rgba(0,194,107,0.05)", padding: "12px", borderRadius: "var(--radius-md)", border: "1px solid rgba(0,194,107,0.2)", fontSize: "0.85rem", color: "var(--primary)" }}>
                            ✅ <strong>{xlsxContacts.length} contatos lidos com sucesso!</strong> Clique em "Criar Lista" para salvar.
                          </div>
                        )}
                      </div>
                    )}

                    {importMode === "manual" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>Inserir Contatos Manuais</label>
                          <button
                            type="button"
                            onClick={() => setManualContacts([...manualContacts, { name: "", phone: "", variablesStr: "" }])}
                            className="btn btn-secondary"
                            style={{ padding: "6px 12px", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          >
                            ➕ Adicionar Contato
                          </button>
                        </div>
                        
                        <div style={{ maxHeight: "250px", overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: "10px", background: "rgba(0,0,0,0.15)" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                            <thead>
                              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", color: "var(--text-secondary)", textAlign: "left" }}>
                                <th style={{ padding: "8px 6px", fontWeight: "600" }}>Nome</th>
                                <th style={{ padding: "8px 6px", fontWeight: "600" }}>Telefone (com DDD)</th>
                                <th style={{ padding: "8px 6px", fontWeight: "600" }}>Variáveis (separadas por vírgula)</th>
                                <th style={{ padding: "8px 6px", width: "40px" }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {manualContacts.map((contact, idx) => (
                                <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                                  <td style={{ padding: "4px" }}>
                                    <input
                                      type="text"
                                      placeholder="Ex: Pedro"
                                      value={contact.name}
                                      onChange={(e) => {
                                        const updated = [...manualContacts];
                                        updated[idx].name = e.target.value;
                                        setManualContacts(updated);
                                      }}
                                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none" }}
                                    />
                                  </td>
                                  <td style={{ padding: "4px" }}>
                                    <input
                                      type="text"
                                      placeholder="Ex: 5583986241167"
                                      value={contact.phone}
                                      onChange={(e) => {
                                        const updated = [...manualContacts];
                                        updated[idx].phone = e.target.value;
                                        setManualContacts(updated);
                                      }}
                                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none" }}
                                      required={importMode === "manual"}
                                    />
                                  </td>
                                  <td style={{ padding: "4px" }}>
                                    <input
                                      type="text"
                                      placeholder="Ex: VIP, 20%"
                                      value={contact.variablesStr}
                                      onChange={(e) => {
                                        const updated = [...manualContacts];
                                        updated[idx].variablesStr = e.target.value;
                                        setManualContacts(updated);
                                      }}
                                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none" }}
                                    />
                                  </td>
                                  <td style={{ padding: "4px", textAlign: "center" }}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (manualContacts.length === 1) {
                                          setManualContacts([{ name: "", phone: "", variablesStr: "" }]);
                                        } else {
                                          setManualContacts(manualContacts.filter((_, i) => i !== idx));
                                        }
                                      }}
                                      style={{ background: "none", border: "none", color: "var(--error)", cursor: "pointer", fontSize: "1rem", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "4px" }}
                                      title="Excluir contato"
                                    >
                                      🗑️
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Todos os telefones devem conter o código do país (ex: 55 para o Brasil) e DDD.</span>
                      </div>
                    )}

                    {/* Footer Actions */}
                    <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", borderTop: "1px solid var(--border-color)", paddingTop: "15px", marginTop: "10px" }}>
                      <button type="button" onClick={() => { setNewListName(""); setNewListRawContacts(""); setManualContacts([{ name: "", phone: "", variablesStr: "" }]); setXlsxContacts([]); setImportMode("csv"); setShowNewListModal(false); }} className="btn btn-secondary">Cancelar</button>
                      <button type="submit" disabled={loading} className="btn btn-primary" style={{ minWidth: "150px" }}>
                        {loading ? "Criando..." : "Criar Lista"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </ModalPortal>)}

            {/* Modal de Editar Lista */}
            {showEditListModal !== null && (
              <ModalPortal>
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
                  <div className="glass fade-in" style={{ width: "750px", maxWidth: "95vw", display: "flex", flexDirection: "column", borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
                    
                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 30px", borderBottom: "1px solid var(--border-color)", background: "rgba(0,0,0,0.1)" }}>
                      <h3 style={{ fontSize: "1.3rem", fontWeight: "700" }}>Editar Lista de Contatos</h3>
                      <button type="button" onClick={() => { setShowEditListModal(null); setEditListName(""); setEditContacts([]); }} style={{ background: "none", border: "none", color: "#fff", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
                    </div>

                    <form onSubmit={handleEditContactList} style={{ padding: "24px 30px", display: "flex", flexDirection: "column", gap: "18px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>Nome da Lista</label>
                        <input
                          type="text"
                          value={editListName}
                          onChange={(e) => setEditListName(e.target.value)}
                          style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none" }}
                          required
                        />
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>Gerenciar Contatos</label>
                          <button
                            type="button"
                            onClick={() => setEditContacts([...editContacts, { name: "", phone: "", variablesStr: "" }])}
                            className="btn btn-secondary"
                            style={{ padding: "6px 12px", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          >
                            ➕ Adicionar Contato
                          </button>
                        </div>
                        
                        <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: "10px", background: "rgba(0,0,0,0.15)" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                            <thead>
                              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", color: "var(--text-secondary)", textAlign: "left" }}>
                                <th style={{ padding: "8px 6px", fontWeight: "600" }}>Nome</th>
                                <th style={{ padding: "8px 6px", fontWeight: "600" }}>Telefone (com DDD)</th>
                                <th style={{ padding: "8px 6px", fontWeight: "600" }}>Variáveis (separadas por vírgula)</th>
                                <th style={{ padding: "8px 6px", width: "40px" }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {editContacts.map((contact, idx) => (
                                <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                                  <td style={{ padding: "4px" }}>
                                    <input
                                      type="text"
                                      placeholder="Ex: Pedro"
                                      value={contact.name}
                                      onChange={(e) => {
                                        const updated = [...editContacts];
                                        updated[idx].name = e.target.value;
                                        setEditContacts(updated);
                                      }}
                                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none" }}
                                    />
                                  </td>
                                  <td style={{ padding: "4px" }}>
                                    <input
                                      type="text"
                                      placeholder="Ex: 5583986241167"
                                      value={contact.phone}
                                      onChange={(e) => {
                                        const updated = [...editContacts];
                                        updated[idx].phone = e.target.value;
                                        setEditContacts(updated);
                                      }}
                                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none" }}
                                      required
                                    />
                                  </td>
                                  <td style={{ padding: "4px" }}>
                                    <input
                                      type="text"
                                      placeholder="Ex: VIP, 20%"
                                      value={contact.variablesStr}
                                      onChange={(e) => {
                                        const updated = [...editContacts];
                                        updated[idx].variablesStr = e.target.value;
                                        setEditContacts(updated);
                                      }}
                                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none" }}
                                    />
                                  </td>
                                  <td style={{ padding: "4px", textAlign: "center" }}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (editContacts.length === 1) {
                                          setEditContacts([{ name: "", phone: "", variablesStr: "" }]);
                                        } else {
                                          setEditContacts(editContacts.filter((_, i) => i !== idx));
                                        }
                                      }}
                                      style={{ background: "none", border: "none", color: "var(--error)", cursor: "pointer", fontSize: "1rem", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "4px" }}
                                      title="Excluir contato"
                                    >
                                      🗑️
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Todos os telefones devem conter o código do país (ex: 55 para o Brasil) e DDD.</span>
                      </div>

                      {/* Footer Actions */}
                      <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", borderTop: "1px solid var(--border-color)", paddingTop: "15px", marginTop: "10px" }}>
                        <button type="button" onClick={() => { setShowEditListModal(null); setEditListName(""); setEditContacts([]); }} className="btn btn-secondary">Cancelar</button>
                        <button type="submit" disabled={loadingEdit} className="btn btn-primary" style={{ minWidth: "150px" }}>
                          {loadingEdit ? "Salvando..." : "Salvar Alterações"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </ModalPortal>
            )}

            {/* Modal de Seleção de Mídia */}
            {showMediaSelectModal && (<ModalPortal>
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
                        <button
                          key={f}
                          type="button"
                          className={`btn ${activeF === f ? "btn-primary" : "btn-secondary"}`}
                          style={{ padding: "5px 14px", fontSize: "0.8rem" }}
                          onClick={() => {
                            (window as any).__modalMediaFilter = f;
                            setLoadingMedia(() => { setTimeout(() => setLoadingMedia(false), 10); return true; });
                          }}
                        >
                          {labels[f]}
                        </button>
                      );
                    })}
                  </div>

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
                        <div style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                          Nenhum arquivo deste tipo disponível.
                        </div>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(145px, 1fr))", gap: "14px" }}>
                          {filteredModal.map((asset: any) => {
                            const isVideo = asset.mimeType?.startsWith("video/");
                            const isImage = asset.mimeType?.startsWith("image/");
                            const typeBg = isVideo ? "rgba(139,92,246,0.75)" : isImage ? "rgba(16,185,129,0.75)" : "rgba(245,158,11,0.75)";
                            const typeLabel = isVideo ? "🎬" : isImage ? "🖼️" : "📄";
                            return (
                              <div
                                key={asset.id}
                                onClick={() => {
                                  if (mediaSelectCallback) mediaSelectCallback(asset.url);
                                  setShowMediaSelectModal(false);
                                  setMediaSelectCallback(null);
                                }}
                                className="glass-interactive"
                                style={{
                                  borderRadius: "var(--radius-sm)",
                                  overflow: "hidden",
                                  display: "flex",
                                  flexDirection: "column",
                                  border: "1px solid var(--border-color)",
                                  cursor: "pointer",
                                  transition: "transform 0.15s ease, border-color 0.15s ease",
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--primary)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-color)"; (e.currentTarget as HTMLDivElement).style.transform = ""; }}
                              >
                                {/* Preview */}
                                <div style={{ height: "100px", background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
                                  {isImage ? (
                                    <img src={asset.url} alt={asset.filename} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  ) : isVideo ? (
                                    <>
                                      <video src={asset.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted preload="metadata" playsInline />
                                      {/* Play overlay */}
                                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.25)", pointerEvents: "none" }}>
                                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem" }}>▶</div>
                                      </div>
                                    </>
                                  ) : (
                                    <span style={{ fontSize: "2.5rem" }}>📄</span>
                                  )}
                                  {/* Type badge */}
                                  <div style={{ position: "absolute", top: "6px", left: "6px", background: typeBg, backdropFilter: "blur(4px)", padding: "2px 7px", borderRadius: "20px", fontSize: "0.65rem", fontWeight: "700", color: "#fff", pointerEvents: "none" }}>
                                    {typeLabel} {asset.mimeType?.split("/")[1]?.toUpperCase()}
                                  </div>
                                </div>
                                {/* Name */}
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

                  <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--border-color)", padding: "14px 28px", background: "rgba(0,0,0,0.05)" }}>
                    <button type="button" onClick={() => { setShowMediaSelectModal(false); setMediaSelectCallback(null); }} className="btn btn-secondary">Cancelar</button>
                  </div>

                </div>
              </div>
            </ModalPortal>)}

          </div>
        )}

        {/* Tab 4: MESSAGES (DISPAROS & HISTORICO) */}
        {activeTab === "messages" && (
          <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
            <div>
              <h1 style={{ fontSize: "2rem", fontWeight: "700", marginBottom: "8px" }}>Disparador & Logs</h1>
              <p style={{ color: "var(--text-secondary)" }}>Realize disparos de teste ou acompanhe a entrega das automações do n8n</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1.6fr", gap: "24px", alignItems: "start" }}>
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
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: "600" }}>Selecionar Lista</label>
                    <select
                      value={selectedListId}
                      onChange={(e) => setSelectedListId(e.target.value)}
                      style={{ padding: "10px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none", fontSize: "0.9rem" }}
                    >
                      <option value="">Selecione uma lista</option>
                      {contactLists.map((list) => (
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
                  const bodyComp = tmpl.components.find((c: any) => c.type === "BODY");
                  const headerComp = tmpl.components.find((c: any) => c.type === "HEADER");
                  const footerComp = tmpl.components.find((c: any) => c.type === "FOOTER");
                  const buttonsComp = tmpl.components.find((c: any) => c.type === "BUTTONS");

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
                          onChange={(e) => {
                            setMessagesSearch(e.target.value);
                          }}
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
                          onChange={(e) => {
                            setMessagesStatus(e.target.value);
                          }}
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
                          onChange={(e) => {
                            setMessagesTemplateFilter(e.target.value);
                          }}
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
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                            <thead>
                              <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}>
                                <th style={{ padding: "12px 8px" }}>Destinatário</th>
                                <th style={{ padding: "12px 8px" }}>Template</th>
                                <th style={{ padding: "12px 8px" }}>Data/Hora</th>
                                <th style={{ padding: "12px 8px" }}>Status</th>
                                <th style={{ padding: "12px 8px" }}>Detalhes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {messageLogs.map((log) => (
                                <tr key={log.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                  <td style={{ padding: "12px 8px", fontWeight: "500" }}>{log.to}</td>
                                  <td style={{ padding: "12px 8px" }}>{log.templateName}</td>
                                  <td style={{ padding: "12px 8px", color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                                    {new Date(log.createdAt).toLocaleString()}
                                  </td>
                                  <td style={{ padding: "12px 8px" }}>
                                    <span className={`badge badge-${log.status.toLowerCase()}`}>
                                      {log.status}
                                    </span>
                                  </td>
                                  <td style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: "0.8rem", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
                        {totalMessages > messagesLimit && (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "16px", marginTop: "10px" }}>
                            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                              Mostrando {((messagesPage - 1) * messagesLimit) + 1} - {Math.min(messagesPage * messagesLimit, totalMessages)} de {totalMessages} logs
                            </span>
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button
                                disabled={messagesPage === 1}
                                onClick={() => {
                                  const prev = messagesPage - 1;
                                  setMessagesPage(prev);
                                  if (selectedAccount) fetchMessages(selectedAccount.id, prev, messagesSearch, messagesStatus, messagesTemplateFilter);
                                }}
                                className="btn btn-secondary"
                                style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                              >
                                ◀ Anterior
                              </button>
                              <span style={{ display: "flex", alignItems: "center", padding: "0 10px", fontSize: "0.85rem", fontWeight: "600", color: "#fff" }}>
                                Página {messagesPage} de {Math.ceil(totalMessages / messagesLimit)}
                              </span>
                              <button
                                disabled={messagesPage >= Math.ceil(totalMessages / messagesLimit)}
                                onClick={() => {
                                  const next = messagesPage + 1;
                                  setMessagesPage(next);
                                  if (selectedAccount) fetchMessages(selectedAccount.id, next, messagesSearch, messagesStatus, messagesTemplateFilter);
                                }}
                                className="btn btn-secondary"
                                style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                              >
                                Próxima ▶
                              </button>
                            </div>
                          </div>
                        )}
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
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                          <thead>
                            <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}>
                              <th style={{ padding: "12px 8px" }}>Destinatário</th>
                              <th style={{ padding: "12px 8px" }}>Template</th>
                              <th style={{ padding: "12px 8px" }}>Data/Hora de Envio</th>
                              <th style={{ padding: "12px 8px" }}>Status</th>
                              <th style={{ padding: "12px 8px", textAlign: "right" }}>Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {scheduledMessages.map((msg) => (
                              <tr key={msg.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                <td style={{ padding: "12px 8px", fontWeight: "500" }}>{msg.to}</td>
                                <td style={{ padding: "12px 8px" }}>{msg.templateName}</td>
                                <td style={{ padding: "12px 8px", color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                                  {new Date(msg.scheduledAt).toLocaleString()}
                                </td>
                                <td style={{ padding: "12px 8px" }}>
                                  <span className="badge badge-pending">PENDING</span>
                                </td>
                                <td style={{ padding: "12px 8px", textAlign: "right" }}>
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

                      <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", borderTop: "1px solid var(--border-color)", paddingTop: "15px", marginTop: "10px" }}>
                        <button type="button" onClick={() => { setShowRescheduleModal(null); setRescheduleDate(""); }} className="btn btn-secondary">Cancelar</button>
                        <button type="submit" disabled={loadingScheduled} className="btn btn-primary" style={{ minWidth: "120px" }}>
                          {loadingScheduled ? "Salvando..." : "Confirmar"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </ModalPortal>
            )}
          </div>
        )}

        {/* Tab 5: MEDIA GALLERY */}
        {activeTab === "media" && (
          <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
            <div>
              <h1 style={{ fontSize: "2rem", fontWeight: "700", marginBottom: "8px" }}>Galeria de Mídias</h1>
              <p style={{ color: "var(--text-secondary)" }}>Faça upload e gerencie imagens, vídeos e documentos para usar nos seus disparos de templates.</p>
            </div>

            {!selectedAccount ? (
              <div className="glass" style={{ padding: "40px", borderRadius: "var(--radius-xl)", textAlign: "center", color: "var(--text-muted)" }}>
                <span style={{ fontSize: "3rem", marginBottom: "15px", display: "block" }}>⚠️</span>
                Selecione uma conta do WhatsApp comercial no menu superior para acessar a galeria de mídias.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>

                {/* Upload Zone */}
                <div
                  className="glass"
                  style={{
                    padding: "36px 30px",
                    borderRadius: "var(--radius-xl)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "16px",
                    border: "2px dashed var(--border-color)",
                    background: "rgba(255,255,255,0.01)",
                    transition: "border-color 0.2s",
                  }}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--primary)"; }}
                  onDragLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-color)"; }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = "var(--border-color)";
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleUploadMedia(file);
                  }}
                >
                  <div style={{ fontSize: "2.8rem" }}>📤</div>
                  <div style={{ textAlign: "center" }}>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "4px" }}>Fazer Upload de Arquivo</h3>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                      Arraste ou selecione · JPEG, PNG, WebP, <strong>MP4</strong>, 3GPP, PDF · Máx. <strong>50 MB</strong>
                    </p>
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/3gpp,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadMedia(file);
                      e.target.value = "";
                    }}
                    style={{ display: "none" }}
                    id="media-file-upload-input"
                  />
                  <label
                    htmlFor="media-file-upload-input"
                    className="btn btn-primary"
                    style={{ cursor: "pointer" }}
                  >
                    📂 Selecionar Arquivo
                  </label>
                </div>

                {/* Gallery Grid */}
                <div className="glass" style={{ padding: "30px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "20px" }}>
                  {/* Header with filter */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
                    <h3 style={{ fontSize: "1.2rem", fontWeight: "700" }}>
                      Arquivos Disponíveis ({mediaAssets.length})
                    </h3>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {(["all", "image", "video", "document"] as const).map((f) => {
                        const labels: Record<string, string> = { all: "Todos", image: "🖼️ Imagens", video: "🎬 Vídeos", document: "📄 Docs" };
                        const isActive = (window as any).__mediaFilter === f || (!((window as any).__mediaFilter) && f === "all");
                        return (
                          <button
                            key={f}
                            type="button"
                            className={`btn ${isActive ? "btn-primary" : "btn-secondary"}`}
                            style={{ padding: "6px 14px", fontSize: "0.8rem" }}
                            onClick={() => {
                              (window as any).__mediaFilter = f;
                              // force re-render via a dummy state toggle
                              setLoadingMedia(() => { setTimeout(() => setLoadingMedia(false), 10); return true; });
                            }}
                          >
                            {labels[f]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {loadingMedia ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "20px" }}>
                      {[1, 2, 3].map(i => (
                        <div key={i} className="skeleton" style={{ width: "100%", height: "230px", borderRadius: "var(--radius-md)" }} />
                      ))}
                    </div>
                  ) : mediaAssets.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "3rem" }}>🎞️</span>
                      <span>Nenhum arquivo enviado para este canal comercial ainda.</span>
                    </div>
                  ) : (() => {
                    const activeFilter = (window as any).__mediaFilter || "all";
                    const filtered = mediaAssets.filter((a: any) =>
                      activeFilter === "all" ? true :
                      activeFilter === "image" ? a.mimeType?.startsWith("image/") :
                      activeFilter === "video" ? a.mimeType?.startsWith("video/") :
                      a.mimeType === "application/pdf"
                    );
                    return filtered.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                        Nenhum arquivo deste tipo encontrado.
                      </div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "20px" }}>
                        {filtered.map((asset: any) => {
                          const isVideo = asset.mimeType?.startsWith("video/");
                          const isImage = asset.mimeType?.startsWith("image/");
                          const typeLabel = isVideo ? "🎬 Vídeo" : isImage ? "🖼️ Imagem" : "📄 Doc";
                          const typeBg = isVideo ? "rgba(139,92,246,0.7)" : isImage ? "rgba(16,185,129,0.7)" : "rgba(245,158,11,0.7)";
                          return (
                            <div
                              key={asset.id}
                              className="glass glass-interactive"
                              style={{
                                borderRadius: "var(--radius-md)",
                                overflow: "hidden",
                                display: "flex",
                                flexDirection: "column",
                                border: "1px solid var(--border-color)",
                              }}
                            >
                              {/* Preview Area */}
                              <div style={{ height: "150px", background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative", borderBottom: "1px solid var(--border-color)" }}>
                                {isImage ? (
                                  <img src={asset.url} alt={asset.filename} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : isVideo ? (
                                  <video
                                    src={asset.url}
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                    controls
                                    muted
                                    preload="metadata"
                                    playsInline
                                  />
                                ) : (
                                  <span style={{ fontSize: "3.5rem" }}>📄</span>
                                )}
                                {/* Type badge */}
                                <div style={{
                                  position: "absolute", top: "8px", left: "8px",
                                  background: typeBg,
                                  backdropFilter: "blur(4px)",
                                  padding: "3px 8px", borderRadius: "20px",
                                  fontSize: "0.7rem", fontWeight: "600", color: "#fff",
                                  pointerEvents: "none",
                                }}>
                                  {typeLabel}
                                </div>
                              </div>

                              {/* Info Area */}
                              <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
                                <div style={{ fontWeight: "600", fontSize: "0.82rem", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }} title={asset.filename}>
                                  {asset.filename.replace(/^\d+-/, "")}
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                  {(asset.size / 1024 / 1024).toFixed(2)} MB · {asset.mimeType?.split("/")[1]?.toUpperCase()}
                                </div>

                                {/* Actions */}
                                <div style={{ display: "flex", gap: "6px", marginTop: "auto", paddingTop: "6px" }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(asset.url);
                                      showAlert("Link copiado! 🔗");
                                    }}
                                    className="btn btn-secondary"
                                    style={{ flex: 1, padding: "6px 8px", fontSize: "0.75rem" }}
                                    title="Copiar URL"
                                  >
                                    🔗 Copiar URL
                                  </button>
                                  <a
                                    href={asset.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn btn-secondary"
                                    style={{ padding: "6px 10px", fontSize: "0.75rem", textDecoration: "none" }}
                                    title="Abrir em nova aba"
                                  >
                                    ↗
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMedia(asset.id)}
                                    className="btn btn-secondary"
                                    style={{ padding: "6px 10px", fontSize: "0.75rem", color: "var(--error)" }}
                                    title="Excluir"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

              </div>
            )}
          </div>
        )}


        {/* Tab 6: ADMIN (ADMINISTRAÇÃO DE USUÁRIOS) */}
        {activeTab === "admin" && (
          <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
            <div>
              <h1 style={{ fontSize: "2rem", fontWeight: "700", marginBottom: "8px" }}>Painel Administrativo</h1>
              <p style={{ color: "var(--text-secondary)" }}>Gerencie todos os clientes cadastrados e acesse suas contas via suporte técnico</p>
            </div>

            <div className="glass" style={{ padding: "30px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: "600" }}>Clientes Cadastrados ({adminUsers.length})</h3>
                <button type="button" onClick={fetchAdminUsers} className="btn btn-secondary" style={{ padding: "8px 14px", fontSize: "0.85rem" }}>
                  🔄 Atualizar Lista
                </button>
              </div>

              {loadingAdminUsers ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div className="skeleton" style={{ width: "100%", height: "40px", borderRadius: "8px" }}></div>
                  <div className="skeleton" style={{ width: "100%", height: "40px", borderRadius: "8px" }}></div>
                  <div className="skeleton" style={{ width: "100%", height: "40px", borderRadius: "8px" }}></div>
                </div>
              ) : adminUsers.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>Nenhum usuário cadastrado no sistema.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95rem" }}>
                    <thead>
                      <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}>
                        <th style={{ padding: "12px 8px" }}>Nome</th>
                        <th style={{ padding: "12px 8px" }}>E-mail</th>
                        <th style={{ padding: "12px 8px" }}>Perfil</th>
                        <th style={{ padding: "12px 8px" }}>Linhas Meta</th>
                        <th style={{ padding: "12px 8px" }}>Cadastro</th>
                        <th style={{ padding: "12px 8px" }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminUsers.map((u) => (
                        <tr key={u.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "12px 8px", fontWeight: "600" }}>{u.name || "-"}</td>
                          <td style={{ padding: "12px 8px" }}>{u.email}</td>
                          <td style={{ padding: "12px 8px" }}>
                            <span style={{
                              background: u.role === "SUPERUSER" ? "rgba(0, 194, 107, 0.15)" : "rgba(255, 255, 255, 0.05)",
                              color: u.role === "SUPERUSER" ? "var(--primary)" : "var(--text-secondary)",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              fontWeight: "600"
                            }}>
                              {u.role}
                            </span>
                          </td>
                          <td style={{ padding: "12px 8px" }}>📱 {u._count?.accounts || 0}</td>
                          <td style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                          <td style={{ padding: "12px 8px" }}>
                            {u.id !== user?.id ? (
                              <button
                                type="button"
                                onClick={() => handleImpersonate(u.id)}
                                className="btn btn-primary"
                                style={{ padding: "6px 12px", fontSize: "0.8rem", background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", boxShadow: "0 4px 14px 0 rgba(245, 158, 11, 0.2)" }}
                              >
                                🚪 Entrar como Suporte
                              </button>
                            ) : (
                              <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Sua Conta</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
