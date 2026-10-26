import React, { useState, useEffect } from "react";
import axios from "axios";
import type { AuthUser } from "../contexts/AuthContext";
import { BrandIcon } from "./Brand";
import LoginChatDemo from "./LoginChatDemo";

const getApiUrl = () => {
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    const envUrl = import.meta.env.VITE_API_BASE_URL;
    if (envUrl && envUrl.startsWith("http")) {
      return envUrl.replace("/api", "");
    }
    return "http://localhost:3001";
  }
  return "https://whatsapp-api-oficial-nls9.onrender.com";
};
const BASE_API_URL = getApiUrl();

interface AuthPagesProps {
  onLoginSuccess: (token: string, user: AuthUser) => void;
}

// ─── Google Icon SVG ───────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M17.64 9.2045C17.64 8.5663 17.5827 7.9527 17.4764 7.3636H9V10.845H13.8436C13.635 11.97 13.0009 12.9231 12.0477 13.5613V15.8195H14.9564C16.6582 14.2527 17.64 11.9454 17.64 9.2045Z" fill="#4285F4"/>
      <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5613C11.2418 14.1013 10.2109 14.4204 9 14.4204C6.65591 14.4204 4.67182 12.8372 3.96409 10.71H0.957275V13.0418C2.43818 15.9831 5.48182 18 9 18Z" fill="#34A853"/>
      <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.5931 3.68182 9C3.68182 8.4069 3.78409 7.83 3.96409 7.29V4.9582H0.957275C0.347727 6.1731 0 7.5477 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
      <path d="M9 3.5795C10.3214 3.5795 11.5077 4.0336 12.4405 4.9254L15.0218 2.344C13.4632 0.891817 11.4259 0 9 0C5.48182 0 2.43818 2.01681 0.957275 4.9582L3.96409 7.29C4.67182 5.1627 6.65591 3.5795 9 3.5795Z" fill="#EA4335"/>
    </svg>
  );
}

// ─── Painel de produto (lado direito, só desktop) ─────────────────────────────
// Conversa simulada com loja e cliente fictícias: mostra o que um disparo gera.
function ProductShowcase() {
  return (
    <aside className="auth-showcase" aria-hidden="true">
      <div className="auth-showcase-inner">
        <p className="auth-showcase-eyebrow">Simulação de disparo</p>
        <h2 className="auth-showcase-title">Cada disparo vira uma conversa.</h2>
        <LoginChatDemo />
      </div>
    </aside>
  );
}

// ─── Auth Component ────────────────────────────────────────────────────────────
type AuthMode = "login" | "forgot";

// Erro devolvido pelo callback do OAuth em ?oauth_error=…
function readOAuthError(): string {
  const oauthError = new URLSearchParams(window.location.search).get("oauth_error");
  if (!oauthError) return "";
  const msgs: Record<string, string> = {
    cancelled: "Login com Google cancelado.",
    invalid_state: "Sessão expirada. Tente o login novamente.",
    not_configured: "Login com Google não está disponível no momento.",
    failed: "Erro ao autenticar com o Google. Tente novamente.",
    registration_disabled: "O registro público está desativado. Contate o administrador.",
  };
  return msgs[oauthError] || "Erro no login com Google.";
}

function apiErrorMessage(err: unknown): string | undefined {
  return axios.isAxiosError<{ error?: string }>(err) ? err.response?.data?.error : undefined;
}

