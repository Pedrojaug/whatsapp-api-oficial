import React from "react";

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; }

/**
 * Captura erros de renderização não tratados. Sem isto, qualquer exceção na
 * árvore desmonta o app inteiro e o usuário vê apenas uma tela preta.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Erro não tratado na interface:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh", background: "#080808",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: "16px", color: "#fff",
          fontFamily: "'Nunito', sans-serif", padding: "24px", textAlign: "center",
        }}>
          <div style={{ fontSize: "2rem" }}>⚠️</div>
          <div style={{ fontSize: "1.05rem", fontWeight: 600 }}>Algo deu errado ao carregar a tela</div>
          <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)" }}>
            Clique abaixo para recarregar o Send Inteligentte.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 22px", borderRadius: "8px", border: "none",
              cursor: "pointer", background: "#25d366", color: "#fff",
              fontWeight: 600, fontSize: "0.9rem",
            }}
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
