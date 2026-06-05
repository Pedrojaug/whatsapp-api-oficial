interface Button {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;
  url?: string;
  phoneNumber?: string;
}

interface PhoneSimulatorProps {
  headerFormat?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE";
  headerText?: string;
  mediaUrl?: string;
  bodyText: string;
  variables?: string[];
  footerText?: string;
  buttons?: Button[];
}

export default function PhoneSimulator({
  headerFormat = "NONE",
  headerText = "",
  mediaUrl = "",
  bodyText = "",
  variables = [],
  footerText = "",
  buttons = [],
}: PhoneSimulatorProps) {
  // Substituir variáveis {{1}}, {{2}}, etc. pelos valores fornecidos
  const renderFormattedBody = () => {
    if (!bodyText) return "Escreva o corpo da mensagem...";
    let text = bodyText;
    variables.forEach((val, idx) => {
      const placeholder = `{{${idx + 1}}}`;
      text = text.split(placeholder).join(val || placeholder);
    });
    return text;
  };

  const getDocFilename = (url: string) => {
    if (!url) return "documento.pdf";
    try {
      return url.split("/").pop() || "documento.pdf";
    } catch {
      return "documento.pdf";
    }
  };

  return (
    <div
      style={{
        width: "320px",
        height: "580px",
        borderRadius: "36px",
        border: "12px solid #1f2937",
        background: "#0b141a", // WhatsApp dark mode background
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.4), var(--shadow-glow)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        fontFamily: "sans-serif",
      }}
    >
      {/* Top Phone Bar */}
      <div style={{ height: "24px", background: "#1f2c34", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 24px", fontSize: "0.75rem", color: "#b1b3b5" }}>
        <span>14:25</span>
        <div style={{ display: "flex", gap: "4px" }}>
          <span>📶</span>
          <span>🔋 100%</span>
        </div>
      </div>

      {/* WhatsApp Header */}
      <header style={{ background: "#1f2c34", padding: "10px 16px", display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>
        <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: "var(--primary, #00c26b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", color: "#fff", fontWeight: "bold" }}>
          W
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <span style={{ fontSize: "0.9rem", fontWeight: "600", color: "#e9edef" }}>WhatsApp Oficial</span>
          <span style={{ fontSize: "0.7rem", color: "#8696a0" }}>Online / Conta Comercial</span>
        </div>
        <span style={{ color: "#aebac1", fontSize: "1.1rem", cursor: "pointer" }}>⋮</span>
      </header>

      {/* Chat Background Wall */}
      <div
        style={{
          flex: 1,
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          overflowY: "auto",
          background: "radial-gradient(circle, #0b141a 60%, #0d1a21 100%)", // Mock WhatsApp dark wallpaper
        }}
      >
        {/* Date bubble */}
        <div style={{ margin: "0 auto 16px auto", padding: "4px 12px", background: "#182229", borderRadius: "8px", fontSize: "0.65rem", color: "#8696a0", textTransform: "uppercase", fontWeight: "500" }}>
          Hoje
        </div>

        {/* Message Bubble Container */}
        <div style={{ display: "flex", flexDirection: "column", width: "100%", maxWidth: "85%", alignSelf: "flex-start", gap: "4px" }}>
          
          {/* Main green bubble */}
          <div
            style={{
              background: "#005c4b", // WhatsApp dark mode sent bubble
              color: "#e9edef",
              borderRadius: "0 12px 12px 12px",
              padding: "10px",
              boxShadow: "0 1px 0.5px rgba(0,0,0,0.13)",
              fontSize: "0.85rem",
              lineHeight: "1.3",
              position: "relative",
            }}
          >
            {/* Media Header */}
            {headerFormat === "IMAGE" && (
              <div style={{ width: "100%", height: "130px", borderRadius: "8px", background: "#111b21", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)" }}>
                {mediaUrl ? (
                  <img src={mediaUrl} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ color: "#8696a0", fontSize: "2rem" }}>🖼️</span>
                )}
              </div>
            )}

            {headerFormat === "VIDEO" && (
              <div style={{ width: "100%", height: "130px", borderRadius: "8px", background: "#111b21", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                <span style={{ color: "#8696a0", fontSize: "2.5rem" }}>📹</span>
                <div style={{ position: "absolute", width: "38px", height: "38px", borderRadius: "50%", background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "0.9rem" }}>▶</div>
              </div>
            )}

            {headerFormat === "DOCUMENT" && (
              <div style={{ width: "100%", background: "#111b21", borderRadius: "8px", padding: "10px", marginBottom: "8px", display: "flex", alignItems: "center", gap: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ fontSize: "1.8rem" }}>📄</span>
                <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", flex: 1 }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "#e9edef", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                    {getDocFilename(mediaUrl)}
                  </span>
                  <span style={{ fontSize: "0.65rem", color: "#8696a0" }}>PDF • 142 KB</span>
                </div>
              </div>
            )}

            {/* Text Header */}
            {headerFormat === "TEXT" && headerText && (
              <div style={{ fontWeight: "700", color: "#fff", marginBottom: "6px", fontSize: "0.9rem" }}>
                {headerText}
              </div>
            )}

            {/* Body Text */}
            <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {renderFormattedBody()}
            </div>

            {/* Footer Text */}
            {footerText && (
              <div style={{ color: "#8696a0", fontSize: "0.7rem", marginTop: "6px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "4px" }}>
                {footerText}
              </div>
            )}

            {/* Time Stamp & Double Checkmarks */}
            <div style={{ display: "flex", justifySelf: "flex-end", alignItems: "center", gap: "3px", fontSize: "0.6rem", color: "#8696a0", marginTop: "4px", float: "right" }}>
              <span>14:25</span>
              <span style={{ color: "#53bdeb" }}>✓✓</span>
            </div>
            <div style={{ clear: "both" }}></div>
          </div>

          {/* Action Buttons Below Bubble */}
          {buttons.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
              {buttons.map((btn, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "#1f2c34", // Button background in dark mode
                    borderRadius: "10px",
                    padding: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    color: "#00a884", // WhatsApp brand active green color
                    fontSize: "0.8rem",
                    fontWeight: "600",
                    textAlign: "center",
                    boxShadow: "0 1px 1px rgba(0,0,0,0.15)",
                    cursor: "pointer",
                    border: "1px solid rgba(255,255,255,0.02)",
                  }}
                >
                  {btn.type === "URL" && <span>🌐</span>}
                  {btn.type === "PHONE_NUMBER" && <span>📞</span>}
                  {btn.type === "QUICK_REPLY" && <span>↩️</span>}
                  {btn.text || "Botão"}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