export default function AuthPages({ onLoginSuccess }: AuthPagesProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(readOAuthError);
  const [forgotSent, setForgotSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Limpa o ?oauth_error da URL depois de ler a mensagem
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("oauth_error")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Forgot password flow
    if (mode === "forgot") {
      try {
        await axios.post(`${BASE_API_URL}/api/auth/forgot-password`, { email });
        setForgotSent(true);
      } catch (err) {
        setError(apiErrorMessage(err) || "Erro ao enviar e-mail.");
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const response = await axios.post(`${BASE_API_URL}/api/auth/login`, { email, password });

      if (response.data && typeof response.data === "object" && "token" in response.data) {
        const { token, user } = response.data;
        onLoginSuccess(token, user);
      } else {
        throw new Error("Resposta inválida do servidor. Verifique a URL do backend.");
      }
    } catch (err) {
      console.error(err);
      setError(
        apiErrorMessage(err) ||
        (err instanceof Error ? err.message : "") ||
        "Ocorreu um erro. Verifique suas credenciais."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${BASE_API_URL}/api/auth/google`;
  };

  const backToLogin = () => {
    setMode("login");
    setForgotSent(false);
    setError("");
  };

  return (
    // .auth-screen redefine os tokens de cor no próprio escopo: o login fica sempre escuro,
    // mesmo com body.light-theme ativo de uma sessão anterior.
    <div className="auth-screen">
      <main className="auth-form-panel">
        <div className="auth-brand">
          <BrandIcon size={32} color="#25d366" />
          <span className="brand-logo" style={{ fontSize: "1.25rem" }}>
            <span>Send</span> <strong>Inteligentte</strong>
          </span>
        </div>

        <div className="auth-form-body">
          <h1 className="auth-title">{mode === "login" ? "Bem-vindo de volta" : "Redefinir senha"}</h1>
          <p className="auth-subtitle">
            {mode === "login"
              ? "Entre para acompanhar suas campanhas."
              : "Informe seu e-mail e enviaremos um link para criar uma nova senha."}
          </p>

          {error && <div className="auth-error" role="alert">{error}</div>}

          {/* ── Forgot password: success state ── */}
          {mode === "forgot" && forgotSent ? (
            <div className="auth-sent">
              <div className="auth-sent-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 7l9 6 9-6" />
                </svg>
              </div>
              <p className="auth-sent-title">E-mail enviado</p>
              <p className="auth-sent-text">Se este e-mail estiver cadastrado, você receberá um link de redefinição em breve.</p>
              <button type="button" className="auth-link" onClick={backToLogin}>← Voltar ao login</button>
            </div>
          ) : (
            <>
              {/* ── Google primeiro: é o caminho mais rápido para quem já tem conta ── */}
              {mode === "login" && (
                <>
                  <button type="button" className="auth-google" onClick={handleGoogleLogin}>
                    <GoogleIcon />
                    Continuar com Google
                  </button>
                  <div className="auth-divider"><span>ou com e-mail</span></div>
                </>
              )}

              <form onSubmit={handleSubmit} className="auth-form">
                <div className="auth-field">
                  <label htmlFor="auth-email" className="auth-label">E-mail</label>
                  <input
                    id="auth-email"
                    className="auth-input"
                    type="email"
                    autoComplete="email"
                    placeholder="seuemail@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                {mode === "login" && (
                  <div className="auth-field">
                    <div className="auth-label-row">
                      <label htmlFor="auth-password" className="auth-label">Senha</label>
                      <button type="button" className="auth-link" onClick={() => { setMode("forgot"); setError(""); }}>
                        Esqueci a senha
                      </button>
                    </div>
                    <div className="auth-password-wrap">
                      <input
                        id="auth-password"
                        className="auth-input"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{ paddingRight: "46px" }}
                        required
                      />
                      <button
                        type="button"
                        className="auth-eye"
                        onClick={() => setShowPassword(v => !v)}
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        aria-pressed={showPassword}
                      >
                        {showPassword ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <button type="submit" className="auth-submit" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="auth-spinner" aria-hidden="true" />
                      {mode === "login" ? "Entrando…" : "Enviando…"}
                    </>
                  ) : (
                    mode === "login" ? "Entrar" : "Enviar link de redefinição"
                  )}
                </button>
              </form>

              {mode === "forgot" && (
                <button type="button" className="auth-link auth-back" onClick={backToLogin}>← Voltar ao login</button>
              )}
            </>
          )}
        </div>

        <p className="auth-trust">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          Integração com a API oficial do WhatsApp Business
        </p>
      </main>

      <ProductShowcase />
    </div>
  );
}
