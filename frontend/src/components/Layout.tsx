import { useState, useEffect, useRef } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { gsap } from "gsap";
import { EASE, DUR } from "../utils/motion";
import { useAuth, API_BASE_URL } from "../contexts/AuthContext";
import { useAccount } from "../contexts/AccountContext";
import AuthPages from "./AuthPages";
import {
  BarChart3,
  MessageSquare,
  FileText,
  Users,
  Send,
  Image as ImageIcon,
  Settings2,
  Wrench,
  LogOut,
  Sun,
  Moon,
  ShieldOff,
  Link2,
  Megaphone,
  KeyRound
} from "lucide-react";

const SUPPORT_WHATSAPP = "5583920017106";
const SUPPORT_WHATSAPP_URL = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent("Olá! Preciso de suporte com o Send Inteligentte.")}`;

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.554 4.122 1.523 5.855L.057 23.882a.5.5 0 0 0 .613.612l6.101-1.457A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.808 9.808 0 0 1-5.034-1.387l-.36-.214-3.733.892.937-3.63-.235-.374A9.818 9.818 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
    </svg>
  );
}

export default function Layout() {
  const { token, user, isImpersonating, impersonatorName, login, logout, stopImpersonating } = useAuth();
  const { accounts, selectedAccount, selectAccount } = useAccount();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // Theme state — default dark, persisted in localStorage
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(
    localStorage.getItem("theme") !== "light"
  );

  useEffect(() => {
    if (isDarkTheme) {
      document.body.classList.remove("light-theme");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.add("light-theme");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkTheme]);

  // Sincronização de status das mensagens em tempo real (SSE) com reconexão automática robusta
  useEffect(() => {
    if (!selectedAccount || !token) return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;
      const sseUrl = `${API_BASE_URL.replace("/api", "")}/api/accounts/${selectedAccount.id}/messages/events?token=${encodeURIComponent(token)}`;
      eventSource = new EventSource(sseUrl);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "connected") {
            // SSE conectou (ou reconectou) — dispara evento para páginas recarregarem dados
            window.dispatchEvent(new CustomEvent("sseConnected"));
          } else if (data.type === "messageUpdated") {
            // Dispara evento customizado para que qualquer página possa escutar
            window.dispatchEvent(new CustomEvent("messageUpdated", { detail: data }));
          }
        } catch (err) {
          console.error("Erro ao processar atualização em tempo real:", err);
        }
      };

      eventSource.onerror = () => {
        // Fecha a conexão com erro e reconecta manualmente após 3 segundos
        eventSource?.close();
        eventSource = null;
        if (isMounted) {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      eventSource?.close();
    };
  }, [selectedAccount, token]);

  // Stagger-reveal glass cards on every route change (with subtle scale)
  useEffect(() => {
    if (!mainRef.current) return;
    const cards = mainRef.current.querySelectorAll<HTMLElement>(".glass");
    if (!cards.length) return;
    gsap.fromTo(
      cards,
      { opacity: 0, y: 28, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: DUR.base, ease: EASE, stagger: 0.07, clearProps: "transform" }
    );
  }, [location.pathname]);

  if (!token) {
    return <AuthPages onLoginSuccess={login} />;
  }

  // ── Trial logic ──────────────────────────────────────────────────────────────
  const TRIAL_DAYS = 3;
  const isPaid      = user?.planTier === "paid";
  const isSuperUser = user?.role === "SUPERUSER";
  const createdAt   = user?.createdAt ? new Date(user.createdAt) : null;
  const daysSince   = createdAt ? Math.floor((Date.now() - createdAt.getTime()) / 86_400_000) : 0;
  const daysLeft    = Math.max(0, TRIAL_DAYS - daysSince);
  const trialExpired  = !isPaid && !isSuperUser && daysSince >= TRIAL_DAYS;
  const showTrialBanner = !isPaid && !isSuperUser && !trialExpired;

  const handleAccountChange = (accountId: string) => {
    const acc = accounts.find((a) => a.id === accountId);
    selectAccount(acc || null);
  };

  const closeSidebar = () => setIsSidebarOpen(false);

  const PAYMENT_WA = `https://wa.me/5583920017106?text=${encodeURIComponent("Olá! Quero assinar o Send Inteligentte. Meu e-mail é: " + (user?.email || ""))}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", position: "relative" }}>
      {/* Background Ambient Glows */}
      <div className="ambient-glow-1"></div>
      <div className="ambient-glow-2"></div>

      {/* ── Trial expired paywall ── */}
      {trialExpired && !isImpersonating && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10000,
          background: "rgba(5,7,15,0.92)",
          backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "24px",
        }}>
          <div className="glass" style={{
            maxWidth: "460px", width: "100%",
            padding: "40px 36px", borderRadius: "var(--radius-xl)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: "20px", textAlign: "center",
          }}>
            <div style={{
              width: "60px", height: "60px", borderRadius: "50%",
              background: "rgba(251,191,36,0.1)",
              border: "1.5px solid rgba(251,191,36,0.35)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.7rem",
            }}>⏰</div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-primary)" }}>
                Seu período de teste encerrou
              </h2>
              <p style={{ fontSize: "0.92rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                Seus <strong>3 dias gratuitos</strong> expiraram há {daysSince - TRIAL_DAYS} dia{daysSince - TRIAL_DAYS !== 1 ? "s" : ""}.
                Para continuar enviando mensagens pelo Send Inteligentte, ative seu plano.
              </p>
            </div>

            <a
              href={PAYMENT_WA}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ width: "100%", textAlign: "center", textDecoration: "none", fontSize: "0.95rem", padding: "14px" }}
            >
              Assinar agora via WhatsApp
            </a>

            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
              Após a confirmação do pagamento, seu acesso é reativado em até 24h.<br />
              Dúvidas? Fale com a equipe Inteligentte.
            </p>

            <button
              onClick={logout}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text-muted)", fontSize: "0.8rem", textDecoration: "underline",
              }}
            >
              Sair da conta
            </button>
          </div>
        </div>
      )}

      {/* ── Email verification banner ── */}
      {user && !user.emailVerified && !isImpersonating && user.role !== "SUPERUSER" && (
        <div style={{
          background: "linear-gradient(90deg, rgba(251,191,36,0.12), rgba(251,191,36,0.06))",
          borderBottom: "1px solid rgba(251,191,36,0.25)",
          padding: "9px 24px",
          fontSize: "0.83rem",
          color: "#fbbf24",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          zIndex: 1001,
        }}>
          <span>⚠️</span>
          <span>Confirme seu e-mail para garantir o acesso à sua conta. Verifique a caixa de entrada de <strong>{user.email}</strong>.</span>
        </div>
      )}

      {/* ── Trial countdown banner ── */}
      {showTrialBanner && !isImpersonating && (
        <div style={{
          background: "linear-gradient(90deg, rgba(251,191,36,0.1), rgba(251,191,36,0.04))",
          borderBottom: "1px solid rgba(251,191,36,0.22)",
          padding: "9px 24px",
          fontSize: "0.83rem",
          color: "#fbbf24",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          zIndex: 1001,
          flexWrap: "wrap",
        }}>
          <span>
            ⏳ <strong>{daysLeft} dia{daysLeft !== 1 ? "s" : ""} restante{daysLeft !== 1 ? "s" : ""}</strong> no seu período de teste gratuito.
          </span>
          <a
            href={PAYMENT_WA}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: "rgba(251,191,36,0.15)",
              border: "1px solid rgba(251,191,36,0.35)",
              color: "#fbbf24",
              padding: "5px 14px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.8rem",
              fontWeight: 600,
              fontFamily: "inherit",
              whiteSpace: "nowrap",
              textDecoration: "none",
            }}
          >
            Assinar agora →
          </a>
        </div>
      )}

      {/* ── Onboarding banner (new user, no accounts yet) ── */}
      {user && accounts.length === 0 && !isImpersonating && (
        <div style={{
          background: "linear-gradient(90deg, rgba(0,194,107,0.1), rgba(0,194,107,0.04))",
          borderBottom: "1px solid rgba(0,194,107,0.2)",
          padding: "9px 24px",
          fontSize: "0.83rem",
          color: "#00c26b",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          zIndex: 1001,
          flexWrap: "wrap",
        }}>
          <span>🚀 <strong>Bem-vindo!</strong> Conecte seu primeiro número WhatsApp Business para começar a disparar mensagens.</span>
          <button
            onClick={() => navigate("/accounts")}
            style={{
              background: "rgba(0,194,107,0.2)",
              border: "1px solid rgba(0,194,107,0.4)",
              color: "#00c26b",
              padding: "5px 14px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.8rem",
              fontWeight: 600,
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            Conectar agora →
          </button>
        </div>
      )}

      {isImpersonating && (
        <div style={{
          backgroundColor: "#ffe4e6",
          color: "#9f1239",
          padding: "10px 24px",
          textAlign: "center",
          fontSize: "0.88rem",
          fontWeight: "600",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 1001,
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
        }}>
          <span>
            ⚠️ MODO SUPORTE ATIVO: Visualizando e configurando o painel de <strong>{user?.name || user?.email}</strong> (por {impersonatorName}).
          </span>
          <button
            onClick={() => {
              stopImpersonating();
              navigate("/admin");
            }}
            className="btn btn-secondary"
            style={{
              backgroundColor: "#fff",
              color: "#1e1b4b",
              border: "none",
              padding: "6px 14px",
              fontSize: "0.85rem",
              fontWeight: "700",
              cursor: "pointer"
            }}
          >
            Voltar para Administrador
          </button>
        </div>
      )}

      {/* Mobile overlay */}
      {isSidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar} />}

      {/* Mobile header — sits above the flex row, hidden on desktop */}
      <header className="mobile-header">
        <button
          className={`hamburger-btn${isSidebarOpen ? " open" : ""}`}
          onClick={() => setIsSidebarOpen(v => !v)}
          aria-label="Menu"
        >
          <span /><span /><span />
        </button>
        <div className="mobile-header__logo" onClick={() => navigate("/")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <img src="/logo-mark.png" style={{ height: "100%", width: "auto", objectFit: "contain" }} />
          </div>
          <div style={{ fontSize: "1.15rem", fontWeight: 400, display: "flex", alignItems: "center" }}>
            <span style={{ color: "var(--primary)", fontWeight: 700 }}>Send</span>
            <span style={{ marginLeft: "3px", color: "var(--text-primary)" }}>Inteligentte</span>
          </div>
        </div>
        <div className="account-select-wrapper" style={{ minWidth: 0, maxWidth: "160px" }}>
          <select
            value={selectedAccount?.id || ""}
            onChange={(e) => handleAccountChange(e.target.value)}
            className="field-input"
            style={{ cursor: "pointer", fontSize: "0.78rem", padding: "6px 28px 6px 10px" }}
          >
            {accounts.length === 0 ? (
              <option value="">Sem contas</option>
            ) : (
              accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))
            )}
          </select>
        </div>
      </header>

      <div className="app-layout">
        {/* Sidebar */}
        <aside className={`app-sidebar glass${isSidebarOpen ? " open" : ""}`}>
          <div className="sidebar-logo" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
            <div className="sidebar-logo-mark" style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              background: "transparent", 
              border: "none", 
              width: "42px", 
              height: "42px",
              flexShrink: 0 
            }}>
              <img src="/logo-mark.png" style={{ height: "100%", width: "auto", objectFit: "contain" }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="sidebar-logo-text" style={{ fontSize: "1.1rem", fontWeight: 400, letterSpacing: "-0.01em", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <span style={{ color: "var(--primary)", fontWeight: 700 }}>Send</span>
                <span style={{ marginLeft: "4px", color: "var(--text-primary)" }}>Inteligentte</span>
                <span className="sidebar-logo-badge" style={{ marginLeft: "4px", flexShrink: 0 }}>Beta</span>
              </div>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "1px" }}>por Inteligentte Lab</div>
            </div>
          </div>

          {/* Account Switcher */}
          <div className="field">
            <label className="nav-section-label">Conta Ativa</label>
            <div className="account-select-wrapper">
              <select
                value={selectedAccount?.id || ""}
                onChange={(e) => handleAccountChange(e.target.value)}
                className="field-input"
                style={{ cursor: "pointer", paddingRight: "32px" }}
              >
                {accounts.length === 0 ? (
                  <option value="">Sem contas cadastradas</option>
                ) : (
                  accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span className="nav-section-label">Principal</span>
            <NavLink to="/metrics" onClick={closeSidebar} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <BarChart3 size={18} className="nav-icon" /> Métricas
            </NavLink>
            <NavLink to="/chat" onClick={closeSidebar} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <MessageSquare size={18} className="nav-icon" /> Chat & Atendimento
            </NavLink>

            <span className="nav-section-label" style={{ marginTop: "6px" }}>Campanhas</span>
            <NavLink to="/templates" onClick={closeSidebar} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <FileText size={18} className="nav-icon" /> Templates Meta
            </NavLink>
            <NavLink to="/lists" onClick={closeSidebar} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <Users size={18} className="nav-icon" /> Listas de Contatos
            </NavLink>
            <NavLink to="/messages" onClick={closeSidebar} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <Send size={18} className="nav-icon" /> Envio & Histórico
            </NavLink>
            <NavLink to="/media" onClick={closeSidebar} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <ImageIcon size={18} className="nav-icon" /> Galeria de Mídias
            </NavLink>
            <NavLink to="/optouts" onClick={closeSidebar} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <ShieldOff size={18} className="nav-icon" /> Opt-out (LGPD)
            </NavLink>
            <NavLink to="/link-tracking" onClick={closeSidebar} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <Link2 size={18} className="nav-icon" /> Rastreamento de Links
            </NavLink>
            <NavLink to="/campaigns" onClick={closeSidebar} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <Megaphone size={18} className="nav-icon" /> Campanhas Recorrentes
            </NavLink>

            <span className="nav-section-label" style={{ marginTop: "6px" }}>Configurações</span>
            <NavLink to="/accounts" onClick={closeSidebar} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <Settings2 size={18} className="nav-icon" /> Contas Meta API
            </NavLink>
            <NavLink to="/api-keys" onClick={closeSidebar} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <KeyRound size={18} className="nav-icon" /> API Pública
            </NavLink>
            {(user?.role === "SUPERUSER" || !!localStorage.getItem("admin_token")) && !isImpersonating && (
              <NavLink to="/admin" onClick={closeSidebar} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                <Wrench size={18} className="nav-icon" /> Administração
              </NavLink>
            )}
          </nav>

          {/* Bottom Section */}
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px solid var(--border-color)", paddingTop: "14px" }}>
            {user && (
              <>
                <div className="user-card">
                  <div className="user-avatar">
                    {(user.name || user.email).charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: "600", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {user.name || user.email}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {user.email}
                    </div>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="nav-item"
                  style={{ color: "var(--error)", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.12)", textAlign: "left", width: "100%", display: "flex", alignItems: "center" }}
                >
                  <LogOut size={18} className="nav-icon" /> Sair da Conta
                </button>
              </>
            )}

            {/* Theme Toggle */}
            <button
              id="theme-toggle-btn"
              onClick={() => setIsDarkTheme(!isDarkTheme)}
              title={isDarkTheme ? "Mudar para tema claro" : "Mudar para tema escuro"}
              className="nav-item"
              style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.875rem" }}
            >
              {isDarkTheme ? (
                <>
                  <Sun size={18} className="nav-icon" /> Tema Claro
                </>
              ) : (
                <>
                  <Moon size={18} className="nav-icon" /> Tema Escuro
                </>
              )}
            </button>

            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center" }}>
              Desenvolvido por Inteligentte Lab | v1.0.0
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="app-main" ref={mainRef}>
          <div className="app-main-inner">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Floating Support Button */}
      <a
        href={SUPPORT_WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="Falar com Suporte"
        className="support-fab"
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: "10px",
          background: "#25D366",
          color: "#fff",
          border: "none",
          borderRadius: "50px",
          padding: "12px 20px 12px 16px",
          fontSize: "0.85rem",
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: "pointer",
          textDecoration: "none",
          boxShadow: "0 4px 20px rgba(37,211,102,0.4)",
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1.05)";
          (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 6px 28px rgba(37,211,102,0.55)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1)";
          (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 4px 20px rgba(37,211,102,0.4)";
        }}
      >
        <WhatsAppIcon />
        <span className="support-fab-text">Suporte</span>
      </a>
    </div>
  );
}
