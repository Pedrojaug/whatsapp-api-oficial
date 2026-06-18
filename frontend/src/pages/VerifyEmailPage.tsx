import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../contexts/AuthContext";

type Status = "loading" | "success" | "error";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Link inválido.");
      return;
    }
    axios
      .get(`${API_BASE_URL}/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(() => {
        setStatus("success");
        setMessage("E-mail verificado com sucesso!");
        setTimeout(() => navigate("/"), 3000);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.response?.data?.error || "Link inválido ou expirado.");
      });
  }, []);

  const icon = status === "loading" ? (
    <div style={{
      width: "48px", height: "48px",
      border: "3px solid rgba(0,194,107,0.2)",
      borderTopColor: "#00c26b",
      borderRadius: "50%",
      animation: "spin 0.7s linear infinite",
    }} />
  ) : status === "success" ? (
    <div style={{ fontSize: "3rem" }}>✅</div>
  ) : (
    <div style={{ fontSize: "3rem" }}>❌</div>
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080808",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        maxWidth: "400px",
        width: "100%",
        margin: "20px",
        padding: "40px 36px",
        background: "rgba(14,14,16,0.9)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "20px",
        backdropFilter: "blur(20px)",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "16px",
      }}>
        {icon}
        <div>
          <div style={{
            fontSize: "1.1rem",
            fontWeight: 600,
            color: status === "success" ? "#00c26b" : status === "error" ? "#f87171" : "rgba(255,255,255,0.8)",
            marginBottom: "6px",
          }}>
            {status === "loading" ? "Verificando e-mail..." : message}
          </div>
          {status === "success" && (
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.83rem" }}>
              Redirecionando para o painel...
            </div>
          )}
          {status === "error" && (
            <button
              onClick={() => navigate("/")}
              style={{
                marginTop: "12px",
                padding: "10px 20px",
                background: "linear-gradient(135deg, #00c26b, #00a85c)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "0.88rem",
                fontWeight: 600,
              }}
            >
              Ir para o login
            </button>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
