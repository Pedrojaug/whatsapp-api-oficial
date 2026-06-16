import { useState, useEffect } from "react";
import axios from "axios";
import { useAccount } from "../contexts/AccountContext";
import { useAlert } from "../contexts/AlertContext";
import { useAuth, API_BASE_URL } from "../contexts/AuthContext";

export default function MediaPage() {
  const { token } = useAuth();
  const { selectedAccount } = useAccount();
  const { showAlert } = useAlert();

  const [mediaAssets, setMediaAssets] = useState<any[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<"all" | "image" | "video" | "document">("all");

  const fetchMedia = async (accountId: string) => {
    setLoadingMedia(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/accounts/${accountId}/media`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      setMediaAssets(res.data);
    } catch (err: any) {
      console.error("Erro ao buscar mídias:", err);
      showAlert("Erro ao buscar mídias: " + (err.response?.data?.error || err.message), "error");
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
          showAlert("Mídia enviada com sucesso! ✅", "success");
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
      showAlert("Mídia excluída com sucesso!", "success");
      fetchMedia(selectedAccount.id);
    } catch (err: any) {
      showAlert(err.response?.data?.error || "Erro ao excluir mídia.", "error");
    } finally {
      setLoadingMedia(false);
    }
  };

  useEffect(() => {
    if (selectedAccount) {
      fetchMedia(selectedAccount.id);
    } else {
      setMediaAssets([]);
    }
  }, [selectedAccount]);

  const filteredAssets = mediaAssets.filter((a: any) => {
    if (mediaFilter === "all") return true;
    if (mediaFilter === "image") return a.mimeType?.startsWith("image/");
    if (mediaFilter === "video") return a.mimeType?.startsWith("video/");
    return a.mimeType === "application/pdf";
  });

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px" }}>
        <div>
          <h1 className="page-heading">🖼️ Galeria de Mídias</h1>
          <p className="page-subheading">Faça upload de imagens, vídeos e documentos para utilizar em suas mensagens e templates</p>
        </div>

        {selectedAccount && (
          <label className="btn btn-primary" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <span>➕ Enviar Nova Mídia</span>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadMedia(file);
                e.target.value = "";
              }}
              style={{ display: "none" }}
            />
          </label>
        )}
      </div>

      {!selectedAccount ? (
        <div className="glass" style={{ padding: "40px", textAlign: "center", borderRadius: "var(--radius-xl)" }}>
          <p style={{ color: "var(--text-muted)" }}>Selecione ou cadastre uma conta Meta API para gerenciar mídias.</p>
        </div>
      ) : (
        <div className="glass" style={{ padding: "30px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Header filter options */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px", borderBottom: "1px solid var(--border-color)", paddingBottom: "15px" }}>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {(["all", "image", "video", "document"] as const).map((f) => {
                const labels: Record<string, string> = {
                  all: "🗂️ Todos os Arquivos",
                  image: "🖼️ Imagens",
                  video: "🎬 Vídeos",
                  document: "📄 Documentos"
                };
                return (
                  <button
                    key={f}
                    type="button"
                    className={`btn ${mediaFilter === f ? "btn-primary" : "btn-secondary"}`}
                    style={{ padding: "6px 14px", fontSize: "0.82rem" }}
                    onClick={() => setMediaFilter(f)}
                  >
                    {labels[f]}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => fetchMedia(selectedAccount.id)}
              className="btn btn-secondary"
              style={{ padding: "8px 14px", fontSize: "0.82rem" }}
            >
              🔄 Atualizar Galeria
            </button>
          </div>

          {loadingMedia ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "20px" }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="skeleton" style={{ width: "100%", height: "230px", borderRadius: "var(--radius-md)" }} />
              ))}
            </div>
          ) : mediaAssets.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "3rem" }}>🎞️</span>
              <span>Nenhum arquivo enviado para este canal comercial ainda.</span>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
              Nenhum arquivo deste tipo encontrado na galeria.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "20px" }}>
              {filteredAssets.map((asset: any) => {
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
                            showAlert("Link copiado! 🔗", "success");
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
          )}
        </div>
      )}
    </div>
  );
}
