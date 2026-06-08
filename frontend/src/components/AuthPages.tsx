import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

const getApiUrl = () => {
  if (window.location.hostname.endsWith("vercel.app")) {
    return "https://whatsapp-api-oficial-nls9.onrender.com";
  }
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && envUrl.startsWith("http")) {
    return envUrl.replace("/api", "");
  }
  return "https://whatsapp-api-oficial-nls9.onrender.com";
};
const BASE_API_URL = getApiUrl();

interface AuthPagesProps {
  onLoginSuccess: (token: string, user: { id: string; email: string; name: string | null }) => void;
}

// ─── Interactive Dot Grid Canvas ───────────────────────────────────────────────
function DotGridCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const DOT_SPACING = 28;   // gap between dots
    const DOT_RADIUS_BASE = 1.4;
    const SPOTLIGHT_RADIUS = 200;   // how far the mouse light reaches
    const SECONDARY_RADIUS = 380;   // outer soft glow ring

    let cols = 0, rows = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      cols = Math.ceil(canvas.width / DOT_SPACING) + 2;
      rows = Math.ceil(canvas.height / DOT_SPACING) + 2;
    };
    resize();
    window.addEventListener("resize", resize);

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseLeave = () => {
      // Smoothly move light off screen
      mouseRef.current = { x: -9999, y: -9999 };
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);

    const draw = () => {
      timeRef.current += 0.012;
      const t = timeRef.current;
      const w = canvas.width;
      const h = canvas.height;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      ctx.clearRect(0, 0, w, h);

      // Draw dot grid
      for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
          const x = col * DOT_SPACING;
          const y = row * DOT_SPACING;

          // Distance to mouse
          const dx = x - mx;
          const dy = y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Spotlight effect
          let brightness = 0;
          let radius = DOT_RADIUS_BASE;

          if (dist < SPOTLIGHT_RADIUS) {
            const t0 = 1 - dist / SPOTLIGHT_RADIUS;
            brightness = t0 * t0; // quadratic falloff — sharp center
            radius = DOT_RADIUS_BASE + brightness * 2.2;
          } else if (dist < SECONDARY_RADIUS) {
            const t1 = 1 - (dist - SPOTLIGHT_RADIUS) / (SECONDARY_RADIUS - SPOTLIGHT_RADIUS);
            brightness = t1 * 0.12;
            radius = DOT_RADIUS_BASE + brightness * 0.8;
          }

          // Subtle wave animation for dots far from mouse
          const wave = Math.sin(t * 1.2 + col * 0.18 + row * 0.22) * 0.5 + 0.5;
          const baseBrightness = 0.06 + wave * 0.03;
          const finalBrightness = Math.max(baseBrightness, brightness);

          // Color: interpolate from dim grey → vivid green based on brightness
          const r = Math.round(20 + finalBrightness * (0 - 20));
          const g = Math.round(20 + finalBrightness * (210 - 20));
          const b = Math.round(20 + finalBrightness * (110 - 20));
          const alpha = 0.15 + finalBrightness * 0.85;

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.fill();
        }
      }

      // Mouse radial glow overlay
      if (mx > -100) {
        // Inner hot spot
        const g1 = ctx.createRadialGradient(mx, my, 0, mx, my, SPOTLIGHT_RADIUS * 0.6);
        g1.addColorStop(0, "rgba(0, 210, 110, 0.06)");
        g1.addColorStop(1, "rgba(0, 210, 110, 0)");
        ctx.fillStyle = g1;
        ctx.fillRect(0, 0, w, h);

        // Outer ring
        const g2 = ctx.createRadialGradient(mx, my, SPOTLIGHT_RADIUS * 0.5, mx, my, SECONDARY_RADIUS);
        g2.addColorStop(0, "rgba(6,182,212,0.025)");
        g2.addColorStop(1, "rgba(6,182,212,0)");
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, w, h);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}

