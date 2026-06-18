import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { useAuth, API_BASE_URL } from "../contexts/AuthContext";
import type { AuthUser } from "../contexts/AuthContext";

const OAUTH_ERRORS: Record<string, string> = {
  cancelled: "Login com Google cancelado.",
  invalid_state: "Sessão expirada. Tente novamente.",
  not_configured: "Login com Google não está configurado no servidor.",
  failed: "Erro ao autenticar com o Google. Tente novamente.",
};

export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setError("Token não encontrado.");
      setTimeout(() => navigate("/"), 3000);
      return;
    }

    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    axios
      .get<AuthUser>(`${API_BASE_URL}/auth/me`)
      .then((res) => {
        login(token, res.data);
        navigate("/");
      })
      .catch(() => {
        delete axios.defaults.headers.common["Authorization"];
        setError("Erro ao carregar dados do usuário. Tente novamente.");
        setTimeout(() => navigate("/"), 3000);
      });
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080808",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      gap: "16px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {error ? (
        <>
          <div style={{ color: "#f87171", fontSize: "1rem" }}>{error}</div>
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.8rem" }}>Redirecionando...</div>
        </>
      ) : (
        <>
          <div style={{
            width: "36px", height: "36px",
            border: "3px solid rgba(0,194,107,0.2)",
            borderTopColor: "#00c26b",
            borderRadius: "50%",
            animation: "spin 0.7s linear infinite",
          }} />
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem" }}>Finalizando login...</div>
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
