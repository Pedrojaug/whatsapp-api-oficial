import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAccount } from "../contexts/AccountContext";
import { useAlert } from "../contexts/AlertContext";
import { useSSE } from "../hooks/useSSE";
import { API_BASE_URL } from "../contexts/AuthContext";

function normalizePhone(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length === 12) {
    return digits.slice(0, 4) + "9" + digits.slice(4);
  }
  return digits;
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

export default function ChatPage() {
  const { selectedAccount } = useAccount();
  const { showAlert } = useAlert();

  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string>("");
  const selectedPhoneRef = useRef(selectedPhone);

  useEffect(() => {
    selectedPhoneRef.current = selectedPhone;
  }, [selectedPhone]);

  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [replyBody, setReplyBody] = useState("");
  const [isConversationsLoading, setIsConversationsLoading] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [showChatTemplateModal, setShowChatTemplateModal] = useState(false);

  // Template states for quick sending
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateName, setSelectedTemplateName] = useState("");
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);

  const detectBodyVariables = (text: string) => {
    const matches = text.match(/\{\{(\d+)\}\}/g);
    if (!matches) return [];
    const uniqueIds = Array.from(new Set(matches.map(m => {
      const numMatch = m.match(/\d+/);
      return numMatch ? parseInt(numMatch[0]) : 1;
    }))).sort((a, b) => a - b);
    return uniqueIds;
  };

  const fetchTemplates = async (accountId: string) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/accounts/${accountId}/templates`);
      setTemplates(res.data);
    } catch (err) {
      console.error("Erro ao buscar templates:", err);
    }
  };

  const fetchConversations = async (accountId: string, silent = false) => {
    if (!silent) setIsConversationsLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/accounts/${accountId}/conversations`);
      setConversations(res.data);
    } catch (err) {
      console.error("Erro ao buscar conversas:", err);
    } finally {
      if (!silent) setIsConversationsLoading(false);
    }
  };

  const fetchChatMessages = async (accountId: string, phone: string, silent = false) => {
    if (!silent) setIsChatLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/accounts/${accountId}/conversations/${phone}/messages`);
      setChatMessages(res.data);
    } catch (err) {
      console.error("Erro ao buscar mensagens do chat:", err);
    } finally {
      if (!silent) setIsChatLoading(false);
    }
  };

  const sendReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedAccount || !selectedPhone || !replyBody.trim()) return;

    setIsSendingReply(true);
    const bodyText = replyBody.trim();
    try {
      const res = await axios.post(`${API_BASE_URL}/accounts/${selectedAccount.id}/messages/reply`, {
        to: selectedPhone,
        body: bodyText,
      });

      setChatMessages((prev) => [...prev, res.data]);
      setReplyBody("");
      
      setConversations((prevConv) => {
        const index = prevConv.findIndex((c) => c.phone === selectedPhone);
        if (index !== -1) {
          const updated = [...prevConv];
          updated[index] = {
            ...updated[index],
            lastMessage: bodyText,
            updatedAt: new Date().toISOString(),
            status: "SENT",
            direction: "OUTGOING",
          };
          return updated;
        }
        return prevConv;
      });
    } catch (err: any) {
      const details = err.response?.data?.error || "Erro desconhecido";
      showAlert(`Falha ao enviar resposta: ${details}`, "error");
    } finally {
      setIsSendingReply(false);
    }
  };

  useEffect(() => {
    if (selectedAccount) {
      fetchTemplates(selectedAccount.id);
      fetchConversations(selectedAccount.id);
      setSelectedPhone("");
      setChatMessages([]);
    } else {
      setTemplates([]);
      setConversations([]);
      setSelectedPhone("");
      setChatMessages([]);
    }
  }, [selectedAccount]);

  // Se inscreve no SSE de eventos para atualizar conversas e chat em tempo real
  useSSE((data: any) => {
    if (!selectedAccount) return;

    if (data.type === "messageUpdated") {
      const activePhone = selectedPhoneRef.current;
      const incomingPhone = normalizePhone(data.to);

      // 1. Atualizar histórico se o chat com esse telefone estiver ativo
      if (activePhone && normalizePhone(activePhone) === incomingPhone) {
        setChatMessages((prevMsgs) => {
          const idx = prevMsgs.findIndex((m) =>
            (data.wamid && m.wamid === data.wamid) || m.id === data.messageId
          );
          if (idx !== -1) {
            const updated = [...prevMsgs];
            updated[idx] = {
              ...updated[idx],
              status: data.status,
              wamid: data.wamid || updated[idx].wamid,
              errorMessage: data.errorMessage !== undefined ? data.errorMessage : updated[idx].errorMessage,
            };
            return updated;
          }

          const isAgentMsg = data.direction === "OUTGOING" && (data.variables as any)?.sentBy === "SDR";
          if (data.direction !== "INCOMING" && !isAgentMsg) return prevMsgs;

          return [...prevMsgs, {
            id: data.messageId,
            wamid: data.wamid,
            to: data.to,
            status: data.status,
            direction: data.direction,
            messageType: data.messageType,
            body: data.body,
            createdAt: data.updatedAt || new Date().toISOString(),
          }];
        });
      }

      // 2. Atualizar lista de conversas ativas
      setConversations((prevConv) => {
        const idx = prevConv.findIndex((c) => normalizePhone(c.phone) === incomingPhone);
        const msgPreview = data.body || "Mídia";

        if (idx !== -1) {
          const updated = [...prevConv];
          updated[idx] = {
            ...updated[idx],
            lastMessage: msgPreview,
            updatedAt: data.updatedAt || new Date().toISOString(),
            status: data.status,
            direction: data.direction,
            ...(data.profileName ? { profileName: data.profileName } : {}),
          };
          const item = updated.splice(idx, 1)[0];
          updated.unshift(item);
          return updated;
        } else {
          return [{
            phone: incomingPhone,
            profileName: data.profileName || null,
            lastMessage: msgPreview,
            updatedAt: data.updatedAt || new Date().toISOString(),
            status: data.status,
            direction: data.direction,
            messageType: data.messageType,
          }, ...prevConv];
        }
      });
    }
  });

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px", height: "calc(100vh - 150px)", minHeight: "550px" }}>
      <div>
        <h1 className="page-heading">Caixa de Entrada</h1>
        <p className="page-subheading">Visualize e responda conversas com clientes em tempo real</p>
      </div>

      {!selectedAccount ? (
        <div className="glass" style={{ borderRadius: "var(--radius-xl)" }}>
          <div className="empty-state">
            <span className="empty-state__icon">💬</span>
            <span className="empty-state__title">Nenhuma conta selecionada</span>
            <span className="empty-state__desc">Configure ou ative uma conta Meta API para abrir a Caixa de Entrada.</span>
          </div>
        </div>
      ) : (
        <div className="glass" style={{ display: "flex", flex: 1, borderRadius: "var(--radius-xl)", overflow: "hidden", border: "1px solid var(--border-color)", minHeight: "450px" }}>
          
          {/* 1. Lista de Conversas (Esquerda) */}
          <div className={`chat-panel-list${selectedPhone ? " mobile-hidden" : ""}`}>
            <div style={{ padding: "16px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: "600" }}>Conversas Recentes</h3>
              <button 
                type="button" 
                onClick={() => fetchConversations(selectedAccount.id)} 
                style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "1.1rem" }}
                title="Atualizar lista"
              >
                🔄
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
              {isConversationsLoading ? (
                <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div className="skeleton" style={{ width: "100%", height: "60px", borderRadius: "8px" }}></div>
                  <div className="skeleton" style={{ width: "100%", height: "60px", borderRadius: "8px" }}></div>
                </div>
              ) : conversations.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-state__icon">💬</span>
                  <span className="empty-state__desc">Nenhuma conversa ativa encontrada.</span>
                </div>
              ) : (
                conversations.map((c) => {
                  const isActive = selectedPhone === c.phone;
                  const initials = c.profileName
                    ? c.profileName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
                    : "📱";
                  return (
                    <div
                      key={c.phone}
                      onClick={() => {
                        setSelectedPhone(c.phone);
                        fetchChatMessages(selectedAccount.id, c.phone);
                      }}
                      className={`conv-item${isActive ? " active" : ""}`}
                    >
                      <div className="conv-avatar">{initials}</div>
                      <div className="conv-item__body">
                        <div className="conv-item__top">
                          <span className="conv-item__name">
                            {c.profileName || c.phone}
                          </span>
                          <span className="conv-item__time">
                            {new Date(c.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="conv-item__preview" style={{ fontStyle: c.direction === "INCOMING" ? "italic" : "normal" }}>
                          {c.direction === "OUTGOING" ? "Você: " : ""}{c.lastMessage}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 2. Área do Histórico de Chat (Direita) */}
          <div className={`chat-panel-msg${!selectedPhone ? " mobile-hidden" : ""}`}>
            {!selectedPhone ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className="empty-state">
                  <span className="empty-state__icon">💬</span>
                  <span className="empty-state__title">Nenhuma conversa aberta</span>
                  <span className="empty-state__desc">Selecione uma conversa ao lado para visualizar o atendimento.</span>
                </div>
              </div>
            ) : (
              <>
                {/* Header da conversa */}
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.05)", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setSelectedPhone("")}
                    className="btn btn-secondary"
                    style={{ padding: "6px 10px", fontSize: "0.8rem", flexShrink: 0, display: "none" }}
                    id="chat-back-btn"
                  >
                    ← Voltar
                  </button>
                  <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: "700", fontSize: "1.1rem" }}>
                      {conversations.find(c => c.phone === selectedPhone)?.profileName
                        ? `👤 ${conversations.find(c => c.phone === selectedPhone)?.profileName}`
                        : `📱 ${selectedPhone}`}
                    </span>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      {conversations.find(c => c.phone === selectedPhone)?.profileName
                        ? selectedPhone
                        : "Canal Oficial do WhatsApp"}
                    </span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => fetchChatMessages(selectedAccount.id, selectedPhone)} 
                    className="btn btn-secondary"
                    style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                  >
                    🔄 Atualizar Chat
                  </button>
                </div>

                {/* Mensagens do chat */}
                <div style={{ flex: 1, padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px" }}>
                  {isChatLoading ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%", height: "100%", justifyContent: "center", alignItems: "center", color: "var(--text-muted)" }}>
                      <div className="skeleton" style={{ width: "60%", height: "40px", borderRadius: "12px", alignSelf: "flex-start" }} />
                      <div className="skeleton" style={{ width: "40%", height: "40px", borderRadius: "12px", alignSelf: "flex-end" }} />
                    </div>
                  ) : (
                    <>
                      {chatMessages.map((msg, index) => {
                        const isIncoming = msg.direction === "INCOMING";
                        return (
                          <div
                            key={msg.id || index}
                            className={`msg-bubble-wrap msg-bubble-wrap--${isIncoming ? "in" : "out"}`}
                          >
                            <div className={`msg-bubble msg-bubble--${isIncoming ? "in" : "out"}`}>
                              {/* Mídia do cabeçalho do template (OUTGOING) */}
                              {(() => {
                                const mediaUrl = msg.mediaUrl || msg.variables?.mediaUrl;
                                const tmpl = templates.find(t => t.name === msg.templateName);
                                const headerComp = tmpl && Array.isArray(tmpl.components)
                                  ? tmpl.components.find((c: any) => c.type === "HEADER")
                                  : null;
                                const fmt = headerComp?.format || msg.messageType;

                                if (mediaUrl && fmt === "IMAGE") return (
                                  <img src={mediaUrl} alt="Imagem" style={{ maxWidth: "100%", borderRadius: "8px", marginBottom: "6px", display: "block" }} />
                                );
                                if (mediaUrl && fmt === "VIDEO") return (
                                  <video src={mediaUrl} controls style={{ maxWidth: "100%", borderRadius: "8px", marginBottom: "6px", display: "block" }} />
                                );
                                if (mediaUrl && fmt === "DOCUMENT") return (
                                  <a href={mediaUrl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--primary)", marginBottom: "6px" }}>
                                    📄 {mediaUrl.split("/").pop() || "Documento"}
                                  </a>
                                );

                                // Mídia recebida (INCOMING) - mediaUrl é o ID, buscar via proxy
                                if (mediaUrl && msg.direction === "INCOMING" && selectedAccount) {
                                  const proxyUrl = `${API_BASE_URL}/accounts/${selectedAccount.id}/media/${mediaUrl}`;
                                  if (msg.messageType === "IMAGE") return (
                                    <img src={proxyUrl} alt="Imagem recebida" style={{ maxWidth: "100%", borderRadius: "8px", marginBottom: "6px", display: "block" }} />
                                  );
                                  if (msg.messageType === "VIDEO") return (
                                    <video src={proxyUrl} controls style={{ maxWidth: "100%", borderRadius: "8px", marginBottom: "6px", display: "block" }} />
                                  );
                                  if (msg.messageType === "AUDIO") return (
                                    <audio src={proxyUrl} controls style={{ width: "100%", marginBottom: "6px" }} />
                                  );
                                  if (msg.messageType === "DOCUMENT") return (
                                    <a href={proxyUrl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--primary)", marginBottom: "6px" }}>
                                      📄 Documento recebido
                                    </a>
                                  );
                                  return (
                                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "6px" }}>
                                      📎 Arquivo recebido
                                    </div>
                                  );
                                }
                                return null;
                              })()}

                              {/* Texto da mensagem */}
                              {msg.body || (msg.templateName ? (
                                (() => {
                                  const tmpl = templates.find(t => t.name === msg.templateName);
                                  if (!tmpl) return `📋 Template: ${msg.templateName}`;
                                  const bodyComp = Array.isArray(tmpl.components)
                                    ? tmpl.components.find((c: any) => c.type === "BODY")
                                    : null;
                                  if (!bodyComp || !bodyComp.text) return `📋 Template: ${msg.templateName}`;
                                  let text = bodyComp.text;
                                  const resolvedVars = msg.variables?.variables || [];
                                  if (Array.isArray(resolvedVars)) {
                                    resolvedVars.forEach((val: any, idx: number) => {
                                      text = text.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'), val);
                                    });
                                  }
                                  return text;
                                })()
                              ) : (!msg.mediaUrl && !msg.variables?.mediaUrl ? "Mídia" : null))}
                            </div>
                            <div className="msg-time" style={{ display: "flex", gap: "6px" }}>
                              <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {!isIncoming && (
                                <span style={{
                                  color: msg.status === "READ" ? "var(--success)" :
                                         msg.status === "DELIVERED" ? "#22d3ee" :
                                         msg.status === "FAILED" ? "var(--error)" : "var(--text-muted)"
                                }}>
                                  {msg.status === "READ" ? "✓✓ Lido" :
                                   msg.status === "DELIVERED" ? "✓✓ Entregue" :
                                   msg.status === "SENT" ? "✓ Enviado" :
                                   msg.status === "FAILED" ? "⚠️ Falha" : "Enviando..."}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Ref para scroll automático */}
                      <div ref={(el) => el?.scrollIntoView({ behavior: 'smooth' })} />
                    </>
                  )}
                </div>

                {/* Janela de 24h & Campo de Digitação */}
                {(() => {
                  const getLastIncoming = () => {
                    for (let i = chatMessages.length - 1; i >= 0; i--) {
                      if (chatMessages[i].direction === "INCOMING") return chatMessages[i];
                    }
                    return null;
                  };
                  const lastInc = getLastIncoming();
                  let isWindowActive = false;
                  let timeRemainingStr = "";

                  if (lastInc) {
                    const lastIncTime = new Date(lastInc.createdAt).getTime();
                    const now = new Date().getTime();
                    const diffMs = now - lastIncTime;
                    const diffHrs = diffMs / (1000 * 60 * 60);
                    
                    if (diffHrs < 24) {
                      isWindowActive = true;
                      const remainingMs = (24 * 60 * 60 * 1000) - diffMs;
                      const remHrs = Math.floor(remainingMs / (1000 * 60 * 60));
                      const remMins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
                      timeRemainingStr = `${remHrs}h ${remMins}m`;
                    }
                  }

                  return (
                    <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border-color)", background: "rgba(0,0,0,0.1)", display: "flex", flexDirection: "column", gap: "10px" }}>
                      
                      {lastInc ? (
                        isWindowActive ? (
                          <div style={{
                            background: "rgba(16, 185, 129, 0.1)",
                            border: "1px solid rgba(16, 185, 129, 0.25)",
                            borderRadius: "6px",
                            padding: "8px 12px",
                            fontSize: "0.82rem",
                            color: "var(--success)",
                            fontWeight: "500",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px"
                          }}>
                            <span className="window-badge" style={{ fontSize: "0.78rem" }}><span className="dot" />Janela aberta</span>
                            <span style={{ fontSize: "0.8rem" }}>Responda livremente · Expira em <strong>{timeRemainingStr}</strong></span>
                          </div>
                        ) : (
                          <div style={{
                            background: "rgba(245, 158, 11, 0.1)",
                            border: "1px solid rgba(245, 158, 11, 0.25)",
                            borderRadius: "6px",
                            padding: "8px 12px",
                            fontSize: "0.82rem",
                            color: "#f59e0b",
                            fontWeight: "500",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px"
                          }}>
                            <span>⚠️ <strong>Janela de Atendimento Expirada:</strong> Mais de 24h se passaram desde a última resposta do cliente. Para enviar uma mensagem, use a opção de disparar um Template de reabertura.</span>
                          </div>
                        )
                      ) : (
                        <div style={{
                          background: "rgba(255, 255, 255, 0.03)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "6px",
                          padding: "8px 12px",
                          fontSize: "0.82rem",
                          color: "var(--text-secondary)",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px"
                        }}>
                          <span>ℹ️ O cliente ainda não respondeu a esta conversa. Você só poderá enviar respostas de texto livre após a primeira interação dele.</span>
                        </div>
                      )}

                      {/* Campo de digitação de mensagem e botões */}
                      <form onSubmit={sendReply} style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <input
                          type="text"
                          placeholder={
                            !lastInc || isWindowActive 
                              ? "Digite a sua resposta..." 
                              : "Janela expirada — envie um template para reabrir..."
                          }
                          value={replyBody}
                          onChange={(e) => setReplyBody(e.target.value)}
                          disabled={lastInc ? !isWindowActive : true}
                          className="form-control"
                          style={{ flex: 1, padding: "12px 16px", borderRadius: "var(--radius-lg)" }}
                        />
                        <button
                          type="submit"
                          className="btn btn-primary"
                          style={{ padding: "12px 20px", borderRadius: "var(--radius-lg)" }}
                          disabled={isSendingReply || !replyBody.trim() || (lastInc ? !isWindowActive : true)}
                        >
                          {isSendingReply ? "Enviando..." : "Enviar ✈️"}
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => setShowChatTemplateModal(true)}
                          className="btn btn-secondary"
                          style={{ padding: "12px 16px", borderRadius: "var(--radius-lg)", whiteSpace: "nowrap" }}
                          title="Enviar Template de Mensagem"
                        >
                          📝 Reabrir
                        </button>
                      </form>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal de Enviar Template no Chat */}
      {showChatTemplateModal && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }}>
          <div className="glass" style={{ width: "90%", maxWidth: "500px", padding: "30px", borderRadius: "var(--radius-xl)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: "700" }}>Enviar Template de Mensagem</h3>
              <button 
                type="button" 
                onClick={() => {
                  setShowChatTemplateModal(false);
                  setSelectedTemplateName("");
                  setTemplateVariables([]);
                }} 
                style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-secondary)" }}>Selecione o Template</label>
                <select
                  className="form-control"
                  value={selectedTemplateName}
                  onChange={(e) => {
                    const name = e.target.value;
                    setSelectedTemplateName(name);
                    const t = templates.find(temp => temp.name === name);
                    if (t) {
                      const body = Array.isArray(t.components) ? t.components.find(c => c.type === "BODY")?.text || "" : "";
                      const vars = detectBodyVariables(body);
                      setTemplateVariables(vars.map(() => ""));
                    } else {
                      setTemplateVariables([]);
                    }
                  }}
                >
                  <option value="">Selecione...</option>
                  {templates.filter(t => t.status === "APPROVED").map(t => (
                    <option key={t.id} value={t.name}>{t.name} ({t.language})</option>
                  ))}
                </select>
              </div>

              {/* Variáveis do Template */}
              {templateVariables.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-secondary)" }}>Preencha as variáveis</label>
                  {templateVariables.map((v, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Variável {"{{"}{i + 1}{"}}"}</span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder={`Valor para {{${i + 1}}}`}
                        value={v}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTemplateVariables(prev => {
                            const next = [...prev];
                            next[i] = val;
                            return next;
                          });
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                className="btn btn-primary"
                style={{ width: "100%", padding: "12px", marginTop: "10px" }}
                disabled={!selectedTemplateName || (templateVariables.length > 0 && templateVariables.some(v => !v.trim()))}
                onClick={async () => {
                  if (!selectedAccount || !selectedPhone || !selectedTemplateName) return;
                  try {
                    setIsChatLoading(true);
                    await axios.post(`${API_BASE_URL}/accounts/${selectedAccount.id}/messages/send`, {
                      to: selectedPhone,
                      templateName: selectedTemplateName,
                      variables: templateVariables,
                    });
                    
                    setShowChatTemplateModal(false);
                    setSelectedTemplateName("");
                    setTemplateVariables([]);
                    showAlert("Template enviado com sucesso! 🚀", "success");
                    
                    setTimeout(() => fetchChatMessages(selectedAccount.id, selectedPhone, true), 1000);
                  } catch (err: any) {
                    const details = err.response?.data?.error || "Erro desconhecido";
                    showAlert(`Falha ao enviar template: ${details}`, "error");
                  } finally {
                    setIsChatLoading(false);
                  }
                }}
              >
                Enviar Template ✈️
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
