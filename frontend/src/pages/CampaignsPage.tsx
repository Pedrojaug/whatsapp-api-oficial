import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useAccount } from "../contexts/AccountContext";
import { useAlert } from "../contexts/AlertContext";
import { API_BASE_URL } from "../contexts/AuthContext";

function ModalPortal({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body);
}

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:     { label: "Rascunho",  color: "#aaa",          bg: "rgba(255,255,255,0.08)" },
  ACTIVE:    { label: "Ativa",     color: "var(--primary)", bg: "rgba(0,194,107,0.15)" },
  PAUSED:    { label: "Pausada",   color: "#f9c74f",        bg: "rgba(249,199,79,0.12)" },
  COMPLETED: { label: "Concluída", color: "#7b9cff",        bg: "rgba(123,156,255,0.12)" },
};

const DAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function describeSchedule(c: any): string {
  if (c.scheduleType === "ONCE" && c.scheduleDate) {
    return `Uma vez em ${new Date(c.scheduleDate).toLocaleString("pt-BR")}`;
  }
  if (c.scheduleType === "DAILY" && c.scheduleTime) {
    return `Diariamente às ${c.scheduleTime} UTC`;
  }
  if (c.scheduleType === "WEEKLY" && c.scheduleTime && c.scheduleDays?.length) {
    const days = c.scheduleDays.map((d: number) => DAYS_PT[d] ?? d).join(", ");
    return `Semanal — ${days} às ${c.scheduleTime} UTC`;
  }
  if (c.scheduleType === "MONTHLY" && c.scheduleTime && c.scheduleDays?.length) {
    return `Mensal — dia ${c.scheduleDays[0]} às ${c.scheduleTime} UTC`;
  }
  return c.scheduleType;
}

interface Template { id: string; name: string; status: string; components: any; }
interface ContactList { id: string; name: string; tags: string[]; _count?: { contacts: number }; }
interface Campaign {
  id: string; name: string; status: string;
  templateName: string; contactListId: string | null;
  variables: any; mediaUrl: string | null;
  scheduleType: string; scheduleTime: string | null;
  scheduleDays: number[]; scheduleDate: string | null;
  nextRunAt: string | null; lastRunAt: string | null;
  runCount: number; createdAt: string;
  _count?: { runs: number };
}
interface CampaignRun {
  id: string; status: string; messagesSent: number;
  contactsTotal: number; startedAt: string; finishedAt: string | null;
}

const EMPTY_FORM = {
  name: "", contactListId: "", templateName: "",
  variables: [] as string[], mediaUrl: "",
  scheduleType: "DAILY", scheduleTime: "09:00",
  scheduleDays: [] as number[], scheduleDate: "",
};

