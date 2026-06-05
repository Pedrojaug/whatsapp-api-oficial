import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

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

export default function App() {
  const [activeTab, setActiveTab] = useState<"metrics" | "accounts" | "templates" | "messages">("metrics");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  // Form states
  const [accountForm, setAccountForm] = useState({ name: "", wabaId: "", phoneNumberId: "", accessToken: "" });
  const [templates, setTemplates] = useState<Template[]>([]);
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncingTemplates, setSyncingTemplates] = useState(false);

  // New Template Form States
  const [showNewTemplateModal, setShowNewTemplateModal] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    category: "MARKETING",
    language: "pt_BR",
    bodyText: "",
    headerText: "",
    footerText: "",
  });

  // Manual Send Message States
  const [selectedTemplateName, setSelectedTemplateName] = useState("");
  const [recipientNumber, setRecipientNumber] = useState("");
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);

  // Messages / Alerts
  const [alert, setAlert] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      fetchTemplates(selectedAccount.id);
      fetchMessages(selectedAccount.id);
    } else {
      setTemplates([]);
      setMessageLogs([]);
    }
  }, [selectedAccount]);

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

  const fetchTemplates = async (accountId: string) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/accounts/${accountId}/templates`);
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
      await fetchTemplates(selectedAccount.id);
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

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountForm.name || !accountForm.wabaId || !accountForm.phoneNumberId || !accountForm.accessToken) {
      showAlert("Preencha todos os campos do formulário.", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/accounts`, accountForm);
      showAlert("Conta configurada com sucesso!");
      setAccountForm({ name: "", wabaId: "", phoneNumberId: "", accessToken: "" });
      fetchAccounts();
      setSelectedAccount(res.data);
    } catch (err: any) {
      showAlert("Erro ao salvar conta Meta.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover esta conta e todo o histórico associado?")) return;
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

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    if (!newTemplate.name || !newTemplate.bodyText) {
      showAlert("Nome e corpo do template são obrigatórios.", "error");
      return;
    }

    setLoading(true);
    try {
      // Montar os componentes conforme o formato exigido pela Meta Cloud API
      const components: any[] = [];

      if (newTemplate.headerText) {
        components.push({
          type: "HEADER",
          format: "TEXT",
          text: newTemplate.headerText,
        });
      }

      components.push({
        type: "BODY",
        text: newTemplate.bodyText,
      });

      if (newTemplate.footerText) {
        components.push({
          type: "FOOTER",
          text: newTemplate.footerText,
        });
      }

      await axios.post(`${API_BASE_URL}/accounts/${selectedAccount.id}/templates`, {
        name: newTemplate.name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
        category: newTemplate.category,
        language: newTemplate.language,
        components,
      });

      showAlert("Template criado e enviado para aprovação da Meta!");
      setShowNewTemplateModal(false);
      setNewTemplate({ name: "", category: "MARKETING", language: "pt_BR", bodyText: "", headerText: "", footerText: "" });
      fetchTemplates(selectedAccount.id);
    } catch (err: any) {
      const details = err.response?.data?.details?.error?.message || err.response?.data?.error || "Erro desconhecido";
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
    const tmpl = templates.find((t) => t.name === name);
    if (tmpl) {
      const bodyComp = tmpl.components.find((c: any) => c.type === "BODY");
      const varCount = bodyComp ? getVariablesCount(bodyComp.text) : 0;
      setTemplateVariables(Array(varCount).fill(""));
    } else {
      setTemplateVariables([]);
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
    if (!recipientNumber || !selectedTemplateName) {
      showAlert("Selecione o template e insira o telefone destinatário.", "error");
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/accounts/${selectedAccount.id}/messages/send`, {
        to: recipientNumber.replace(/\D/g, ""), // Limpar caracteres não-numéricos
        templateName: selectedTemplateName,
        variables: templateVariables,
      });

      showAlert("Mensagem enviada com sucesso!");
      setRecipientNumber("");
      setSelectedTemplateName("");
      setTemplateVariables([]);
      fetchMessages(selectedAccount.id);
    } catch (err: any) {
      const details = err.response?.data?.details?.error?.message || err.response?.data?.error || "Erro desconhecido";
      showAlert(`Falha no envio: ${details}`, "error");
      fetchMessages(selectedAccount.id); // Refresh logs to see the FAILED log
    } finally {
      setLoading(false);
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "30px", alignItems: "start" }}>
              {/* Form de Cadastro */}
              <form onSubmit={handleAccountSubmit} className="glass" style={{ padding: "30px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "20px" }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: "600" }}>Adicionar Nova Conta</h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Nome Identificador</label>
                  <input
                    type="text"
                    placeholder="Ex: Capitania do Cheiro"
                    value={accountForm.name}
                    onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                    style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none" }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>WhatsApp Business Account ID (WABA ID)</label>
                  <input
                    type="text"
                    placeholder="Obtido no painel da Meta"
                    value={accountForm.wabaId}
                    onChange={(e) => setAccountForm({ ...accountForm, wabaId: e.target.value })}
                    style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none" }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>ID do Número de Telefone (Phone Number ID)</label>
                  <input
                    type="text"
                    placeholder="Obtido na aba de WhatsApp do app da Meta"
                    value={accountForm.phoneNumberId}
                    onChange={(e) => setAccountForm({ ...accountForm, phoneNumberId: e.target.value })}
                    style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none" }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Token de Acesso Permanente</label>
                  <input
                    type="password"
                    placeholder="Token do System User"
                    value={accountForm.accessToken}
                    onChange={(e) => setAccountForm({ ...accountForm, accessToken: e.target.value })}
                    style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none" }}
                  />
                </div>

                <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: "100%", marginTop: "10px" }}>
                  {loading ? "Salvando..." : "Salvar Configurações"}
                </button>
              </form>

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
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <h4 style={{ fontSize: "1.1rem", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis" }}>{tmpl.name}</h4>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>{tmpl.category} • {tmpl.language}</span>
                        </div>
                        <span className={`badge badge-${tmpl.status.toLowerCase()}`}>
                          {tmpl.status}
                        </span>
                      </div>

                      {/* Preview Box */}
                      <div style={{ padding: "16px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", fontSize: "0.9rem", flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                        {headerComp && <div style={{ fontWeight: "700", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "4px" }}>{headerComp.text}</div>}
                        <div style={{ whiteSpace: "pre-wrap", color: "#e5e7eb" }}>{bodyComp?.text}</div>
                        {footerComp && <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "4px" }}>{footerComp.text}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Modal de Criação de Template */}
            {showNewTemplateModal && (
              <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
                <form onSubmit={handleCreateTemplate} className="glass fade-in" style={{ width: "500px", padding: "30px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ fontSize: "1.3rem", fontWeight: "700" }}>Criar Novo Template</h3>
                    <button type="button" onClick={() => setShowNewTemplateModal(false)} style={{ background: "none", border: "none", color: "#fff", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Nome do Template</label>
                    <input
                      type="text"
                      placeholder="Somente letras minúsculas e _ (ex: confirmacao_compra)"
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                      style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff" }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Categoria</label>
                      <select
                        value={newTemplate.category}
                        onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                        style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff" }}
                      >
                        <option value="MARKETING">Marketing</option>
                        <option value="UTILITY">Utilidade</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Idioma</label>
                      <input
                        type="text"
                        placeholder="pt_BR"
                        value={newTemplate.language}
                        onChange={(e) => setNewTemplate({ ...newTemplate, language: e.target.value })}
                        style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Texto de Cabeçalho (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Texto do cabeçalho"
                      value={newTemplate.headerText}
                      onChange={(e) => setNewTemplate({ ...newTemplate, headerText: e.target.value })}
                      style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff" }}
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Corpo da Mensagem (Obrigatório)</label>
                    <textarea
                      placeholder="Olá {{1}}, seu pedido {{2}} foi recebido!"
                      value={newTemplate.bodyText}
                      onChange={(e) => setNewTemplate({ ...newTemplate, bodyText: e.target.value })}
                      rows={4}
                      style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", resize: "none", fontFamily: "inherit" }}
                    />
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Use {"{{1}}"}, {"{{2}}"} para indicar variáveis dinâmicas.</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Rodapé (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Texto pequeno no rodapé"
                      value={newTemplate.footerText}
                      onChange={(e) => setNewTemplate({ ...newTemplate, footerText: e.target.value })}
                      style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff" }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                    <button type="button" onClick={() => setShowNewTemplateModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                    <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 1 }}>
                      {loading ? "Criando..." : "Enviar para Meta"}
                    </button>
                  </div>
                </form>
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "30px", alignItems: "start" }}>
              {/* Testador Manual de Disparo */}
              <form onSubmit={handleSendMessage} className="glass" style={{ padding: "30px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "20px" }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: "600" }}>Disparo de Teste</h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Template</label>
                  <select
                    value={selectedTemplateName}
                    onChange={(e) => handleTemplateSelectionChange(e.target.value)}
                    style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none" }}
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
                  <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Celular Destinatário</label>
                  <input
                    type="text"
                    placeholder="DDI + DDD + Número (ex: 5511999999999)"
                    value={recipientNumber}
                    onChange={(e) => setRecipientNumber(e.target.value)}
                    style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none" }}
                  />
                </div>

                {/* Dynamic Variables Inputs */}
                {templateVariables.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "15px" }}>
                    <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-secondary)", textTransform: "uppercase" }}>Variáveis do Template</label>
                    {templateVariables.map((variable, idx) => (
                      <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <label style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Variável {"{{" + (idx + 1) + "}}"}</label>
                        <input
                          type="text"
                          placeholder={`Valor para {{${idx + 1}}}`}
                          value={variable}
                          onChange={(e) => handleVariableChange(idx, e.target.value)}
                          style={{ padding: "10px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff" }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <button type="submit" disabled={loading || !selectedAccount} className="btn btn-primary" style={{ width: "100%", marginTop: "10px" }}>
                  {loading ? "Enviando..." : "Disparar WhatsApp"}
                </button>
              </form>

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
