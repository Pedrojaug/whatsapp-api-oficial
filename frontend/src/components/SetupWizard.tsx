import React, { useState, useEffect } from "react";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://whatsapp-api-oficial-nls9.onrender.com/api";
const FACEBOOK_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID || "";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

interface SetupWizardProps {
  onSave: (newAccount: any) => void;
}

export default function SetupWizard({ onSave }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const oauthIntervalRef = React.useRef<any>(null);
  
  // Manual form states
  const [form, setForm] = useState({
    name: "",
    wabaId: "",
    phoneNumberId: "",
    accessToken: "",
  });
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Facebook OAuth states
  const [wabas, setWabas] = useState<any[]>([]);
  const [longLivedToken, setLongLivedToken] = useState("");
  const [onboardLoading, setOnboardLoading] = useState(false);
  const [onboardError, setOnboardError] = useState<string | null>(null);
  
  // Selection states for Facebook onboarding
  const [onboardName, setOnboardName] = useState("");
  const [selectedWabaIndex, setSelectedWabaIndex] = useState<number>(-1);
  const [selectedPhoneId, setSelectedPhoneId] = useState("");

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
      }, { headers: getAuthHeaders() });

      if (verifyRes.data.success) {
        // 2. Salvar no banco local se validado
        const saveRes = await axios.post(`${API_BASE_URL}/accounts`, {
          name: form.name.trim(),
          wabaId: form.wabaId.trim(),
          phoneNumberId: form.phoneNumberId.trim(),
          accessToken: form.accessToken.trim(),
        }, { headers: getAuthHeaders() });
        
        onSave(saveRes.data);
        setStep(4); // Vai para a etapa de Sucesso
      }
    } catch (err: any) {
      const backendError = err.response?.data?.error;
      const networkError = err.message;
      const statusCode = err.response?.status;
      let errorMsg = "Falha na conexão com a Meta. Verifique as credenciais.";
      if (statusCode === 401) {
        errorMsg = "Sessão expirada. Faça logout e login novamente.";
      } else if (backendError) {
        errorMsg = backendError;
      } else if (networkError === "Network Error") {
        errorMsg = "Erro de rede: o servidor está offline ou demorando para responder. Aguarde 1 minuto e tente novamente.";
      }
      setValidationError(errorMsg);
    } finally {
      setIsValidating(false);
    }
  };

  // Escutar mensagens do popup de OAuth
  useEffect(() => {
    const handleOAuthMessage = async (event: MessageEvent) => {
      // Garantir que a mensagem vem da nossa própria origem
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === "FACEBOOK_OAUTH_SUCCESS" || event.data?.type === "FACEBOOK_OAUTH_FAILED") {
        if (oauthIntervalRef.current) {
          clearInterval(oauthIntervalRef.current);
          oauthIntervalRef.current = null;
        }
      }

      if (event.data?.type === "FACEBOOK_OAUTH_SUCCESS") {
        const token = event.data.token;
        await handleTokenExchange(token);
      } else if (event.data?.type === "FACEBOOK_OAUTH_FAILED") {
        setOnboardError(`Erro no login do Facebook: ${event.data.error}`);
        setOnboardLoading(false);
      }
    };

    window.addEventListener("message", handleOAuthMessage);
    return () => {
      window.removeEventListener("message", handleOAuthMessage);
      if (oauthIntervalRef.current) {
        clearInterval(oauthIntervalRef.current);
      }
    };
  }, []);

  const handleFacebookLogin = () => {
    if (!FACEBOOK_APP_ID) {
      alert("Erro: O Facebook App ID não está configurado nas variáveis de ambiente (.env).");
      return;
    }

    setOnboardLoading(true);
    setOnboardError(null);

    const redirectUri = encodeURIComponent(`${window.location.origin}/oauth_callback.html`);
    const scope = "whatsapp_business_management,whatsapp_business_messaging,public_profile";
    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${FACEBOOK_APP_ID}&redirect_uri=${redirectUri}&scope=${scope}&response_type=token`;

    // Abrir o popup centralizado
    const width = 600;
    const height = 650;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    if (oauthIntervalRef.current) {
      clearInterval(oauthIntervalRef.current);
    }

    const popup = window.open(
      authUrl,
      "facebook-login-popup",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,status=no,location=no,scrollbars=yes`
    );

    if (popup) {
      oauthIntervalRef.current = setInterval(() => {
        if (popup.closed) {
          clearInterval(oauthIntervalRef.current);
          oauthIntervalRef.current = null;
          setOnboardLoading(false);
        }
      }, 1000);
    }
  };

  const handleTokenExchange = async (shortLivedToken: string) => {
    try {
      setOnboardLoading(true);
      const res = await axios.post(`${API_BASE_URL}/accounts/facebook-onboard/exchange`, {
        shortLivedToken
      }, { headers: getAuthHeaders() });

      const { longLivedToken, wabas } = res.data;
      setLongLivedToken(longLivedToken);
      setWabas(wabas);

      if (wabas.length > 0) {
        setStep(5); // Ir para o passo de seleção das contas
      } else {
        setOnboardError("Nenhuma conta do WhatsApp Business encontrada no seu perfil do Facebook.");
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.details || err.response?.data?.error || err.message;
      setOnboardError(`Falha ao carregar contas da Meta: ${errMsg}`);
    } finally {
      setOnboardLoading(false);
    }
  };

  const handleSaveOnboardedAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardName.trim()) {
      alert("Por favor, digite um nome de identificação.");
      return;
    }
    if (selectedWabaIndex === -1) {
      alert("Por favor, selecione uma conta WABA.");
      return;
    }
    if (!selectedPhoneId) {
      alert("Por favor, selecione um número de telefone.");
      return;
    }

    const selectedWaba = wabas[selectedWabaIndex];
    setIsValidating(true);
    setOnboardError(null);

    try {
      const saveRes = await axios.post(`${API_BASE_URL}/accounts/facebook-onboard/save`, {
        name: onboardName.trim(),
        wabaId: selectedWaba.id,
        phoneNumberId: selectedPhoneId,
        accessToken: longLivedToken,
      }, { headers: getAuthHeaders() });

      // Atualiza o estado na tela principal
      onSave(saveRes.data);
      // Salva no formulário para exibição na tela de sucesso
      setForm({
        name: onboardName.trim(),
        wabaId: selectedWaba.id,
        phoneNumberId: selectedPhoneId,
        accessToken: "Ocultado (Conexão Segura)",
      });
      setStep(4); // Vai para etapa de Sucesso
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || "Falha ao salvar a conta.";
      setOnboardError(errorMsg);
    } finally {
      setIsValidating(false);
    }
  };

  const selectedWaba = selectedWabaIndex !== -1 ? wabas[selectedWabaIndex] : null;
  const availablePhones = selectedWaba ? selectedWaba.phoneNumbers || [] : [];

  return (
    <div className="glass" style={{ padding: "30px", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", gap: "24px", maxWidth: "600px", margin: "0 auto" }}>
      
      {/* Step Indicators Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "15px" }}>
        <div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: "700" }}>Conectar WhatsApp API</h3>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            {step === 5 ? "Seleção de Conta" : `Etapa ${step} de ${totalSteps}`}
          </span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {step <= 4 && Array.from({ length: totalSteps }).map((_, idx) => (
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
          {step === 5 && (
            <div style={{ padding: "2px 10px", background: "var(--primary-glow)", color: "var(--primary)", border: "1px solid rgba(0, 194, 107, 0.3)", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "600" }}>
              Etapa Final
            </div>
          )}
        </div>
      </div>

      {/* STEP 1: Introdução / Opção de Login Automático */}
      {step === 1 && (
        <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <h4 style={{ fontWeight: "600", fontSize: "1.1rem" }}>Passo 1: Como deseja se conectar?</h4>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: "1.5" }}>
            Conecte seu número de WhatsApp de maneira oficial. Escolha o método mais simples para o seu fluxo:
          </p>

          {/* Opção 1: Facebook Login */}
          <div className="glass" style={{ padding: "20px", borderRadius: "var(--radius-md)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: "12px", background: "rgba(255,255,255,0.01)" }}>
            <h5 style={{ fontWeight: "600", fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "6px" }}>⚡ Conexão Automática (Recomendado)</h5>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", margin: 0, lineHeight: "1.4" }}>
              Faça login de forma segura no seu perfil do Facebook e selecione a conta do WhatsApp Business que deseja importar. Os IDs e tokens serão preenchidos de forma automática.
            </p>
            
            {onboardError && (
              <div style={{ background: "var(--error-glow)", color: "var(--error)", padding: "10px", borderRadius: "8px", border: "1px solid rgba(239, 68, 68, 0.2)", fontSize: "0.8rem", marginTop: "5px" }}>
                ⚠️ {onboardError}
              </div>
            )}

            <button
              onClick={handleFacebookLogin}
              disabled={onboardLoading}
              className="btn"
              style={{
                width: "100%",
                background: "linear-gradient(135deg, #1877f2 0%, #166fe5 100%)",
                color: "#fff",
                fontWeight: "600",
                boxShadow: "0 4px 12px rgba(24, 119, 242, 0.3)",
                marginTop: "6px"
              }}
            >
              {onboardLoading ? "Carregando Contas..." : "🔵 Conectar via Facebook"}
            </button>
          </div>

          {/* Opção 2: Configuração Manual */}
          <div style={{ textAlign: "center", marginTop: "10px" }}>
            <button
              onClick={handleNext}
              className="btn btn-secondary"
              style={{ width: "100%", fontSize: "0.85rem" }}
            >
              ⚙️ Configuração Manual (Copiar e colar tokens)
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Pegar IDs da API (Manual) */}
      {step === 2 && (
        <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <h4 style={{ fontWeight: "600", fontSize: "1.1rem" }}>Passo 2: Inserir IDs de Integração</h4>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: "1.4" }}>
            Copie os identificadores que aparecem na tela **WhatsApp &gt; Configuração de API** do Facebook Developers:
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

      {/* STEP 3: Cadastrar Token Permanente (Manual) */}
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

      {/* STEP 5: Seleção de Conta e Telefone (Facebook Onboarding) */}
      {step === 5 && (
        <form onSubmit={handleSaveOnboardedAccount} className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <h4 style={{ fontWeight: "600", fontSize: "1.1rem" }}>Finalizar Conexão do WhatsApp</h4>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: "1.4" }}>
            Selecione qual conta comercial e número você deseja integrar ao **Send Inteligentte**:
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>Nome para Identificar o Canal</label>
            <input
              type="text"
              placeholder="Ex: WhatsApp de Suporte / Comercial"
              value={onboardName}
              onChange={(e) => setOnboardName(e.target.value)}
              style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none" }}
              required
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>Selecionar Conta Comercial (WABA)</label>
            <select
              value={selectedWabaIndex}
              onChange={(e) => {
                const idx = parseInt(e.target.value);
                setSelectedWabaIndex(idx);
                setSelectedPhoneId(""); // Reset phone
              }}
              style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none" }}
              required
            >
              <option value="-1" style={{ color: "#111827", background: "#fff" }}>Selecione uma conta comercial</option>
              {wabas.map((waba, idx) => (
                <option key={waba.id} value={idx} style={{ color: "#111827", background: "#fff" }}>
                  {waba.name} ({waba.id})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>Selecionar Número de Telefone</label>
            <select
              value={selectedPhoneId}
              onChange={(e) => setSelectedPhoneId(e.target.value)}
              style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", outline: "none" }}
              disabled={selectedWabaIndex === -1 || availablePhones.length === 0}
              required
            >
              <option value="" style={{ color: "#111827", background: "#fff" }}>
                {selectedWabaIndex === -1 
                  ? "Selecione a WABA primeiro" 
                  : availablePhones.length === 0 
                    ? "Nenhum número cadastrado nesta WABA" 
                    : "Selecione um número de telefone"}
              </option>
              {availablePhones.map((phone: any) => (
                <option key={phone.id} value={phone.id} style={{ color: "#111827", background: "#fff" }}>
                  {phone.displayPhoneNumber} {phone.verifiedName ? `(${phone.verifiedName})` : ""}
                </option>
              ))}
            </select>
          </div>

          {onboardError && (
            <div style={{ background: "var(--error-glow)", color: "var(--error)", padding: "12px", borderRadius: "var(--radius-md)", border: "1px solid rgba(239, 68, 68, 0.3)", fontSize: "0.85rem" }}>
              ⚠️ **Erro ao salvar:** {onboardError}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button 
              type="button" 
              onClick={() => {
                setStep(1);
                setOnboardError(null);
                setWabas([]);
                setLongLivedToken("");
              }} 
              disabled={isValidating} 
              className="btn btn-secondary" 
              style={{ flex: 1 }}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={isValidating || selectedWabaIndex === -1 || !selectedPhoneId} 
              className="btn btn-primary" 
              style={{ flex: 1.5 }}
            >
              {isValidating ? "Salvando Canal..." : "Concluir Conexão ⚡"}
            </button>
          </div>
        </form>
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
          <button 
            onClick={() => {
              setStep(1);
              setOnboardName("");
              setSelectedWabaIndex(-1);
              setSelectedPhoneId("");
              setWabas([]);
              setLongLivedToken("");
            }} 
            className="btn btn-primary" 
            style={{ width: "100%", marginTop: "10px" }}
          >
            Concluir e Voltar
          </button>
        </div>
      )}

    </div>
  );
}
