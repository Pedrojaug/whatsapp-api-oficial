import React, { createContext, useContext, useState } from "react";

export type AlertType = "success" | "error" | "info";

interface AlertContextType {
  showAlert: (text: string, type?: AlertType) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alert, setAlert] = useState<{ text: string; type?: AlertType } | null>(null);

  const showAlert = (text: string, type: AlertType = "info") => {
    setAlert({ text, type });
    setTimeout(() => setAlert(null), 5000);
  };

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      {alert && (
        <div className="fade-in app-alert" style={{
          position: "fixed", top: "24px", right: "32px", zIndex: 2000,
          padding: "16px 24px", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", gap: "10px",
          background: alert.type === "success" ? "rgba(16, 185, 129, 0.92)" : "rgba(239, 68, 68, 0.92)",
          color: "#fff", backdropFilter: "blur(8px)", boxShadow: "0 10px 30px rgba(0, 0, 0, 0.35)",
          maxWidth: "420px",
        }}>
          {alert.type === "success" ? "✅" : "⚠️"} {alert.text}
        </div>
      )}
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlert must be used within an AlertProvider");
  }
  return context;
};
