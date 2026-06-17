import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";

// Contexts
import { AuthProvider } from "./contexts/AuthContext";
import { AccountProvider } from "./contexts/AccountContext";
import { AlertProvider } from "./contexts/AlertContext";

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
import OptOutPage from "./pages/OptOutPage";

export default function App() {
  return (
    <AuthProvider>
      <AccountProvider>
        <AlertProvider>
          <BrowserRouter>
            <Routes>
              {/* Main Layout containing sidebar and header */}
              <Route path="/" element={<Layout />}>
                {/* Redirect home index to metrics page */}
                <Route index element={<Navigate to="/metrics" replace />} />
                
                {/* Modular Pages */}
                <Route path="metrics" element={<DashboardPage />} />
                <Route path="chat" element={<ChatPage />} />
                <Route path="templates" element={<TemplatesPage />} />
                <Route path="lists" element={<ContactsPage />} />
                <Route path="messages" element={<MessagesPage />} />
                <Route path="media" element={<MediaPage />} />
                <Route path="optouts" element={<OptOutPage />} />
                <Route path="accounts" element={<AccountsPage />} />
                <Route path="admin" element={<AdminPage />} />
                
                {/* Fallback redirect */}
                <Route path="*" element={<Navigate to="/metrics" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AlertProvider>
      </AccountProvider>
    </AuthProvider>
  );
}
