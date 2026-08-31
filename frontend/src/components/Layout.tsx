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
  KeyRound,
  CreditCard
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

  // Animate page transitions
  useEffect(() => {
    if (mainRef.current) {
      gsap.fromTo(
        mainRef.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: DUR.sm, ease: EASE.out }
      );
    }
  }, [location.pathname]);

  // Listen for custom navigation events (dispatched from other components)
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (e.detail?.path) navigate(e.detail.path);
    };
    window.addEventListener("navigate-to" as any, handler);
    return () => window.removeEventListener("navigate-to" as any, handler);
  }, [navigate]);

  const closeSidebar = () => setIsSidebarOpen(false);

  // Unauthenticated -> Render Modern Auth Form
  if (!token) {
    return <AuthPages onLoginSuccess={(t, u) => login(t, u)} />;
  }

  // Verificar se o trial de 3 dias expirou (apenas para contas com status TRIAL)
  // Contas com subscriptionStatus ACTIVE ou sem createdAt estão liberadas
  const isTrial = user?.subscriptionStatus === "TRIAL";
  const isSuperUser = user?.role === "SUPERUSER";
  let trialExpired = false;
  let daysLeft = 0;

  if (isTrial && !isSuperUser && user?.createdAt) {
    const createdAt = new Date(user.createdAt).getTime();
    const now = new Date().getTime();
    const diffDays = (now - createdAt) / (1000 * 60 * 60 * 24);
    daysLeft = Math.max(0, Math.ceil(3 - diffDays));
    trialExpired = diffDays >= 3;
  }

  // Rota de assinatura/planos pode ser acessada mesmo com trial expirado
  const isSubscriptionRoute = location.pathname === "/subscription" || location.pathname === "/billing";
  const showBlockedModal = trialExpired && !isSubscriptionRoute && !isImpersonating;

  // Banner de aviso nos últimos dias de teste (dia 1, 2 ou 3)
  const showTrialBanner = isTrial && !trialExpired && !isSuperUser;

  // Link direto para WhatsApp comercial para pagamento manual
  const PAYMENT_WA = `https://wa.me/5583920017106?text=${encodeURIComponent("Olá! Quero assinar o Send Inteligentte. Meu e-mail é: " + (user?.email || ""))}`;

  return (
    <div className="app-shell">
      {/* Modal de bloqueio quando o trial de 3 dias expira */}
      {showBlockedModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(8px)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }}>
          <div style={{
            background: "#111",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "16px",
            padding: "36px 32px",
            maxWidth: "460px",
            width: "100%",
            textAlign: "center",
            boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
          }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>⏳</div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#fff", marginBottom: "8px" }}>
              Período de Teste Encerrado
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", lineHeight: 1.5, marginBottom: "24px" }}>
              Seus 3 dias de teste gratuito terminaram. Para continuar disparando mensagens com a API Oficial da Meta e gerenciar seus contatos, assine um plano.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <a
                href={PAYMENT_WA}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "12px 20px",
                  background: "#00c26b",
                  color: "#000",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                💬 Falar com Suporte & Assinar
              </a>
              <button
                onClick={() => navigate("/subscription")}
                style={{
                  padding: "10px 20px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.8)",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Ver Planos Disponíveis
              </button>
            </div>
            <p style={{ marginTop: "16px", fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Após o pagamento, seu acesso é liberado em até 24h.
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
      {user && !user.emailVerified && user.email !== "demo.video@sendinteligente.com.br" && !isImpersonating && user.role !== "SUPERUSER" && (
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
      {showTrialBanner && user?.email !== "demo.video@sendinteligente.com.br" && !isImpersonating && (
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
      {user && accounts.length === 0 && user.email !== "demo.video@sendinteligente.com.br" && !isImpersonating && (
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
          <span />
          <span />
          <span />
        </button>
        <span className="mobile-header-logo">
          Send<strong>Inteligentte</strong>
        </span>
        {accounts.length > 0 && (
          <select
            className="account-select mobile-account-select"
            value={selectedAccount?.id || ""}
            onChange={(e) => {
              const acc = accounts.find((a) => a.id === e.target.value);
              if (acc) selectAccount(acc);
            }}
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
        )}
      </header>

      {/* Main layout container */}
      <div className="app-layout">
        {/* Sidebar */}
        <aside className={`app-sidebar${isSidebarOpen ? " open" : ""}`}>
          {/* Logo & Brand Header */}
          <div className="sidebar-header">
            <div className="brand-badge">
              <span className="brand-dot pulse" />
              API Oficial Meta
            </div>
            <h1 className="brand-logo">
              Send<strong>Inteligentte</strong>
            </h1>
            <p className="brand-tagline">Disparos em Escala</p>

            {/* Account Selector in Sidebar */}
            {accounts.length > 0 && (
              <div className="sidebar-account-picker">
                <label className="sidebar-section-label">Conta Ativa</label>
                <select
                  className="account-select"
                  value={selectedAccount?.id || ""}
                  onChange={(e) => {
                    const acc = accounts.find((a) => a.id === e.target.value);
                    if (acc) selectAccount(acc);
                  }}
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Navigation Items */}
          <nav className="sidebar-nav">
            <span className="sidebar-section-label">Comunicação</span>

            <NavLink
              to="/metrics"
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
              onClick={closeSidebar}
            >
              <BarChart3 size={18} className="nav-icon" />
              <span>Painel de Métricas</span>
            </NavLink>

            <NavLink
              to="/campaigns"
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
              onClick={closeSidebar}
            >
              <Megaphone size={18} className="nav-icon" />
              <span>Campanhas</span>
            </NavLink>

            <NavLink
              to="/templates"
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
              onClick={closeSidebar}
            >
              <FileText size={18} className="nav-icon" />
              <span>Modelos (Templates)</span>
            </NavLink>

            <NavLink
              to="/lists"
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
              onClick={closeSidebar}
            >
              <Users size={18} className="nav-icon" />
              <span>Listas de Contatos</span>
            </NavLink>

            <NavLink
              to="/messages"
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
              onClick={closeSidebar}
            >
              <Send size={18} className="nav-icon" />
              <span>Disparos & Logs</span>
            </NavLink>

            <NavLink
              to="/chat"
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
              onClick={closeSidebar}
            >
              <MessageSquare size={18} className="nav-icon" />
              <span>Live Chat</span>
            </NavLink>

            <NavLink
              to="/link-tracking"
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
              onClick={closeSidebar}
            >
              <Link2 size={18} className="nav-icon" />
              <span>Links Rastreáveis</span>
            </NavLink>

            <NavLink
              to="/media"
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
              onClick={closeSidebar}
            >
              <ImageIcon size={18} className="nav-icon" />
              <span>Galeria de Mídia</span>
            </NavLink>

            <NavLink
              to="/optouts"
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
              onClick={closeSidebar}
            >
              <ShieldOff size={18} className="nav-icon" />
              <span>Descadastros</span>
            </NavLink>

            <span className="sidebar-section-label" style={{ marginTop: "12px" }}>Configurações</span>

            <NavLink
              to="/accounts"
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
              onClick={closeSidebar}
            >
              <Settings2 size={18} className="nav-icon" />
              <span>Contas WhatsApp</span>
            </NavLink>

            <NavLink
              to="/api-keys"
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
              onClick={closeSidebar}
            >
              <KeyRound size={18} className="nav-icon" />
              <span>Chaves de API</span>
            </NavLink>

            <NavLink
              to="/billing"
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
              onClick={closeSidebar}
            >
              <CreditCard size={18} className="nav-icon" />
              <span>Faturamento</span>
            </NavLink>

            {user?.role === "SUPERUSER" && (
              <NavLink
                to="/admin"
                className={({ isActive }) => `nav-item admin-nav-item${isActive ? " active" : ""}`}
                onClick={closeSidebar}
              >
                <Wrench size={18} className="nav-icon" />
                <span>Super Admin</span>
              </NavLink>
            )}
          </nav>

          {/* Sidebar Footer — User & Controls */}
          <div className="sidebar-footer">
            {user && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                  <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "linear-gradient(135deg, var(--primary), #00c26b)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "0.8rem", color: "#000", flexShrink: 0 }}>
                    {(user.name || user.email || "U").charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: "600", color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
