import React, { useState } from "react";
import axios from "axios";

interface AuthPagesProps {
  onLoginSuccess: (token: string, user: { id: string; email: string; name: string | null }) => void;
}

export default function AuthPages({ onLoginSuccess }: AuthPagesProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const payload = isLogin ? { email, password } : { email, password, name };
      
      const response = await axios.post(`http://localhost:3001${endpoint}`, payload);
      
      const { token, user } = response.data;
      onLoginSuccess(token, user);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || "Ocorreu um erro. Verifique suas credenciais.");
    } finally {
      setLoading(false);
    }
  };

  const getInputStyle = (fieldName: string) => ({
    ...styles.input,
    borderColor: focusedField === fieldName ? "var(--primary)" : "var(--border-color)",
    boxShadow: focusedField === fieldName ? "0 0 0 3px var(--primary-glow)" : "none",
  });

  return (
    <div style={styles.container}>
      <div className="glass fade-in" style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logoContainer}>
            <span style={styles.logoText}>Send</span>
            <span style={styles.logoSubtext}>Inteligentte</span>
          </div>
          <p style={styles.tagline}>
            {isLogin
              ? "Entre no seu painel de disparos oficial"
              : "Crie sua conta para começar a disparar"}
          </p>
        </div>

        {error && <div style={styles.errorAlert}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          {!isLogin && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>Nome Completo</label>
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

          <div style={styles.inputGroup}>
            <label style={styles.label}>E-mail</label>
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

          <div style={styles.inputGroup}>
            <label style={styles.label}>Senha</label>
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
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "10px", padding: "12px" }}
            disabled={loading}
          >
            {loading ? "Processando..." : isLogin ? "Entrar" : "Criar Conta"}
          </button>
        </form>

        <div style={styles.footer}>
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
            }}
            style={styles.switchButton}
          >
            {isLogin
              ? "Não tem uma conta? Cadastre-se"
              : "Já tem uma conta? Faça login"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    width: "100%",
    padding: "20px",
  },
  card: {
    width: "100%",
    maxWidth: "420px",
    padding: "40px 30px",
    borderRadius: "24px",
    display: "flex",
    flexDirection: "column" as const,
  },
  header: {
    textAlign: "center" as const,
    marginBottom: "30px",
  },
  logoContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "6px",
    fontSize: "2.2rem",
    fontWeight: "700",
    marginBottom: "8px",
  },
  logoText: {
    color: "#ffffff",
  },
  logoSubtext: {
    color: "var(--primary)",
  },
  tagline: {
    color: "var(--text-secondary)",
    fontSize: "0.95rem",
  },
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "20px",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  },
  label: {
    fontSize: "0.8rem",
    fontWeight: "600",
    color: "var(--text-secondary)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  input: {
    padding: "12px 16px",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    border: "1px solid var(--border-color)",
    borderRadius: "12px",
    color: "var(--text-primary)",
    fontSize: "0.95rem",
    fontFamily: "var(--font-sans)",
    outline: "none",
    transition: "all var(--transition-fast)",
  },
  errorAlert: {
    backgroundColor: "var(--error-glow)",
    color: "var(--error)",
    border: "1px solid rgba(239, 68, 68, 0.2)",
    padding: "12px 16px",
    borderRadius: "12px",
    fontSize: "0.9rem",
    marginBottom: "20px",
    textAlign: "center" as const,
  },
  footer: {
    marginTop: "24px",
    textAlign: "center" as const,
  },
  switchButton: {
    background: "none",
    border: "none",
    color: "var(--primary)",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: "500",
    fontFamily: "var(--font-sans)",
    transition: "color var(--transition-fast)",
  },
};