// ─── Auth Component ────────────────────────────────────────────────────────────
export default function AuthPages({ onLoginSuccess }: AuthPagesProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [cardTilt, setCardTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  // Card 3D tilt on mouse move
  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    setCardTilt({ x: dy * -6, y: dx * 6 });
  };

  const handleCardMouseLeave = () => setCardTilt({ x: 0, y: 0 });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const payload = isLogin ? { email, password } : { email, password, name };
      const response = await axios.post(`${BASE_API_URL}${endpoint}`, payload);
      
      if (response.data && typeof response.data === "object" && "token" in response.data) {
        const { token, user } = response.data;
        onLoginSuccess(token, user);
      } else {
        throw new Error("Resposta inválida do servidor. Verifique a URL do backend.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || err.message || "Ocorreu um erro. Verifique suas credenciais.");
    } finally {
      setLoading(false);
    }
  };

  const getInputStyle = (fieldName: string): React.CSSProperties => ({
    padding: "12px 16px",
    backgroundColor: "rgba(255,255,255,0.03)",
    border: `1px solid ${focusedField === fieldName ? "rgba(0,194,107,0.7)" : "rgba(255,255,255,0.07)"}`,
    borderRadius: "10px",
    color: "var(--text-primary)",
    fontSize: "0.95rem",
    fontFamily: "var(--font-sans)",
    outline: "none",
    transition: "all 0.2s ease",
    boxShadow: focusedField === fieldName ? "0 0 0 3px rgba(0,194,107,0.12), inset 0 1px 2px rgba(0,0,0,0.2)" : "inset 0 1px 2px rgba(0,0,0,0.15)",
    width: "100%",
  });

  return (
    <div style={{
      position: "relative",
      minHeight: "100vh",
      overflow: "hidden",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      // Pure black base like Antigravity
      background: "#080808",
    }}>

      {/* Dot grid canvas */}
      <DotGridCanvas />

      {/* Very subtle vignette */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 40%, rgba(0,0,0,0.7) 100%)",
      }} />

      {/* Login card */}
      <div
        ref={cardRef}
        onMouseMove={handleCardMouseMove}
        onMouseLeave={handleCardMouseLeave}
        style={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          maxWidth: "420px",
          margin: "20px",
          padding: "42px 36px",
          borderRadius: "20px",
          display: "flex",
          flexDirection: "column",
          // Frosted glass on dark bg
          background: "rgba(14,14,16,0.82)",
          backdropFilter: "blur(20px) saturate(1.5)",
          WebkitBackdropFilter: "blur(20px) saturate(1.5)",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: [
            "0 0 0 1px rgba(0,194,107,0.08)",
            "0 30px 80px rgba(0,0,0,0.6)",
            "inset 0 1px 0 rgba(255,255,255,0.06)",
          ].join(", "),
          transform: `perspective(900px) rotateX(${cardTilt.x}deg) rotateY(${cardTilt.y}deg)`,
          transition: cardTilt.x === 0
            ? "transform 0.7s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease"
            : "transform 0.05s ease",
          willChange: "transform",
        }}
      >
        {/* Spotlight that moves with card tilt */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: "20px",
          pointerEvents: "none", zIndex: 0, overflow: "hidden",
          background: `radial-gradient(circle at ${50 + cardTilt.y * 4}% ${50 + cardTilt.x * 4}%, rgba(0,194,107,0.06) 0%, transparent 60%)`,
        }} />

        {/* Top accent line */}
        <div style={{
          position: "absolute", top: 0, left: "20%", right: "20%", height: "1px",
          background: "linear-gradient(90deg, transparent, rgba(0,194,107,0.5), transparent)",
          borderRadius: "1px",
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: "30px" }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "2px",
              fontSize: "1.9rem",
              fontWeight: "800",
              letterSpacing: "-0.5px",
              marginBottom: "8px",
            }}>
              <span style={{ color: "#e8eaed" }}>Send</span>
              <span style={{
                background: "linear-gradient(135deg, #00c26b 0%, #00e5a0 50%, #06b6d4 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                marginLeft: "4px",
              }}>
                Inteligentte
              </span>
            </div>

            {/* Separator */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "10px" }}>
              <div style={{ height: "1px", width: "30px", background: "rgba(255,255,255,0.08)" }} />
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--primary)", boxShadow: "0 0 8px rgba(0,194,107,0.7)" }} />
              <div style={{ height: "1px", width: "30px", background: "rgba(255,255,255,0.08)" }} />
            </div>

            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.85rem", fontWeight: "400", letterSpacing: "0.01em" }}>
              {isLogin ? "Acesse seu painel de disparos" : "Crie sua conta para começar"}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: "rgba(239,68,68,0.08)",
              color: "#f87171",
              border: "1px solid rgba(239,68,68,0.2)",
              padding: "11px 16px",
              borderRadius: "10px",
              fontSize: "0.85rem",
              marginBottom: "20px",
              textAlign: "center",
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {!isLogin && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={labelStyle}>Nome Completo</label>
                <input
                  type="text"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setFocusedField("name")}
                  onBlur={() => setFocusedField(null)}
                  style={getInputStyle("name")}
                  required
                />
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={labelStyle}>E-mail</label>
              <input
                type="email"
                placeholder="seuemail@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
                style={getInputStyle("email")}
                required
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={labelStyle}>Senha</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
                style={getInputStyle("password")}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                marginTop: "8px",
                padding: "13px",
                fontSize: "0.95rem",
                fontWeight: "600",
                letterSpacing: "0.02em",
                fontFamily: "var(--font-sans)",
                cursor: loading ? "not-allowed" : "pointer",
                border: "none",
                borderRadius: "10px",
                background: loading
                  ? "rgba(0,194,107,0.4)"
                  : "linear-gradient(135deg, #00c26b 0%, #00a85c 100%)",
                color: "#fff",
                boxShadow: loading ? "none" : "0 4px 20px rgba(0,194,107,0.3), inset 0 1px 0 rgba(255,255,255,0.15)",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
              onMouseEnter={e => {
                if (!loading) {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 28px rgba(0,194,107,0.45), inset 0 1px 0 rgba(255,255,255,0.15)";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(0,194,107,0.3), inset 0 1px 0 rgba(255,255,255,0.15)";
                (e.currentTarget as HTMLButtonElement).style.transform = "";
              }}
            >
              {loading ? (
                <>
                  <span style={{
                    width: "15px", height: "15px",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.7s linear infinite",
                  }} />
                  Processando...
                </>
              ) : (
                isLogin ? "Entrar" : "Criar Conta"
              )}
            </button>
          </form>

          <div style={{ marginTop: "20px", textAlign: "center" }}>
            <button
              onClick={() => { setIsLogin(!isLogin); setError(""); }}
              style={{
                background: "none", border: "none",
                color: "rgba(255,255,255,0.3)", cursor: "pointer",
                fontSize: "0.85rem", fontFamily: "var(--font-sans)",
                transition: "color 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--primary)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
            >
              {isLogin ? "Não tem uma conta? Cadastre-se" : "Já tem uma conta? Faça login"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: "0.73rem",
  fontWeight: "600",
  color: "rgba(255,255,255,0.3)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};
