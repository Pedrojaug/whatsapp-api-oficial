import { useState, lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";

// Contexts
import { AuthProvider } from "./contexts/AuthContext";
import { AccountProvider } from "./contexts/AccountContext";
import { AlertProvider } from "./contexts/AlertContext";
import AppLoader from "./components/AppLoader";
import PageLoader from "./components/PageLoader";
import ErrorBoundary from "./components/ErrorBoundary";

// Layout
import Layout from "./components/Layout";

// Code-Splitting: Lazy-loaded pages (Each route is loaded on demand)
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const TemplatesPage = lazy(() => import("./pages/TemplatesPage"));
const ContactsPage = lazy(() => import("./pages/ContactsPage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const MediaPage = lazy(() => import("./pages/MediaPage"));
const AccountsPage = lazy(() => import("./pages/AccountsPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const OptOutPage = lazy(() => import("./pages/OptOutPage"));
const LinkTrackingPage = lazy(() => import("./pages/LinkTrackingPage"));
const ApiKeysPage = lazy(() => import("./pages/ApiKeysPage"));
const CampaignsPage = lazy(() => import("./pages/CampaignsPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));

// Public auth pages (outside Layout — no sidebar/header)
const AuthCallbackPage = lazy(() => import("./pages/AuthCallbackPage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));

export default function App() {
  // A intro (AppLoader) só deve aparecer na primeira visita da sessão.
  // Nunca na volta do OAuth (/auth/callback) nem em recargas subsequentes —
  // caso contrário o overlay preto cobre a tela justamente nas transições de login/logout.
  const [appReady, setAppReady] = useState(() => {
    if (typeof window === "undefined") return true;
    if (sessionStorage.getItem("introShown") === "1") return true;
    if (window.location.pathname.startsWith("/auth/callback")) return true;
    return false;
  });

  const handleLoaderComplete = () => {
    sessionStorage.setItem("introShown", "1");
    setAppReady(true);
  };

  // Prefetch inteligente em segundo plano durante tempo ocioso (Idle)
  useEffect(() => {
    if (!appReady) return;
    const idlePrefetch = () => {
      // Pré-carrega de forma assíncrona as telas mais utilizadas sem travar a navegação
      import("./pages/DashboardPage");
      import("./pages/ChatPage");
      import("./pages/CampaignsPage");
    };

    if ("requestIdleCallback" in window) {
      const handle = (window as any).requestIdleCallback(idlePrefetch, { timeout: 3000 });
      return () => (window as any).cancelIdleCallback?.(handle);
    } else {
      const timer = setTimeout(idlePrefetch, 2000);
      return () => clearTimeout(timer);
    }
  }, [appReady]);

  return (
    <ErrorBoundary>
      {!appReady && <AppLoader onComplete={handleLoaderComplete} />}
      <AuthProvider>
      <AccountProvider>
        <AlertProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* ── Public redirects ── */}
                <Route path="/register" element={<Navigate to="/login" replace />} />

                {/* ── Public pages (no Layout, no auth required) ── */}
                <Route path="/landing" element={<LandingPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                {/* ── Main app (Layout with sidebar) ── */}
                <Route path="/" element={<Layout />}>
                  <Route index element={<Navigate to="/metrics" replace />} />
                  <Route path="login" element={<Navigate to="/metrics" replace />} />
                  <Route path="register" element={<Navigate to="/login" replace />} />
                  <Route path="metrics" element={<DashboardPage />} />
                  <Route path="chat" element={<ChatPage />} />
                  <Route path="templates" element={<TemplatesPage />} />
                  <Route path="lists" element={<ContactsPage />} />
                  <Route path="messages" element={<MessagesPage />} />
                  <Route path="media" element={<MediaPage />} />
                  <Route path="optouts" element={<OptOutPage />} />
                  <Route path="link-tracking" element={<LinkTrackingPage />} />
                  <Route path="api-keys" element={<ApiKeysPage />} />
                  <Route path="campaigns" element={<CampaignsPage />} />
                  <Route path="accounts" element={<AccountsPage />} />
                  <Route path="subscription" element={<Navigate to="/metrics" replace />} />
                  <Route path="billing" element={<Navigate to="/metrics" replace />} />
                  <Route path="admin" element={<AdminPage />} />
                  <Route path="*" element={<Navigate to="/metrics" replace />} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AlertProvider>
      </AccountProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}
