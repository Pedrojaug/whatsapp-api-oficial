import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

export const getApiUrl = () => {
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    const envUrl = import.meta.env.VITE_API_BASE_URL;
    if (envUrl && envUrl.startsWith("http")) {
      return envUrl;
    }
    return "http://localhost:3001/api";
  }
  return "https://whatsapp-api-oficial-nls9.onrender.com/api";
};

export const API_BASE_URL = getApiUrl();

const parseJwt = (token: string) => {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch (e) {
    return null;
  }
};

const getSafeToken = (): string | null => {
  const t = localStorage.getItem("token");
  if (!t || t === "undefined" || t === "null") return null;
  return t;
};

const getSafeUser = (): any | null => {
  const u = localStorage.getItem("user");
  if (!u || u === "undefined" || u === "null") return null;
  try {
    return JSON.parse(u);
  } catch (e) {
    return null;
  }
};

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  planTier: string;
  avatarUrl: string | null;
  createdAt?: string;
}

interface AuthContextType {
  token: string | null;
  user: AuthUser | null;
  isImpersonating: boolean;
  impersonatorName: string | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  impersonate: (targetUserId: string) => Promise<void>;
  stopImpersonating: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    const t = getSafeToken();
    if (t) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${t}`;
    }
    return t;
  });
  const [user, setUser] = useState<AuthUser | null>(getSafeUser());
  
  const decoded = token ? parseJwt(token) : null;
  const isImpersonating = !!decoded?.impersonatorId;
  const impersonatorName = decoded?.impersonatorName || null;

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common["Authorization"];
    }
  }, [token]);

  const login = (newToken: string, newUser: AuthUser) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
    axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(newUser);
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const res = await axios.get<AuthUser>(`${API_BASE_URL}/auth/me`);
      setUser(res.data);
      localStorage.setItem("user", JSON.stringify(res.data));
    } catch {
      // silently ignore — token may have expired
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    delete axios.defaults.headers.common["Authorization"];
    setToken(null);
    setUser(null);
  };

  const impersonate = async (targetUserId: string) => {
    try {
      const currentToken = localStorage.getItem("token")!;
      const currentUser = localStorage.getItem("user")!;
      
      const res = await axios.post(`${API_BASE_URL}/admin/impersonate`, { targetUserId });
      
      localStorage.setItem("admin_token", currentToken);
      localStorage.setItem("admin_user", currentUser);
      
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      
      axios.defaults.headers.common["Authorization"] = `Bearer ${res.data.token}`;
      setToken(res.data.token);
      setUser(res.data.user);
    } catch (err: any) {
      throw new Error(err.response?.data?.error || "Erro ao iniciar suporte.");
    }
  };

  const stopImpersonating = () => {
    const adminToken = localStorage.getItem("admin_token");
    const adminUser = localStorage.getItem("admin_user");
    
    if (adminToken && adminUser) {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
      
      localStorage.setItem("token", adminToken);
      localStorage.setItem("user", adminUser);
      
      axios.defaults.headers.common["Authorization"] = `Bearer ${adminToken}`;
      setToken(adminToken);
      setUser(JSON.parse(adminUser));
    }
  };

  return (
    <AuthContext.Provider value={{ token, user, isImpersonating, impersonatorName, login, logout, impersonate, stopImpersonating, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
