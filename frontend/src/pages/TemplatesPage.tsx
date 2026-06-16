import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useAccount } from "../contexts/AccountContext";
import { useAlert } from "../hooks/useAlert";
import { API_BASE_URL } from "../contexts/AuthContext";
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

export default function TemplatesPage() {
  const { selectedAccount } = useAccount();
  const { showAlert } = useAlert();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncingTemplates, setSyncingTemplates] = useState(false);
  const [deleteConfirmTemplate, setDeleteConfirmTemplate] = useState<{ id: string; name: string } | null>(null);

  // Template Form States (Template Builder)
  const [showNewTemplateModal, setShowNewTemplateModal] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateCategory, setNewTemplateCategory] = useState("MARKETING");
  const [newTemplateLanguage, setNewTemplateLanguage] = useState("pt_BR");
  const [newTemplateHeaderFormat, setNewTemplateHeaderFormat] = useState<"NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT">("NONE");
  const [newTemplateHeaderText, setNewTemplateHeaderText] = useState("");
  const [newTemplateBodyText, setNewTemplateBodyText] = useState("");
  const [newTemplateFooterText, setNewTemplateFooterText] = useState("");
  const [newTemplateBodyVariables, setNewTemplateBodyVariables] = useState<string[]>([]);
  const [newTemplateButtonType, setNewTemplateButtonType] = useState<"NONE" | "QUICK_REPLY" | "CTA">("NONE");
  const [newTemplateButtons, setNewTemplateButtons] = useState<any[]>([]);

  // Files
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [sampleFileBase64, setSampleFileBase64] = useState("");
  const [sampleFilePreviewUrl, setSampleFilePreviewUrl] = useState("");

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

  useEffect(() => {
    if (selectedAccount) {
      fetchTemplates(selectedAccount.id);
    } else {
      setTemplates([]);
    }
  }, [selectedAccount]);

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
      const friendly = err.response?.data?.error || err.message;
      const metaFull = err.response?.data?.full?.error;
      const raw = metaFull?.error_user_msg || metaFull?.message || err.response?.data?.details?.message;
      const subcode = metaFull?.error_subcode ? ` (subcode ${metaFull.error_subcode})` : "";
      showAlert(`${friendly}${raw ? `\n\nDetalhe Meta: ${raw}${subcode}` : ""}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedAccount) return;
    if (!newTemplateName) { showAlert("Nome do template é obrigatório.", "error"); return; }
    if (!newTemplateBodyText) { showAlert("Corpo da mensagem é obrigatório.", "error"); return; }

    const components: any[] = [];
    if (newTemplateHeaderFormat === "TEXT" && newTemplateHeaderText) {
      components.push({ type: "HEADER", format: "TEXT", text: newTemplateHeaderText });
    } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(newTemplateHeaderFormat)) {
      components.push({ type: "HEADER", format: newTemplateHeaderFormat, example: { header_handle: ["DRAFT_PLACEHOLDER"] } });
    }
    components.push({ type: "BODY", text: newTemplateBodyText });
    if (newTemplateFooterText) components.push({ type: "FOOTER", text: newTemplateFooterText });

    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/accounts/${selectedAccount.id}/templates/draft`, {
        name: newTemplateName,
        category: newTemplateCategory,
        language: newTemplateLanguage,
        components,
      });
      showAlert("Rascunho salvo com sucesso!");
      setShowNewTemplateModal(false);
      fetchTemplates(selectedAccount.id);
    } catch (err: any) {
      showAlert(err.response?.data?.error || "Erro ao salvar rascunho.", "error");
    } finally {
      setLoading(false);
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
    
    const components = Array.isArray(tmpl.components) ? tmpl.components : [];
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

  return (
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
            const componentsList = Array.isArray(tmpl.components) ? tmpl.components : [];
            const bodyComp = componentsList.find((c: any) => c.type === "BODY");
            const headerComp = componentsList.find((c: any) => c.type === "HEADER");
            const footerComp = componentsList.find((c: any) => c.type === "FOOTER");

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
                <div className="template-preview-box" style={{ fontSize: "0.9rem", flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                  {headerComp && <div className="template-preview-header" style={{ fontWeight: "700", paddingBottom: "4px" }}>{headerComp.text}</div>}
                  <div className="template-preview-body" style={{ whiteSpace: "pre-wrap" }}>{bodyComp?.text}</div>
                  {footerComp && <div className="template-preview-footer" style={{ fontSize: "0.75rem", paddingTop: "4px" }}>{footerComp.text}</div>}
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
              <button type="button" onClick={() => { resetTemplateForm(); setShowNewTemplateModal(false); }} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
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
                        Arquivo de Exemplo (.jpg, .png, .mp4, .pdf - Máx 5MB) — webp não é aceito pela Meta
                      </label>
                      <input
                        type="file"
                        accept={newTemplateHeaderFormat === "IMAGE" ? "image/jpeg,image/png" : newTemplateHeaderFormat === "VIDEO" ? "video/mp4,video/3gpp" : "application/pdf"}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 5 * 1024 * 1024) {
                            showAlert("O tamanho do arquivo excede 5MB. Escolha um arquivo menor.", "error");
                            e.target.value = "";
                            return;
                          }
                          const blocked = ["image/webp", "image/gif", "image/bmp", "image/tiff"];
                          if (blocked.includes(file.type)) {
                            showAlert(`Formato ${file.type.split("/")[1].toUpperCase()} não é aceito pela Meta. Use JPG ou PNG.`, "error");
                            e.target.value = "";
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
                          <span style={{ fontSize: "0.8rem", color: "var(--primary)", fontWeight: "bold", width: "40px" }}>{"{?" + (idx + 1) + "}"}</span>
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
              <div className="phone-simulator-panel" style={{ flex: 0.8, padding: "24px 30px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "15px" }}>
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
            <div style={{ display: "flex", gap: "12px", justifyContent: "space-between", padding: "20px 30px", borderTop: "1px solid var(--border-color)", background: "rgba(0,0,0,0.1)" }}>
              <button type="button" onClick={() => { resetTemplateForm(); setShowNewTemplateModal(false); }} className="btn btn-secondary">Cancelar</button>
              <div style={{ display: "flex", gap: "12px" }}>
                <button type="button" onClick={handleSaveDraft} disabled={loading} className="btn btn-secondary" style={{ minWidth: "150px" }}>
                  {loading ? "Salvando..." : "💾 Salvar Rascunho"}
                </button>
                <button type="button" onClick={handleCreateTemplate} disabled={loading} className="btn btn-primary" style={{ minWidth: "150px" }}>
                  {loading ? "Processando..." : "Enviar para Meta"}
                </button>
              </div>
            </div>

          </div>
        </div>
      </ModalPortal>)}
    </div>
  );
}
