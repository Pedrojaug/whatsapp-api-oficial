import { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
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

export default function Layout() {
  const { token, user, isImpersonating, impersonatorName, login, logout, stopImpersonating } = useAuth();
  const { accounts, selectedAccount, selectAccount } = useAccount();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();

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

  // Sincronização de status das mensagens em tempo real (SSE)
  useEffect(() => {
    if (!selectedAccount || !token) return;

    const sseUrl = `${API_BASE_URL.replace("/api", "")}/api/accounts/${selectedAccount.id}/messages/events?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "messageUpdated") {
          // Dispara evento customizado para que qualquer página possa escutar
          window.dispatchEvent(new CustomEvent("messageUpdated", { detail: data }));
        }
      } catch (err) {
        console.error("Erro ao processar atualização em tempo real:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("Erro na conexão com SSE de eventos. O navegador tentará reconectar automaticamente.", err);
    };

    return () => {
      eventSource.close();
    };
  }, [selectedAccount, token]);

  if (!token) {
    return <AuthPages onLoginSuccess={login} />;
  }

  const handleAccountChange = (accountId: string) => {
    const acc = accounts.find((a) => a.id === accountId);
    selectAccount(acc || null);
  };

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", position: "relative" }}>
      {/* Background Ambient Glows */}
      <div className="ambient-glow-1"></div>
      <div className="ambient-glow-2"></div>

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
              width: "52px", 
              height: "52px",
              flexShrink: 0 
            }}>
              <img src="/logo-mark.png" style={{ height: "100%", width: "auto", objectFit: "contain" }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="sidebar-logo-text" style={{ fontSize: "1.2rem", fontWeight: 400, letterSpacing: "-0.01em", display: "flex", alignItems: "center" }}>
                <span style={{ color: "var(--primary)", fontWeight: 700 }}>Send</span>
                <span style={{ marginLeft: "4px", color: "var(--text-primary)" }}>Inteligentte</span>
              </div>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "1px" }}>por Inteligentte Lab</div>
            </div>
            <span className="sidebar-logo-badge">Beta</span>
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
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
