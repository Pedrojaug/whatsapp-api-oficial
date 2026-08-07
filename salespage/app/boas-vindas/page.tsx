import Link from "next/link";
import { Brand } from "@/components/Brand";
import { CheckIcon, ArrowRightIcon } from "@/components/icons";

export default function BoasVindasPage() {
  return (
    <div className="welcome-wrapper">
      <header className="site-header">
        <Brand />
      </header>

      <main className="welcome-container">
        <div className="welcome-card">
          <div className="success-icon-wrapper">
            <CheckIcon />
          </div>

          <h1>Pagamento Confirmado!</h1>
          <p>
            Parabéns! Sua conta no <strong>Send Inteligentte</strong> foi ativada com sucesso. Enviamos as credenciais e o guia de configuração inicial para o seu e-mail e WhatsApp.
          </p>

          <div className="next-steps-box">
            <h3>Próximos Passos:</h3>
            <ol>
              <li>Acesse o seu Dashboard Oficial</li>
              <li>Conecte sua conta do WhatsApp Business na Meta</li>
              <li>Cadastre seus templates e crie sua primeira campanha</li>
            </ol>
          </div>

          <a
            className="primary-button large glowing"
            href="https://app.sendinteligente.com.br"
            target="_blank"
            rel="noopener noreferrer"
          >
            Acessar o Painel Send Inteligentte
            <ArrowRightIcon />
          </a>
        </div>
      </main>
    </div>
  );
}
