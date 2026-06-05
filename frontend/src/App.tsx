import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";
import SetupWizard from "./components/SetupWizard";
import PhoneSimulator from "./components/PhoneSimulator";

const API_BASE_URL = "http://localhost:3001/api";

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
  const [activeTab, setActiveTab] = useState<"metrics" | "accounts" | "templates" | "messages" | "lists">("metrics");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  // Form states
  const [templates, setTemplates] = useState<Template[]>([]);
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncingTemplates, setSyncingTemplates] = useState(false);

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

  // Manual Send Message States
  const [selectedTemplateName, setSelectedTemplateName] = useState("");
  const [recipientNumber, setRecipientNumber] = useState("");
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);
  const [messageMediaUrl, setMessageMediaUrl] = useState("");

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
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      fetchTemplates(selectedAccount.id);
      fetchMessages(selectedAccount.id);
      fetchContactLists(selectedAccount.id);
    } else {
      setTemplates([]);
      setMessageLogs([]);
      setContactLists([]);
      setSelectedList(null);
    }
  }, [selectedAccount]);

  useEffect(() => {
    if (selectedAccount && activeTab === "lists") {
      fetchContactLists(selectedAccount.id);
    }
  }, [activeTab]);

  const showAlert = (text: string, type: "success" | "error" = "success") => {
    setAlert({ text, type });
    setTimeout(() => setAlert(null), 5000);
  };

  const fetchAccounts = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/accounts`);
      setAccounts(res.data);
      if (res.data.length > 0 && !selectedAccount) {
        setSelectedAccount(res.data[0]);
      }
    } catch (err: any) {
      showAlert("Erro ao buscar contas Meta.", "error");
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

  const fetchMessages = async (accountId: string) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/accounts/${accountId}/messages`);
      setMessageLogs(res.data);
    } catch (err: any) {
      console.error(err);
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
    if (!newListRawContacts.trim()) {
      showAlert("Insira ao menos um contato.", "error");
      return;
    }

    const parsedContacts = parseRawContacts(newListRawContacts);
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
      showAlert("Importando contatos e criando lista...");
      await axios.post(`${API_BASE_URL}/accounts/${selectedAccount.id}/lists`, {
        name: newListName,
        contacts: parsedContacts
      });
      showAlert("Lista de contatos criada com sucesso!");
      setNewListName("");
      setNewListRawContacts("");
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
        });

        showAlert("Mensagem enviada com sucesso!");
        setRecipientNumber("");
        setSelectedTemplateName("");
        setTemplateVariables([]);
        setMessageMediaUrl("");
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
        });

        showAlert("Disparo em lote iniciado com sucesso!");
        setSelectedTemplateName("");
        setTemplateVariables([]);
        setVariableMappings([]);
        setMessageMediaUrl("");
        setSelectedListId("");
        
        setTimeout(() => fetchMessages(selectedAccount.id), 1000);
      } catch (err: any) {
        const details = err.response?.data?.error || "Erro desconhecido";
        showAlert(`Falha ao iniciar disparo em lote: ${details}`, "error");
      } finally {
        setLoading(false);
      }
    }
  };

  // Metrics processing
  const totalSent = messageLogs.filter((m) => m.status === "SENT").length;
  const totalDelivered = messageLogs.filter((m) => m.status === "DELIVERED").length;
  const totalRead = messageLogs.filter((m) => m.status === "READ").length;
  const totalFailed = messageLogs.filter((m) => m.status === "FAILED").length;
  const totalAll = messageLogs.length;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <aside className="glass" style={{ width: "280px", padding: "30px 20px", display: "flex", flexDirection: "column", gap: "30px", borderRight: "1px solid var(--border-color)" }}>
        <div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "700", background: "linear-gradient(135deg, #a5b4fc 0%, #6366f1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            Meta WABA Hub
          </h2>
          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Seu portal oficial de WhatsApp</p>
        </div>

        {/* Account Switcher */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--text-secondary)", textTransform: "uppercase" }}>Conta Ativa</label>
          <select
            value={selectedAccount?.id || ""}
            onChange={(e) => {
              const acc = accounts.find((a) => a.id === e.target.value);
              if (acc) setSelectedAccount(acc);
            }}
            className="glass"
            style={{ width: "100%", padding: "12px", borderRadius: "var(--radius-md)", color: "var(--text-primary)", outline: "none", cursor: "pointer", border: "1px solid var(--border-color)" }}
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
        <nav style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
          <button
            onClick={() => setActiveTab("metrics")}
            className={`btn ${activeTab === "metrics" ? "btn-primary" : "btn-secondary"}`}
            style={{ justifyContent: "flex-start", width: "100%" }}
          >
            📊 Métricas
          </button>
          <button
            onClick={() => setActiveTab("templates")}
            className={`btn ${activeTab === "templates" ? "btn-primary" : "btn-secondary"}`}
            style={{ justifyContent: "flex-start", width: "100%" }}
          >
            📝 Templates Meta
          </button>
          <button
            onClick={() => setActiveTab("lists")}
            className={`btn ${activeTab === "lists" ? "btn-primary" : "btn-secondary"}`}
            style={{ justifyContent: "flex-start", width: "100%" }}
          >
            👥 Listas de Contatos
          </button>
          <button
            onClick={() => setActiveTab("messages")}
            className={`btn ${activeTab === "messages" ? "btn-primary" : "btn-secondary"}`}
            style={{ justifyContent: "flex-start", width: "100%" }}
          >
            🚀 Envio & Histórico
          </button>
          <button
            onClick={() => setActiveTab("accounts")}
            className={`btn ${activeTab === "accounts" ? "btn-primary" : "btn-secondary"}`}
            style={{ justifyContent: "flex-start", width: "100%" }}
          >
            ⚙️ Contas Meta API
          </button>
        </nav>

        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center" }}>
          Desenvolvido com ❤️ | v1.0.0
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: "40px", overflowY: "auto", position: "relative" }}>
        
        {/* Alert Notifications */}
        {alert && (
          <div className="fade-in" style={{
            position: "absolute", top: "20px", right: "40px", zIndex: 100,
            padding: "16px 24px", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", gap: "10px",
            background: alert.type === "success" ? "rgba(16, 185, 129, 0.9)" : "rgba(239, 68, 68, 0.9)",
            color: "#fff", backdropFilter: "blur(8px)", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)"
          }}>
            {alert.type === "success" ? "✅" : "⚠️"} {alert.text}
          </div>
        )}

        {/* Tab 1: METRICS */}
        {activeTab === "metrics" && (
          <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
            <div>
              <h1 style={{ fontSize: "2rem", fontWeight: "700", marginBottom: "8px" }}>Painel de Métricas</h1>
              <p style={{ color: "var(--text-secondary)" }}>Visão geral dos disparos efetuados pela conta <strong>{selectedAccount?.name || "Nenhuma conta selecionada"}</strong></p>
            </div>

            {/* Metrics cards grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
              <div className="glass glass-interactive" style={{ padding: "24px", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: "600", textTransform: "uppercase" }}>Total Disparado</span>
                <span style={{ fontSize: "2.5rem", fontWeight: "700" }}>{totalAll}</span>
              </div>
              <div className="glass glass-interactive" style={{ padding: "24px", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ color: "#818cf8", fontSize: "0.85rem", fontWeight: "600", textTransform: "uppercase" }}>Enviado</span>
                <span style={{ fontSize: "2.5rem", fontWeight: "700", color: "#818cf8" }}>{totalSent}</span>
              </div>
              <div className="glass glass-interactive" style={{ padding: "24px", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ color: "#22d3ee", fontSize: "0.85rem", fontWeight: "600", textTransform: "uppercase" }}>Entregue</span>
                <span style={{ fontSize: "2.5rem", fontWeight: "700", color: "#22d3ee" }}>{totalDelivered}</span>
              </div>
              <div className="glass glass-interactive" style={{ padding: "24px", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ color: "var(--success)", fontSize: "0.85rem", fontWeight: "600", textTransform: "uppercase" }}>Lido</span>
                <span style={{ fontSize: "2.5rem", fontWeight: "700", color: "var(--success)" }}>{totalRead}</span>
              </div>
              <div className="glass glass-interactive" style={{ padding: "24px", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ color: "var(--error)", fontSize: "0.85rem", fontWeight: "600", textTransform: "uppercase" }}>Falhas</span>
                <span style={{ fontSize: "2.5rem", fontWeight: "700", color: "var(--error)" }}>{totalFailed}</span>
              </div>
            </div>

            {/* Quick Chart Simulation / Info */}
            <div className="glass" style={{ padding: "30px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "20px" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: "600" }}>Funil de Entrega</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "between", marginBottom: "6px", fontSize: "0.9rem" }}>
                    <span>Taxa de Leitura</span>
                    <span style={{ marginLeft: "auto", fontWeight: "600" }}>{totalAll > 0 ? Math.round((totalRead / totalAll) * 100) : 0}%</span>
                  </div>
                  <div style={{ height: "8px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${totalAll > 0 ? (totalRead / totalAll) * 100 : 0}%`, background: "var(--success)", borderRadius: "4px" }}></div>
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "between", marginBottom: "6px", fontSize: "0.9rem" }}>
                    <span>Taxa de Entrega</span>
                    <span style={{ marginLeft: "auto", fontWeight: "600" }}>{totalAll > 0 ? Math.round(((totalDelivered + totalRead) / totalAll) * 100) : 0}%</span>
                  </div>
                  <div style={{ height: "8px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${totalAll > 0 ? ((totalDelivered + totalRead) / totalAll) * 100 : 0}%`, background: "#06b6d4", borderRadius: "4px" }}></div>
                  </div>
                </div>
              </div>
            </div>
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

            {deleteConfirmTemplate && (
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
            )}

            {/* Modal de Criação de Template (Template Builder Premium) */}
            {showNewTemplateModal && (
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
            )}
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
                    <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>Carregando listas...</p>
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
                            background: selectedList?.id === list.id ? "rgba(99, 102, 241, 0.05)" : undefined,
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
                        <span style={{ background: "var(--primary)", color: "#fff", padding: "6px 14px", borderRadius: "20px", fontSize: "0.8rem", fontWeight: "600" }}>
                          {selectedList.contacts?.length || 0} contatos
                        </span>
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
            {showNewListModal && (
              <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
                <div className="glass fade-in" style={{ width: "600px", maxWidth: "95vw", display: "flex", flexDirection: "column", borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
                  
                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 30px", borderBottom: "1px solid var(--border-color)", background: "rgba(0,0,0,0.1)" }}>
                    <h3 style={{ fontSize: "1.3rem", fontWeight: "700" }}>Importar Nova Lista de Contatos</h3>
                    <button type="button" onClick={() => { setNewListName(""); setNewListRawContacts(""); setShowNewListModal(false); }} style={{ background: "none", border: "none", color: "#fff", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
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

                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "15px" }}>
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
                        rows={8}
                        style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", resize: "none", fontFamily: "monospace", fontSize: "0.85rem", outline: "none" }}
                        required
                      />
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Limite máximo de 1.000 contatos por lote de importação. As linhas de cabeçalho da planilha serão ignoradas automaticamente.</span>
                    </div>

                    {/* Footer Actions */}
                    <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", borderTop: "1px solid var(--border-color)", paddingTop: "15px", marginTop: "10px" }}>
                      <button type="button" onClick={() => { setNewListName(""); setNewListRawContacts(""); setShowNewListModal(false); }} className="btn btn-secondary">Cancelar</button>
                      <button type="submit" disabled={loading} className="btn btn-primary" style={{ minWidth: "150px" }}>
                        {loading ? "Importando..." : "Criar Lista & Importar"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
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
                      <input
                        type="text"
                        placeholder={`https://site.com/media.${headerComp.format === "IMAGE" ? "jpg" : headerComp.format === "VIDEO" ? "mp4" : "pdf"}`}
                        value={messageMediaUrl}
                        onChange={(e) => setMessageMediaUrl(e.target.value)}
                        style={{ padding: "10px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none", fontSize: "0.9rem" }}
                      />
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

                <button type="submit" disabled={loading || !selectedAccount} className="btn btn-primary" style={{ width: "100%", marginTop: "10px" }}>
                  {loading ? "Enviando..." : recipientType === "single" ? "Disparar WhatsApp" : "Iniciar Disparo em Lote"}
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

                  return (
                    <PhoneSimulator
                      headerFormat={headerComp ? headerComp.format : "NONE"}
                      headerText={headerComp ? headerComp.text : ""}
                      mediaUrl={messageMediaUrl}
                      bodyText={bodyComp ? bodyComp.text : ""}
                      variables={templateVariables}
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: "600" }}>Histórico Recente</h3>
                  <button onClick={() => selectedAccount && fetchMessages(selectedAccount.id)} className="btn btn-secondary" style={{ padding: "8px 14px", fontSize: "0.8rem" }}>
                    🔄 Atualizar Logs
                  </button>
                </div>

                {messageLogs.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>Nenhuma mensagem enviada por esta conta.</p>
                ) : (
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
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
