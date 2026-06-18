import { useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../contexts/AuthContext";

type Step = "form" | "success" | "invalid";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [step, setStep] = useState<Step>(token ? "form" : "invalid");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState<string | null>(null);
  const [cardTilt, setCardTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const dx = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const dy = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
    setCardTilt({ x: dy * -5, y: dx * 5 });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("As senhas não coincidem."); return; }
    if (password.length < 6) { setError("A senha deve ter no mínimo 6 caracteres."); return; }
    setLoading(true);
    setError("");
    try {
      await axios.post(`${API_BASE_URL}/auth/reset-password`, { token, password });
      setStep("success");
    } catch (err: any) {
      setError(err.response?.data?.error || "Erro ao redefinir senha. O link pode ter expirado.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (name: string): React.CSSProperties => ({
    padding: "12px 16px",
    backgroundColor: "rgba(255,255,255,0.03)",
    border: `1px solid ${focused === name ? "rgba(0,194,107,0.7)" : "rgba(255,255,255,0.07)"}`,
    borderRadius: "10px",
    color: "var(--text-primary, #e8eaed)",
    fontSize: "0.95rem",
    fontFamily: "inherit",
    outline: "none",
    width: "100%",
    boxShadow: focused === name ? "0 0 0 3px rgba(0,194,107,0.12)" : "none",
    transition: "all 0.2s",
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080808",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setCardTilt({ x: 0, y: 0 })}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "420px",
          margin: "20px",
          padding: "42px 36px",
          borderRadius: "20px",
          background: "rgba(14,14,16,0.88)",
          backdropFilter: "blur(20px) saturate(1.5)",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
          transform: `perspective(900px) rotateX(${cardTilt.x}deg) rotateY(${cardTilt.y}deg)`,
          transition: cardTilt.x === 0 ? "transform 0.7s cubic-bezier(0.34,1.56,0.64,1)" : "transform 0.05s ease",
        }}
      >
        {/* Top accent */}
        <div style={{
          position: "absolute", top: 0, left: "20%", right: "20%", height: "1px",
          background: "linear-gradient(90deg, transparent, rgba(0,194,107,0.5), transparent)",
        }} />

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ fontSize: "1.7rem", fontWeight: 800 }}>
            <span style={{ color: "#e8eaed" }}>Send</span>
            <span style={{
              background: "linear-gradient(135deg, #00c26b, #00e5a0 50%, #06b6d4)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginLeft: "4px",
            }}>Inteligentte</span>
          </div>
        </div>

        {step === "invalid" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🔗</div>
            <div style={{ color: "#f87171", fontWeight: 600, marginBottom: "8px" }}>Link inválido</div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.84rem", marginBottom: "20px" }}>
              Este link de redefinição é inválido ou expirou.
            </div>
            <button onClick={() => navigate("/")} style={btnStyle}>Voltar ao login</button>
          </div>
        )}

        {step === "success" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>✅</div>
            <div style={{ color: "#00c26b", fontWeight: 600, marginBottom: "8px" }}>Senha redefinida!</div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.84rem", marginBottom: "20px" }}>
              Sua nova senha foi salva. Faça login para continuar.
            </div>
            <button onClick={() => navigate("/")} style={btnStyle}>Ir para o login</button>
          </div>
        )}

        {step === "form" && (
          <>
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#e8eaed", marginBottom: "4px" }}>
                Nova senha
              </div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.84rem" }}>
                Escolha uma senha com no mínimo 6 caracteres.
              </div>
            </div>

            {error && (
              <div style={{
                background: "rgba(239,68,68,0.08)", color: "#f87171",
                border: "1px solid rgba(239,68,68,0.2)",
                padding: "11px 16px", borderRadius: "10px",
                fontSize: "0.85rem", marginBottom: "20px",
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={labelStyle}>Nova senha</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocused("password")}
                  onBlur={() => setFocused(null)}
                  style={inputStyle("password")}
                  required
                  autoFocus
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={labelStyle}>Confirmar senha</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onFocus={() => setFocused("confirm")}
                  onBlur={() => setFocused(null)}
                  style={inputStyle("confirm")}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{ ...btnStyle, marginTop: "8px", opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}
              >
                {loading ? "Salvando..." : "Salvar nova senha"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: "0.73rem",
  fontWeight: 600,
  color: "rgba(255,255,255,0.3)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const btnStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px",
  fontSize: "0.95rem",
  fontWeight: 600,
  fontFamily: "inherit",
  cursor: "pointer",
  border: "none",
  borderRadius: "10px",
  background: "linear-gradient(135deg, #00c26b 0%, #00a85c 100%)",
  color: "#fff",
  boxShadow: "0 4px 20px rgba(0,194,107,0.3)",
};
