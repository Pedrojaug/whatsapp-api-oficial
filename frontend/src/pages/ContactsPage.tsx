import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useAccount } from "../contexts/AccountContext";
import { useAlert } from "../contexts/AlertContext";
import { API_BASE_URL } from "../contexts/AuthContext";

function ModalPortal({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body);
}

export default function ContactsPage() {
  const { selectedAccount } = useAccount();
  const { showAlert } = useAlert();

  const [contactLists, setContactLists] = useState<any[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  
  // List modal states
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListRawContacts, setNewListRawContacts] = useState("");
  const [selectedList, setSelectedList] = useState<any | null>(null);
  
  // Import states
  const [importMode, setImportMode] = useState<"csv" | "manual" | "xlsx">("csv");
  const [manualContacts, setManualContacts] = useState<Array<{ name: string; phone: string; variablesStr: string }>>([
    { name: "", phone: "", variablesStr: "" }
  ]);
  const [xlsxContacts, setXlsxContacts] = useState<any[]>([]);
  
  // Edit list states
  const [showEditListModal, setShowEditListModal] = useState<any | null>(null);
  const [editListName, setEditListName] = useState("");
  const [editContacts, setEditContacts] = useState<Array<{ id?: string; name: string; phone: string; variablesStr: string }>>([]);
  
  const [loading, setLoading] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);

  // Tag modal states
  const [tagModal, setTagModal] = useState<{ listId: string; listName: string } | null>(null);
  const [tagModalTags, setTagModalTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [savingTags, setSavingTags] = useState(false);

  const fetchContactLists = async (accountId: string) => {
    setLoadingLists(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/accounts/${accountId}/lists`);
      setContactLists(res.data);
    } catch (err: any) {
      console.error("Erro ao buscar listas de contatos:", err);
      showAlert("Erro ao buscar listas de contatos.", "error");
    } finally {
      setLoadingLists(false);
    }
  };

  const handleViewListDetails = async (list: any) => {
    if (!selectedAccount) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/accounts/${selectedAccount.id}/lists/${list.id}`);
      setSelectedList(res.data);
    } catch (err: any) {
      showAlert("Erro ao buscar detalhes da lista.", "error");
    }
  };

  const handleDeleteContactList = async (listId: string, listName: string) => {
    if (!selectedAccount) return;
    if (!window.confirm(`Tem certeza que deseja excluir a lista "${listName}"? Isso excluirá todos os contatos vinculados a ela.`)) return;

    try {
      showAlert("Excluindo lista...");
      await axios.delete(`${API_BASE_URL}/accounts/${selectedAccount.id}/lists/${listId}`);
      showAlert("Lista excluída com sucesso!", "success");
      if (selectedList?.id === listId) {
        setSelectedList(null);
      }
      fetchContactLists(selectedAccount.id);
    } catch (err: any) {
      const details = err.response?.data?.error || err.message;
      showAlert(`Erro ao excluir lista: ${details}`, "error");
    }
  };

  const handleSaveTags = async () => {
    if (!selectedAccount || !tagModal) return;
    setSavingTags(true);
    try {
      await axios.patch(`${API_BASE_URL}/accounts/${selectedAccount.id}/lists/${tagModal.listId}/tags`, {
        tags: tagModalTags,
      });
      showAlert("Tags atualizadas!", "success");
      setTagModal(null);
      fetchContactLists(selectedAccount.id);
    } catch {
      showAlert("Erro ao salvar tags.", "error");
    } finally {
      setSavingTags(false);
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

          // Detectar formato DDI+DDD+NUMERO (ex: exportação do Sebrae/CRM)
          const ddiIdx = headers.findIndex(h => h === "ddi");
          const dddIdx = headers.findIndex(h => h === "ddd");
          const numeroIdx = headers.findIndex(h => h === "numero" || h === "número");
          const splitPhone = ddiIdx !== -1 && dddIdx !== -1 && numeroIdx !== -1;

          let phoneIdx = headers.findIndex(h =>
            h.includes("tel") || h.includes("phone") || h.includes("celular") || h.includes("contato") || h.includes("fone")
          );
          let nameIdx = headers.findIndex(h => h.includes("nome") || h.includes("name") || h.includes("cliente"));

          if (!splitPhone && phoneIdx === -1) {
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

            let phone = "";
            if (splitPhone) {
              const ddi = String(row[ddiIdx] || "").trim().replace(/\D/g, "");
              const ddd = String(row[dddIdx] || "").trim().replace(/\D/g, "");
              const numero = String(row[numeroIdx] || "").trim().replace(/\D/g, "");

              // Se NUMERO já contém o número completo (>=10 dígitos), ignorar DDI+DDD
              if (numero.length >= 10) {
                phone = numero.startsWith("55") ? numero : ddi + ddd + numero;
              } else {
                phone = ddi + ddd + numero;
              }
            } else {
              phone = String(row[phoneIdx] || "").trim().replace(/\D/g, "");
            }

            if (!phone || phone.length < 8) continue;

            // Normalizar 9º dígito para números brasileiros (55+DDD+8dígitos -> 55+DDD+9+8dígitos)
            if (phone.startsWith("55") && phone.length === 12) {
              phone = phone.slice(0, 4) + "9" + phone.slice(4);
            }

            // Descartar números com tamanho inválido (fora de 10-15 dígitos)
            if (phone.length < 10 || phone.length > 15) continue;

            const name = nameIdx !== -1 ? String(row[nameIdx] || "").trim() : "";

            const skipIdxs = new Set([phoneIdx, nameIdx, ddiIdx, dddIdx, numeroIdx].filter(x => x !== -1));
            const variables: string[] = [];
            row.forEach((cell, idx) => {
              if (!skipIdxs.has(idx) && cell !== undefined && cell !== null && String(cell).trim() !== "") {
                variables.push(String(cell).trim());
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
      showAlert("Lista de contatos criada com sucesso!", "success");
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
      showAlert("Lista de contatos atualizada com sucesso!", "success");
      
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

  useEffect(() => {
    if (selectedAccount) {
      fetchContactLists(selectedAccount.id);
    } else {
      setContactLists([]);
      setSelectedList(null);
    }
  }, [selectedAccount]);

  return (
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
                      alignItems: "flex-start",
                      gap: "12px"
                    }}
                  >
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ fontWeight: "600", fontSize: "1.1rem" }}>{list.name}</span>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        👤 {list._count?.contacts || 0} Contatos
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        Criado em: {new Date(list.createdAt).toLocaleDateString()}
                      </span>
                      {list.tags && list.tags.length > 0 && (
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "6px" }}>
                          {list.tags.map((tag: string) => (
                            <span key={tag} className="tag-chip">#{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTagModalTags(list.tags || []);
                          setTagInput("");
                          setTagModal({ listId: list.id, listName: list.name });
                        }}
                        className="btn btn-secondary"
                        style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                      >
                        🏷️ Tags
                      </button>
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
      {showNewListModal && (
        <ModalPortal>
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
                    style={{ flex: 1, padding: "8px 12px", fontSize: "0.85rem" }}
                  >
                    📄 Importar CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode("xlsx")}
                    className={`btn ${importMode === "xlsx" ? "btn-primary" : "btn-secondary"}`}
                    style={{ flex: 1, padding: "8px 12px", fontSize: "0.85rem" }}
                  >
                    📊 Importar Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode("manual")}
                    className={`btn ${importMode === "manual" ? "btn-primary" : "btn-secondary"}`}
                    style={{ flex: 1, padding: "8px 12px", fontSize: "0.85rem" }}
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
                            showAlert("Planilha CSV carregada com sucesso!", "success");
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
                        style={{ padding: "6px 12px", fontSize: "0.75rem" }}
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
                            <th style={{ padding: "8px 6px", fontWeight: "600" }}>Variáveis</th>
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
                                  required
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
                                >
                                  🗑️
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Footer Actions */}
                <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", borderTop: "1px solid var(--border-color)", paddingTop: "15px", marginTop: "10px" }}>
                  <button type="button" onClick={() => { setNewListName(""); setNewListRawContacts(""); setManualContacts([{ name: "", phone: "", variablesStr: "" }]); setXlsxContacts([]); setImportMode("csv"); setShowNewListModal(false); }} className="btn btn-secondary">Cancelar</button>
                  <button type="submit" disabled={loading} className="btn btn-primary" style={{ minWidth: "150px" }}>
                    {loading ? "Salvando..." : "Criar Lista"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal de Edição de Lista */}
      {showEditListModal && (
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
                    placeholder="Ex: Clientes VIP"
                    value={editListName}
                    onChange={(e) => setEditListName(e.target.value)}
                    style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none" }}
                    required
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>Editar Contatos</label>
                    <button
                      type="button"
                      onClick={() => setEditContacts([...editContacts, { name: "", phone: "", variablesStr: "" }])}
                      className="btn btn-secondary"
                      style={{ padding: "6px 12px", fontSize: "0.75rem" }}
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
                          <th style={{ padding: "8px 6px", fontWeight: "600" }}>Variáveis</th>
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

      {/* Modal de Edição de Tags */}
      {tagModal && (
        <ModalPortal>
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
            <div className="glass fade-in" style={{ width: "480px", maxWidth: "95vw", borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid var(--border-color)", background: "rgba(0,0,0,0.1)" }}>
                <h3 style={{ fontSize: "1.15rem", fontWeight: "700" }}>Tags — {tagModal.listName}</h3>
                <button type="button" onClick={() => setTagModal(null)} style={{ background: "none", border: "none", color: "#fff", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
              </div>

              <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    placeholder="Nova tag (Enter para adicionar)"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const trimmed = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
                        if (trimmed && !tagModalTags.includes(trimmed)) {
                          setTagModalTags([...tagModalTags, trimmed]);
                        }
                        setTagInput("");
                      }
                    }}
                    style={{ flex: 1, padding: "10px 12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none", fontSize: "0.9rem" }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
                      if (trimmed && !tagModalTags.includes(trimmed)) {
                        setTagModalTags([...tagModalTags, trimmed]);
                      }
                      setTagInput("");
                    }}
                    className="btn btn-secondary"
                    style={{ padding: "10px 16px", fontSize: "0.9rem" }}
                  >
                    + Add
                  </button>
                </div>

                <div style={{ minHeight: "60px", display: "flex", flexWrap: "wrap", gap: "8px", padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(0,0,0,0.15)", border: "1px solid var(--border-color)" }}>
                  {tagModalTags.length === 0 ? (
                    <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Nenhuma tag. Digite acima e pressione Enter.</span>
                  ) : (
                    tagModalTags.map((tag) => (
                      <span
                        key={tag}
                        onClick={() => setTagModalTags(tagModalTags.filter((t) => t !== tag))}
                        title="Clique para remover"
                        className="tag-chip tag-chip--interactive"
                      >
                        #{tag} <span style={{ opacity: 0.6, fontSize: "0.7rem" }}>✕</span>
                      </span>
                    ))
                  )}
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Clique em uma tag para removê-la. Pressione Enter para adicionar.</span>

                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", borderTop: "1px solid var(--border-color)", paddingTop: "14px" }}>
                  <button type="button" onClick={() => setTagModal(null)} className="btn btn-secondary">Cancelar</button>
                  <button type="button" onClick={handleSaveTags} disabled={savingTags} className="btn btn-primary" style={{ minWidth: "120px" }}>
                    {savingTags ? "Salvando..." : "Salvar Tags"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

    </div>
  );
}
