import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt =
  "Send Inteligentte — disparo de campanhas no WhatsApp pela API Oficial da Meta";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Satori exige display:flex explícito em toda div com mais de um filho —
 * não existe layout em bloco aqui.
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px 80px",
          background:
            "linear-gradient(135deg, #050608 0%, #0b1a14 55%, #05130d 100%)",
          color: "#f5f8fc",
          fontFamily: "sans-serif",
        }}
      >
        {/* Marca */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 42 }}>
          <div
            style={{
              display: "flex",
              width: 62,
              height: 62,
              borderRadius: 16,
              background: "#00d084",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              marginRight: 18,
            }}
          >
            ⚡
          </div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>
            <span>Send&nbsp;</span>
            <span style={{ color: "#00d084" }}>Inteligentte</span>
          </div>
        </div>

        {/* Título */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            fontSize: 62,
            fontWeight: 800,
            lineHeight: 1.15,
            maxWidth: 940,
          }}
        >
          <span>Dispare campanhas no WhatsApp&nbsp;</span>
          <span style={{ color: "#00d084" }}>sem arriscar o seu número</span>
        </div>

        {/* Subtítulo */}
        <div
          style={{
            display: "flex",
            fontSize: 27,
            color: "#cbd5e1",
            marginTop: 30,
            maxWidth: 900,
          }}
        >
          API Oficial da Meta • Templates homologados • Opt-out automático (LGPD)
        </div>

        {/* Chips */}
        <div style={{ display: "flex", marginTop: 46 }}>
          {["Meta Cloud API v19", "Links rastreáveis", "n8n & Webhooks"].map(
            (chip) => (
              <div
                key={chip}
                style={{
                  display: "flex",
                  padding: "11px 22px",
                  marginRight: 14,
                  borderRadius: 999,
                  border: "1px solid rgba(0,208,132,0.35)",
                  background: "rgba(0,208,132,0.1)",
                  color: "#00d084",
                  fontSize: 21,
                  fontWeight: 600,
                }}
              >
                {chip}
              </div>
            )
          )}
        </div>
      </div>
    ),
    size
  );
}