export default function CampaignsPage() {
  const { selectedAccount } = useAccount();
  const { showAlert } = useAlert();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [runs, setRuns] = useState<CampaignRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);

  const [showModal, setShowModal] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<Campaign | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const fetchCampaigns = useCallback(async (accountId: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/accounts/${accountId}/campaigns`);
      setCampaigns(res.data);
    } catch {
      showAlert("Erro ao buscar campanhas.", "error");
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  const fetchSupport = useCallback(async (accountId: string) => {
    const [tRes, lRes] = await Promise.allSettled([
      axios.get(`${API_BASE_URL}/accounts/${accountId}/templates`),
      axios.get(`${API_BASE_URL}/accounts/${accountId}/lists`),
    ]);
    if (tRes.status === "fulfilled") setTemplates(tRes.value.data);
    if (lRes.status === "fulfilled") setContactLists(lRes.value.data);
  }, []);

  const fetchRuns = useCallback(async (campaignId: string) => {
    if (!selectedAccount) return;
    setLoadingRuns(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/accounts/${selectedAccount.id}/campaigns/${campaignId}/runs`);
      setRuns(res.data);
    } catch {
      setRuns([]);
    } finally {
      setLoadingRuns(false);
    }
  }, [selectedAccount]);

  useEffect(() => {
    if (selectedAccount) {
      fetchCampaigns(selectedAccount.id);
      fetchSupport(selectedAccount.id);
    } else {
      setCampaigns([]);
    }
  }, [selectedAccount, fetchCampaigns, fetchSupport]);

  const getVariablesCount = (name: string) => {
    const tmpl = templates.find((t) => t.name === name);
    if (!tmpl) return 0;
    const body = Array.isArray(tmpl.components) ? tmpl.components.find((c: any) => c.type === "BODY") : null;
    const matches = body?.text?.match(/\{\{\d+\}\}/g);
    return matches ? new Set(matches).size : 0;
  };

  const handleTemplateChange = (name: string) => {
    const count = getVariablesCount(name);
    setForm((f) => ({ ...f, templateName: name, variables: Array(count).fill("STATIC_VALUE"), mediaUrl: "" }));
  };

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setEditTarget(null);
    setShowModal("create");
  };

  const openEdit = (c: Campaign) => {
    setForm({
      name: c.name,
      contactListId: c.contactListId || "",
      templateName: c.templateName,
      variables: Array.isArray(c.variables) ? c.variables : [],
      mediaUrl: c.mediaUrl || "",
      scheduleType: c.scheduleType,
      scheduleTime: c.scheduleTime || "09:00",
      scheduleDays: c.scheduleDays || [],
      scheduleDate: c.scheduleDate ? c.scheduleDate.slice(0, 16) : "",
    });
    setEditTarget(c);
    setShowModal("edit");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        contactListId: form.contactListId || null,
        templateName: form.templateName,
        variables: form.variables,
        mediaUrl: form.mediaUrl || null,
        scheduleType: form.scheduleType,
        scheduleTime: ["DAILY", "WEEKLY", "MONTHLY"].includes(form.scheduleType) ? form.scheduleTime : null,
        scheduleDays: ["WEEKLY", "MONTHLY"].includes(form.scheduleType) ? form.scheduleDays : [],
        scheduleDate: form.scheduleType === "ONCE" ? form.scheduleDate || null : null,
      };

      if (showModal === "create") {
        await axios.post(`${API_BASE_URL}/accounts/${selectedAccount.id}/campaigns`, payload);
        showAlert("Campanha criada!", "success");
      } else if (editTarget) {
        await axios.put(`${API_BASE_URL}/accounts/${selectedAccount.id}/campaigns/${editTarget.id}`, payload);
        showAlert("Campanha atualizada!", "success");
      }

      setShowModal(null);
      fetchCampaigns(selectedAccount.id);
    } catch (err: any) {
      showAlert(err.response?.data?.error || "Erro ao salvar campanha.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (id: string) => {
    if (!selectedAccount) return;
    try {
      await axios.post(`${API_BASE_URL}/accounts/${selectedAccount.id}/campaigns/${id}/activate`);
      showAlert("Campanha ativada!", "success");
      fetchCampaigns(selectedAccount.id);
    } catch (err: any) {
      showAlert(err.response?.data?.error || "Erro ao ativar.", "error");
    }
  };

  const handlePause = async (id: string) => {
    if (!selectedAccount) return;
    try {
      await axios.post(`${API_BASE_URL}/accounts/${selectedAccount.id}/campaigns/${id}/pause`);
      showAlert("Campanha pausada.", "success");
      fetchCampaigns(selectedAccount.id);
    } catch (err: any) {
      showAlert(err.response?.data?.error || "Erro ao pausar.", "error");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!selectedAccount) return;
    if (!window.confirm(`Excluir a campanha "${name}"?`)) return;
    try {
      await axios.delete(`${API_BASE_URL}/accounts/${selectedAccount.id}/campaigns/${id}`);
      showAlert("Campanha excluída.", "success");
      if (selectedCampaign?.id === id) setSelectedCampaign(null);
      fetchCampaigns(selectedAccount.id);
    } catch {
      showAlert("Erro ao excluir.", "error");
    }
  };

  const handleSelectCampaign = (c: Campaign) => {
    setSelectedCampaign(c);
    fetchRuns(c.id);
  };

  const toggleWeekDay = (day: number) => {
    setForm((f) => ({
      ...f,
      scheduleDays: f.scheduleDays.includes(day)
        ? f.scheduleDays.filter((d) => d !== day)
        : [...f.scheduleDays, day],
    }));
  };

  const selectedTemplateObj = templates.find((t) => t.name === form.templateName);
  const headerComp = selectedTemplateObj?.components?.find?.((c: any) => c.type === "HEADER");
  const hasMedia = headerComp && ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerComp.format);

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px" }}>
        <div>
          <h1 className="page-heading">Campanhas Recorrentes</h1>
          <p className="page-subheading">Automatize disparos para listas de contatos em horários definidos</p>
        </div>
        <button type="button" onClick={openCreate} disabled={!selectedAccount} className="btn btn-primary">
          + Nova Campanha
        </button>
      </div>

      {!selectedAccount ? (
        <div className="glass" style={{ borderRadius: "var(--radius-xl)" }}>
          <div className="empty-state">
            <span className="empty-state__icon">📣</span>
            <span className="empty-state__title">Nenhuma conta selecionada</span>
            <span className="empty-state__desc">Selecione uma conta para gerenciar campanhas.</span>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "24px" }}>
          {/* Left: campaigns list */}
          <div className="glass" style={{ padding: "24px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: "700", color: "var(--text-secondary)" }}>
              {campaigns.length} campanha{campaigns.length !== 1 ? "s" : ""}
            </h3>

            {loading ? (
              [1,2,3].map((i) => <div key={i} className="skeleton" style={{ height: "90px", borderRadius: "var(--radius-md)" }} />)
            ) : campaigns.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Nenhuma campanha criada ainda. Clique em "+ Nova Campanha".</p>
            ) : (
              campaigns.map((c) => {
                const st = STATUS_STYLES[c.status] || STATUS_STYLES.DRAFT;
                const isSelected = selectedCampaign?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectCampaign(c)}
                    className="glass glass-interactive"
                    style={{
                      padding: "18px 20px", borderRadius: "var(--radius-md)", cursor: "pointer",
                      border: isSelected ? "1.5px solid var(--primary)" : "1px solid rgba(255,255,255,0.05)",
                      background: isSelected ? "rgba(0,194,107,0.04)" : undefined,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "5px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ fontWeight: "700", fontSize: "1rem" }}>{c.name}</span>
                          <span style={{ fontSize: "0.72rem", fontWeight: "700", padding: "2px 9px", borderRadius: "20px", background: st.bg, color: st.color }}>
                            {st.label}
                          </span>
                        </div>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                          🕐 {describeSchedule(c)}
                        </span>
                        <div style={{ display: "flex", gap: "16px", fontSize: "0.78rem", color: "var(--text-muted)", flexWrap: "wrap" }}>
                          <span>📋 {c.templateName}</span>
                          {c.nextRunAt && c.status === "ACTIVE" && (
                            <span>⏭ Próximo: {new Date(c.nextRunAt).toLocaleString("pt-BR")}</span>
                          )}
                          <span>▶ {c.runCount} execuç{c.runCount !== 1 ? "ões" : "ão"}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "6px", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                        {c.status === "DRAFT" || c.status === "PAUSED" ? (
                          <button onClick={() => handleActivate(c.id)} className="btn btn-primary btn-sm">
                            ▶ Ativar
                          </button>
                        ) : c.status === "ACTIVE" ? (
                          <button onClick={() => handlePause(c.id)} className="btn btn-secondary btn-sm">
                            ⏸ Pausar
                          </button>
                        ) : null}
                        {c.status !== "ACTIVE" && (
                          <button onClick={() => openEdit(c)} className="btn btn-secondary btn-sm">
                            ✏️
                          </button>
                        )}
                        <button onClick={() => handleDelete(c.id, c.name)} className="btn btn-danger btn-sm">
                          🗑
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right: run history */}
          <div className="glass" style={{ padding: "24px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "14px" }}>
            {selectedCampaign ? (
              <>
                <h3 style={{ fontSize: "1rem", fontWeight: "700" }}>Histórico — {selectedCampaign.name}</h3>
                {loadingRuns ? (
                  [1,2,3].map((i) => <div key={i} className="skeleton" style={{ height: "50px", borderRadius: "var(--radius-sm)" }} />)
                ) : runs.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Nenhuma execução registrada ainda.</p>
                ) : (
                  runs.map((run) => {
                    const statusColor = run.status === "COMPLETED" ? "var(--primary)" : run.status === "FAILED" ? "var(--error)" : "#f9c74f";
                    return (
                      <div key={run.id} style={{ padding: "12px 14px", background: "rgba(0,0,0,0.15)", borderRadius: "var(--radius-md)", border: "1px solid rgba(255,255,255,0.04)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: "700", color: statusColor }}>
                            {run.status === "COMPLETED" ? "✅ Concluída" : run.status === "FAILED" ? "❌ Falhou" : "⏳ Executando"}
                          </span>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            {new Date(run.startedAt).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                          {run.messagesSent}/{run.contactsTotal} mensagens enfileiradas
                        </span>
                      </div>
                    );
                  })
                )}
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text-muted)", textAlign: "center", padding: "40px 20px" }}>
                <span style={{ fontSize: "2.5rem", marginBottom: "12px" }}>📣</span>
                <span style={{ fontSize: "0.9rem" }}>Clique em uma campanha para ver o histórico de execuções.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <ModalPortal>
          <div className="modal-overlay">
            <div className="glass modal-card modal-card--lg fade-in" style={{ maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
              <div className="modal-header">
                <span className="modal-header__title">
                  {showModal === "create" ? "Nova Campanha Recorrente" : `Editar — ${editTarget?.name}`}
                </span>
                <button type="button" className="modal-header__close" onClick={() => setShowModal(null)}>✕</button>
              </div>

              <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                <div className="modal-body scroll-area" style={{ flex: 1, gap: "16px" }}>
                  {/* Name */}
                  <div className="field">
                    <label className="field-label">Nome da campanha *</label>
                    <input
                      type="text"
                      className="field-input"
                      placeholder="Ex: Newsletter Semanal, Promoção Mensal..."
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>

                  {/* Template */}
                  <div className="field">
                    <label className="field-label">Template aprovado *</label>
                    <select
                      className="field-input"
                      value={form.templateName}
                      onChange={(e) => handleTemplateChange(e.target.value)}
                      required
                    >
                      <option value="">Selecione um template aprovado</option>
                      {templates.filter((t) => t.status === "APPROVED").map((t) => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Variable mappings */}
                  {form.variables.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "14px 16px", background: "rgba(0,0,0,0.15)", borderRadius: "var(--radius-md)", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <label className="field-label">Mapeamento de Variáveis</label>
                      {form.variables.map((mapping, idx) => {
                        const isStatic = mapping.startsWith("STATIC:") || mapping === "STATIC_VALUE";
                        const staticVal = mapping.startsWith("STATIC:") ? mapping.slice(7) : "";
                        return (
                          <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                            <label style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{"{{" + (idx + 1) + "}}"}</label>
                            <select
                              className="field-input"
                              style={{ fontSize: "0.85rem", padding: "8px 12px" }}
                              value={isStatic ? "STATIC_VALUE" : mapping}
                              onChange={(e) => {
                                const val = e.target.value;
                                const updated = [...form.variables];
                                updated[idx] = val === "STATIC_VALUE" ? "STATIC:" : val;
                                setForm((f) => ({ ...f, variables: updated }));
                              }}
                            >
                              <option value="STATIC_VALUE">Valor Fixo</option>
                              <option value="CONTACT_NAME">Nome do Contato</option>
                              <option value="CONTACT_PHONE">Telefone do Contato</option>
                              <option value="CONTACT_VAR_1">Variável da Lista 1</option>
                              <option value="CONTACT_VAR_2">Variável da Lista 2</option>
                              <option value="CONTACT_VAR_3">Variável da Lista 3</option>
                            </select>
                            {isStatic && (
                              <input
                                type="text"
                                className="field-input"
                                style={{ fontSize: "0.85rem", padding: "8px 12px" }}
                                placeholder="Valor fixo"
                                value={staticVal}
                                onChange={(e) => {
                                  const updated = [...form.variables];
                                  updated[idx] = `STATIC:${e.target.value}`;
                                  setForm((f) => ({ ...f, variables: updated }));
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Media URL */}
                  {hasMedia && (
                    <div className="field">
                      <label className="field-label">URL de Mídia ({headerComp.format})</label>
                      <input
                        type="text"
                        className="field-input"
                        placeholder="https://..."
                        value={form.mediaUrl}
                        onChange={(e) => setForm((f) => ({ ...f, mediaUrl: e.target.value }))}
                      />
                    </div>
                  )}

                  {/* Contact list */}
                  <div className="field">
                    <label className="field-label">Lista de Contatos</label>
                    <select
                      className="field-input"
                      value={form.contactListId}
                      onChange={(e) => setForm((f) => ({ ...f, contactListId: e.target.value }))}
                    >
                      <option value="">Selecione (obrigatório para ativar)</option>
                      {contactLists.map((l) => (
                        <option key={l.id} value={l.id}>{l.name} ({l._count?.contacts ?? 0} contatos)</option>
                      ))}
                    </select>
                  </div>

                  {/* Schedule */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px", background: "rgba(0,0,0,0.15)", borderRadius: "var(--radius-md)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <label className="field-label">Agendamento</label>

                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {(["ONCE", "DAILY", "WEEKLY", "MONTHLY"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, scheduleType: t, scheduleDays: [] }))}
                          className={`btn btn-sm ${form.scheduleType === t ? "btn-primary" : "btn-secondary"}`}
                        >
                          {t === "ONCE" ? "Uma vez" : t === "DAILY" ? "Diário" : t === "WEEKLY" ? "Semanal" : "Mensal"}
                        </button>
                      ))}
                    </div>

                    {form.scheduleType === "ONCE" && (
                      <div className="field">
                        <label className="field-label">Data e hora (UTC)</label>
                        <input
                          type="datetime-local"
                          className="field-input"
                          value={form.scheduleDate}
                          onChange={(e) => setForm((f) => ({ ...f, scheduleDate: e.target.value }))}
                          required={form.scheduleType === "ONCE"}
                        />
                      </div>
                    )}

                    {(form.scheduleType === "DAILY" || form.scheduleType === "WEEKLY" || form.scheduleType === "MONTHLY") && (
                      <div className="field" style={{ maxWidth: "160px" }}>
                        <label className="field-label">Horário de envio (UTC)</label>
                        <input
                          type="time"
                          className="field-input"
                          value={form.scheduleTime}
                          onChange={(e) => setForm((f) => ({ ...f, scheduleTime: e.target.value }))}
                          required
                        />
                      </div>
                    )}

                    {form.scheduleType === "WEEKLY" && (
                      <div className="field">
                        <label className="field-label">Dias da semana</label>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {DAYS_PT.map((day, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => toggleWeekDay(idx)}
                              className={`btn btn-sm ${form.scheduleDays.includes(idx) ? "btn-primary" : "btn-secondary"}`}
                              style={{ minWidth: "44px" }}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {form.scheduleType === "MONTHLY" && (
                      <div className="field" style={{ maxWidth: "120px" }}>
                        <label className="field-label">Dia do mês (1–28)</label>
                        <input
                          type="number"
                          className="field-input"
                          min={1}
                          max={28}
                          value={form.scheduleDays[0] ?? 1}
                          onChange={(e) => setForm((f) => ({ ...f, scheduleDays: [parseInt(e.target.value) || 1] }))}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" onClick={() => setShowModal(null)} className="btn btn-secondary">Cancelar</button>
                  <button type="submit" disabled={saving} className="btn btn-primary" style={{ minWidth: "150px" }}>
                    {saving ? "Salvando..." : showModal === "create" ? "Criar Campanha" : "Salvar Alterações"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
