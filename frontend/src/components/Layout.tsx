import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useAccount } from "../contexts/AccountContext";
import { useTheme } from "../contexts/ThemeContext";
import { useSSE } from "../hooks/useSSE";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout, isImpersonating, stopImpersonating, impersonatorName } = useAuth();
  const { accounts, selectedAccount, selectAccount } = useAccount();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);

  // SSE Notifications
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; type: string }>>([]);

  useSSE((data: any) => {
    if (data.type === "STATUS_UPDATE") {
      const newNotif = {
        id: Math.random().toString(),
        message: `Mensagem ${data.messageId?.slice(0, 8)}... mudou para ${data.status}`,
        type: data.status === "FAILED" ? "error" : "info",
      };
      setNotifications((prev) => [newNotif, ...prev.slice(0, 4)]);
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== newNotif.id));
      }, 5000);
    }
  });

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".user-dropdown-container")) setUserDropdownOpen(false);
      if (!target.closest(".account-dropdown-container")) setAccountDropdownOpen(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Fechar menu mobile ao trocar de rota
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    { label: "Dashboard", path: "/dashboard", icon: "📊" },
    { label: "Campanhas", path: "/campaigns", icon: "🚀" },
    { label: "Templates", path: "/templates", icon: "📝" },
    { label: "Listas & Contatos", path: "/contacts", icon: "👥" },
    { label: "Mensagens & Logs", path: "/messages", icon: "✉️" },
    { label: "Live Chat", path: "/chat", icon: "💬" },
    { label: "Links Rastreáveis", path: "/tracking", icon: "🔗" },
    { label: "Mídia & Arquivos", path: "/media", icon: "📁" },
    { label: "Opt-Out (Descadastro)", path: "/optout", icon: "🚫" },
    { label: "Contas WhatsApp", path: "/accounts", icon: "⚙️" },
    { label: "Chaves de API", path: "/api-keys", icon: "🔑" },
    { label: "Assinatura & Planos", path: "/subscription", icon: "💳" },
  ];

  if (user?.role === "SUPERUSER") {
    navItems.push({ label: "Administração", path: "/admin", icon: "🛡️" });
  }

  // Verificar expiração de trial / plano
  const plan = user?.plan || "free";
  const isSuperUser = user?.role === "SUPERUSER";
  const isPaid = ["starter", "pro", "enterprise"].includes(plan);

  let daysLeft = 0;
  let trialExpired = false;
  let showBlockedModal = false;

  if (!isPaid && !isSuperUser) {
    if (user?.trialExpiresAt) {
      const now = new Date().getTime();
      const expires = new Date(user.trialExpiresAt).getTime();
      const diffMs = expires - now;
      daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diffMs <= 0) {
        trialExpired = true;
        showBlockedModal = true;
      }
    } else if (user?.createdAt) {
      // Fallback para contas legadas sem trialExpiresAt: 3 dias a partir de createdAt
      const now = new Date().getTime();
      const created = new Date(user.createdAt).getTime();
      const diffMs = (created + 3 * 24 * 60 * 60 * 1000) - now;
      daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diffMs <= 0) {
        trialExpired = true;
        showBlockedModal = true;
      }
    }
  }

  // Permitir acesso às rotas de assinatura/billing mesmo se bloqueado
  const isBillingRoute = ["/subscription", "/billing"].includes(location.pathname);
  const blockAccess = showBlockedModal && !isBillingRoute && !isImpersonating;

  const showTrialBanner = !isPaid && !isSuperUser && !trialExpired;

  // Montar link direto para o WhatsApp do suporte comercial
  const PAYMENT_WA = `https://wa.me/5583920017106?text=${encodeURIComponent("Olá! Quero assinar o Send Inteligentte. Meu e-mail é: " + (user?.email || ""))}`;

  return (
    <div className="layout-root" data-theme={theme}>
      {/* ── Modal de Bloqueio por Trial Expirado ── */}
      {blockAccess && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(8,8,10,0.92)",
          backdropFilter: "blur(12px)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }}>
          <div style={{
            background: "rgba(18,18,22,0.98)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "20px",
            padding: "40px 36px",
            maxWidth: "460px",
            width: "100%",
            textAlign: "center",
            boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
          }}>
            <div style={{ fontSize: "3rem", marginBottom: "16px" }}>⏳</div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#fff", marginBottom: "10px" }}>
              Período de Teste Encerrado
            </h2>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "28px" }}>
              Seus 3 dias de teste gratuito terminaram. Para continuar disparando mensagens com a API Oficial da Meta e gerenciar seus contatos, assine um plano.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <a
                href={PAYMENT_WA}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "13px 20px",
                  background: "linear-gradient(135deg, #00c26b, #00a85c)",
                  color: "#fff",
                  borderRadius: "10px",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                💬 Falar com Suporte & Assinar
              </a>
              <Link
                to="/subscription"
                style={{
                  padding: "11px 20px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.8)",
                  borderRadius: "10px",
                  fontSize: "0.88rem",
                  textDecoration: "none",
                }}
              >
                Ver Planos Disponíveis
              </Link>
            </div>
            <p style={{ marginTop: "20px", fontSize: "0.78rem", color: "rgba(255,255,255,0.35)", lineHeight: 1.4 }}>
              Após a confirmação do pagamento, seu acesso é reativado em até 24h.<br />
              Dúvidas? Entre em contato pelo WhatsApp acima.
            </p>
          </div>
        </div>
      )}

      {/* ── Banner de Notificações Rápidas SSE ── */}
      <div style={{ position: "fixed", top: "20px", right: "20px", zIndex: 9999, display: "flex", flexDirection: "column", gap: "10px" }}>
        {notifications.map((n) => (
          <div
            key={n.id}
            style={{
              padding: "12px 20px",
              background: n.type === "error" ? "rgba(239, 68, 68, 0.9)" : "rgba(0, 194, 107, 0.9)",
              backdropFilter: "blur(8px)",
              borderRadius: "var(--radius-md)",
              color: "#fff",
              fontSize: "0.88rem",
              boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
              animation: "slideIn 0.3s ease",
            }}
          >
            {n.message}
          </div>
        ))}
      </div>

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
          <span>
            👋 <strong>Bem-vindo ao Send Inteligentte!</strong> Conecte sua conta do WhatsApp Oficial da Meta para começar a disparar.
          </span>
          <button
            onClick={() => navigate("/accounts")}
            style={{
              background: "#00c26b",
              color: "#000",
              border: "none",
              padding: "5px 14px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.8rem",
              fontWeight: 600,
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            Conectar WhatsApp →
          </button>
        </div>
      )}

      {/* ── Banner de Suporte (Impersonation) ── */}
      {isImpersonating && (
        <div
          style={{
            background: "linear-gradient(90deg, #f59e0b, #d97706)",
            color: "#000",
            padding: "8px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.85rem",
            fontWeight: "600",
            zIndex: 9999,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>⚠️ MODO SUPORTE ATIVO: Visualizando e configurando o painel de <strong>{user?.name || user?.email}</strong> (por {impersonatorName}).</span>
          </div>
          <button
            onClick={stopImpersonating}
            style={{
              background: "#000",
              color: "#fff",
              border: "none",
              padding: "4px 12px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.8rem",
              fontWeight: "600",
            }}
          >
            Encerrar Suporte
          </button>
        </div>
      )}

      {/* ── Top Header Bar ── */}
      <header className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            type="button"
            className="mobile-toggle-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Abrir Menu"
          >
            ☰
          </button>

          <Link to="/dashboard" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "1.4rem" }}>⚡</span>
            <span style={{ fontWeight: "700", fontSize: "1.15rem", letterSpacing: "-0.5px", color: "var(--text-primary)" }}>
              Send <span style={{ color: "var(--primary)" }}>Inteligentte</span>
            </span>
          </Link>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Seletor de Conta Meta */}
          {accounts.length > 0 && (
            <div className="account-dropdown-container" style={{ position: "relative" }}>
              <button
                type="button"
                className="btn btn-secondary account-selector-btn"
                onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "7px 14px",
                  fontSize: "0.85rem",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--primary)", display: "inline-block" }}></span>
                <span style={{ maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {selectedAccount?.name || "Selecionar Conta"}
                </span>
                <span style={{ fontSize: "0.7rem", opacity: 0.6 }}>▼</span>
              </button>

              {accountDropdownOpen && (
                <div
                  className="glass-dropdown"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: 0,
                    minWidth: "220px",
                    background: "var(--dropdown-bg)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-lg)",
                    boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
                    zIndex: 1000,
                    overflow: "hidden",
                  }}
                >
                  <div style={{ padding: "8px 12px", fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Suas Contas WhatsApp
                  </div>
                  {accounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        selectAccount(acc);
                        setAccountDropdownOpen(false);
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 14px",
                        background: selectedAccount?.id === acc.id ? "rgba(0, 194, 107, 0.1)" : "transparent",
                        color: selectedAccount?.id === acc.id ? "var(--primary)" : "var(--text-primary)",
                        border: "none",
                        borderBottom: "1px solid rgba(255,255,255,0.03)",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>{acc.name}</span>
                      {selectedAccount?.id === acc.id && <span>✓</span>}
                    </button>
                  ))}
                  <div style={{ padding: "8px", borderTop: "1px solid var(--border-color)" }}>
                    <Link
                      to="/accounts"
                      onClick={() => setAccountDropdownOpen(false)}
                      style={{
                        display: "block",
                        textAlign: "center",
                        padding: "6px",
                        fontSize: "0.8rem",
                        color: "var(--primary)",
                        textDecoration: "none",
                      }}
                    >
                      + Gerenciar Contas
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Toggle de Tema Claro/Escuro */}
          <button
            type="button"
            onClick={toggleTheme}
            className="theme-toggle-btn"
            title={`Alternar para tema ${theme === "dark" ? "claro" : "escuro"}`}
            aria-label="Alternar Tema"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          {/* Menu do Usuário */}
          {user && (
            <div className="user-dropdown-container" style={{ position: "relative" }}>
              <button
                type="button"
                className="user-avatar-btn"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--primary), #008f4c)",
                  color: "#000",
                  fontWeight: "700",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                }}
              >
                {(user.name || user.email).charAt(0).toUpperCase()}
              </button>

              {userDropdownOpen && (
                <div
                  className="glass-dropdown"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: 0,
                    minWidth: "200px",
                    background: "var(--dropdown-bg)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-lg)",
                    boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
                    zIndex: 1000,
                    overflow: "hidden",
                  }}
                >
                  <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-color)" }}>
                    <div style={{ fontWeight: "600", fontSize: "0.9rem", color: "var(--text-primary)" }}>
                      {user.name || user.email}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                      {user.email}
                    </div>
                  </div>

                  <div style={{ padding: "6px 0" }}>
                    <Link
                      to="/subscription"
                      onClick={() => setUserDropdownOpen(false)}
                      className="dropdown-item"
                    >
                      💳 Meu Plano & Faturas
                    </Link>
                    <Link
                      to="/api-keys"
                      onClick={() => setUserDropdownOpen(false)}
                      className="dropdown-item"
                    >
                      🔑 Chaves de Integração
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        logout();
                      }}
                      className="dropdown-item"
                      style={{ width: "100%", textAlign: "left", color: "var(--error)" }}
                    >
                      🚪 Sair da Conta
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ── Main App Shell (Sidebar + Content) ── */}
      <div className="layout-body">
        {/* Sidebar Desktop & Mobile */}
        <aside className={`sidebar ${mobileMenuOpen ? "sidebar-mobile-open" : ""}`}>
          <nav style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "16px 12px" }}>
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`nav-link ${isActive ? "nav-link-active" : ""}`}
                >
                  <span style={{ fontSize: "1.1rem" }}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Backdrop for mobile */}
        {mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(4px)",
              zIndex: 90,
            }}
          />
        )}

        {/* Main Page Content */}
        <main className="content-area">
          {children}
        </main>
      </div>
    </div>
  );
}
