import React, { useState } from "react";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

interface SetupWizardProps {
  onSave: (newAccount: any) => void;
}

export default function SetupWizard({ onSave }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    wabaId: "",
    phoneNumberId: "",
    accessToken: "",
  });
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const totalSteps = 4;

  const handleNext = () => {
    if (step === 2 && (!form.name || !form.wabaId || !form.phoneNumberId)) {
      alert("Preencha todos os campos obrigatórios antes de prosseguir.");
      return;
    }
    if (step === 3 && !form.accessToken) {
      alert("Insira o token de acesso para avançar.");
      return;
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setValidationError(null);
    setStep(step - 1);
  };

  const handleVerifyAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsValidating(true);
    setValidationError(null);

    try {
      // 1. Validar as credenciais na API da Meta via nosso backend
      const verifyRes = await axios.post(`${API_BASE_URL}/accounts/verify`, {
        wabaId: form.wabaId.trim(),
        phoneNumberId: form.phoneNumberId.trim(),
        accessToken: form.accessToken.trim(),
      });

      if (verifyRes.data.success) {
        // 2. Salvar no banco local se validado
        const saveRes = await axios.post(`${API_BASE_URL}/accounts`, {
          name: form.name.trim(),
          wabaId: form.wabaId.trim(),
          phoneNumberId: form.phoneNumberId.trim(),
          accessToken: form.accessToken.trim(),
        });
        
        onSave(saveRes.data);
        setStep(4); // Vai para a etapa de Sucesso
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || "Falha na conexão com a Meta. Verifique as credenciais.";
      setValidationError(errorMsg);
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="glass" style={{ padding: "30px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "24px", maxWidth: "600px", margin: "0 auto" }}>
      
      {/* Step Indicators Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "15px" }}>
        <div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: "700" }}>Conectar WhatsApp API</h3>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Etapa {step} de {totalSteps}</span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {Array.from({ length: totalSteps }).map((_, idx) => (
            <div
              key={idx}
              style={{
                width: "30px",
                height: "6px",
                borderRadius: "3px",
                background: idx + 1 <= step ? "var(--primary)" : "rgba(255,255,255,0.1)",
                transition: "background 0.3s ease",
              }}
            />
          ))}
        </div>
      </div>

      {/* STEP 1: Introdução */}
      {step === 1 && (
        <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <h4 style={{ fontWeight: "600", fontSize: "1.1rem" }}>Passo 1: Criar Aplicativo na Meta</h4>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: "1.5" }}>
            Para disparar mensagens oficiais, primeiro você deve acessar o portal de desenvolvedores da Meta e criar um app corporativo gratuito.
          </p>
          <div style={{ background: "rgba(255,255,255,0.03)", padding: "16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", fontSize: "0.9rem", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", gap: "10px" }}>
              <span style={{ fontWeight: "bold", color: "var(--primary)" }}>1.</span>
              <span>Acesse **[developers.facebook.com](https://developers.facebook.com/)** e faça login.</span>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <span style={{ fontWeight: "bold", color: "var(--primary)" }}>2.</span>
              <span>Clique em **Criar Aplicativo** e escolha a opção **Outro &gt; Business Messaging &gt; WhatsApp**.</span>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <span style={{ fontWeight: "bold", color: "var(--primary)" }}>3.</span>
              <span>Associe ao seu portfólio de negócios e conclua a criação.</span>
            </div>
          </div>
          <button onClick={handleNext} className="btn btn-primary" style={{ width: "100%", marginTop: "10px" }}>
            Já criei o aplicativo ➔
          </button>
        </div>
      )}

      {/* STEP 2: Pegar IDs da API */}
      {step === 2 && (
        <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <h4 style={{ fontWeight: "600", fontSize: "1.1rem" }}>Passo 2: Inserir IDs de Integração</h4>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: "1.4" }}>
            Copie os identificadores que aparecem na tela **WhatsApp &gt; Configuração de API** da Meta:
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Nome para identificar este número</label>
            <input
              type="text"
              placeholder="Ex: WhatsApp de Vendas"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>ID da Conta do WhatsApp Business (WABA ID)</label>
            <input
              type="text"
              placeholder="Código numérico (ex: 3584821414999551)"
              value={form.wabaId}
              onChange={(e) => setForm({ ...form, wabaId: e.target.value })}
              style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>ID do Número de Telefone (Phone Number ID)</label>
            <input
              type="text"
              placeholder="Código numérico (ex: 1126239797248013)"
              value={form.phoneNumberId}
              onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })}
              style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none" }}
            />
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button onClick={handleBack} className="btn btn-secondary" style={{ flex: 1 }}>Voltar</button>
            <button onClick={handleNext} className="btn btn-primary" style={{ flex: 1 }}>Avançar ➔</button>
          </div>
        </div>
      )}

      {/* STEP 3: Cadastrar Token Permanente */}
      {step === 3 && (
        <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <h4 style={{ fontWeight: "600", fontSize: "1.1rem" }}>Passo 3: Token de Acesso da Meta</h4>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: "1.4" }}>
            Insira o Token de Acesso Permanente obtido nos **Usuários do Sistema** do seu Gerenciador de Negócios da Meta.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Token de Acesso Permanente</label>
            <input
              type="password"
              placeholder="Cole o token (texto longo iniciando com EAA...)"
              value={form.accessToken}
              onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
              style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none" }}
            />
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
              *Para testes iniciais, você pode usar o **Token Temporário** de 24h fornecido na tela de testes da Meta.
            </span>
          </div>

          {validationError && (
            <div style={{ background: "var(--error-glow)", color: "var(--error)", padding: "12px", borderRadius: "var(--radius-md)", border: "1px solid rgba(239, 68, 68, 0.3)", fontSize: "0.85rem" }}>
              ⚠️ **Erro na validação:** {validationError}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button onClick={handleBack} disabled={isValidating} className="btn btn-secondary" style={{ flex: 1 }}>Voltar</button>
            <button onClick={handleVerifyAndSave} disabled={isValidating} className="btn btn-primary" style={{ flex: 1.5 }}>
              {isValidating ? "Validando na Meta..." : "Testar e Conectar ⚡"}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Sucesso */}
      {step === 4 && (
        <div className="fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", padding: "20px 0", textAlign: "center" }}>
          <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "var(--success-glow)", color: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", border: "2px solid rgba(16, 185, 129, 0.4)" }}>
            ✓
          </div>
          <div>
            <h4 style={{ fontWeight: "700", fontSize: "1.3rem", marginBottom: "8px" }}>WhatsApp Conectado!</h4>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
              A conta <strong>{form.name}</strong> foi validada e salva no banco Neon com sucesso. Você já pode sincronizar templates e fazer disparos!
            </p>
          </div>
          <button onClick={() => setStep(1)} className="btn btn-primary" style={{ width: "100%", marginTop: "10px" }}>
            Concluir e Voltar
          </button>
        </div>
      )}

    </div>
  );
}
