import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";

// Contexts
import { AuthProvider } from "./contexts/AuthContext";
import { AccountProvider } from "./contexts/AccountContext";
import { AlertProvider } from "./contexts/AlertContext";
import AppLoader from "./components/AppLoader";
import ErrorBoundary from "./components/ErrorBoundary";

// Layout & Pages
import Layout from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import ChatPage from "./pages/ChatPage";
import TemplatesPage from "./pages/TemplatesPage";
import ContactsPage from "./pages/ContactsPage";
import MessagesPage from "./pages/MessagesPage";
import MediaPage from "./pages/MediaPage";
import AccountsPage from "./pages/AccountsPage";
import AdminPage from "./pages/AdminPage";
import BillingPage from "./pages/BillingPage";
import OptOutPage from "./pages/OptOutPage";
import LinkTrackingPage from "./pages/LinkTrackingPage";
import ApiKeysPage from "./pages/ApiKeysPage";
import CampaignsPage from "./pages/CampaignsPage";
import LandingPage from "./pages/LandingPage";

// Public auth pages (outside Layout — no sidebar/header)
import AuthCallbackPage from "./pages/AuthCallbackPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

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

  return (
    <ErrorBoundary>
      {!appReady && <AppLoader onComplete={handleLoaderComplete} />}
      <AuthProvider>
      <AccountProvider>
        <AlertProvider>
          <BrowserRouter>
            <Routes>
              {/* ── Public pages (no Layout, no auth required) ── */}
              <Route path="/landing" element={<LandingPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* ── Main app (Layout with sidebar) ── */}
              <Route path="/" element={<Layout />}>
                <Route index element={<Navigate to="/metrics" replace />} />
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
                <Route path="billing" element={<BillingPage />} />
                <Route path="admin" element={<AdminPage />} />
                <Route path="*" element={<Navigate to="/metrics" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AlertProvider>
      </AccountProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}
