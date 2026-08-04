import Link from "next/link";
import { Brand } from "@/components/Brand";
import { ArrowRightIcon, CheckIcon } from "@/components/icons";
import { getPlan } from "@/lib/plans";

type WelcomePageProps = {
  searchParams: Promise<{
    nome?: string;
    plano?: string;
  }>;
};

export default async function WelcomePage({ searchParams }: WelcomePageProps) {
  const { nome, plano } = await searchParams;
  const plan = getPlan(plano);
  const displayName = nome?.trim() || "cliente";

  return (
    <main className="welcome-page">
      <div>
        <Brand centered label="Pagamento confirmado" />

        <section className="welcome-card">
          <span className="success-badge">
            <CheckIcon />
          </span>
          <h1>Bem-vindo ao Send Inteligente, {displayName}.</h1>
          <p>
            Sua assinatura {plan.name.toLowerCase()} foi recebida. A partir daqui, a sequência de boas-vindas assume e
            envia as orientações iniciais por WhatsApp e e-mail.
          </p>

          <div className="welcome-sequence">
            <article>
              <span>01</span>
              <strong>Contato marcado como cliente</strong>
              <small>Imediato</small>
            </article>
            <article>
              <span>02</span>
              <strong>Mensagem de boas-vindas enviada</strong>
              <small>+1 min</small>
            </article>
            <article>
              <span>03</span>
              <strong>Orientações de ativação liberadas</strong>
              <small>+5 min</small>
            </article>
          </div>

          <div className="hero-actions centered-actions">
            <Link className="primary-button large" href="/admin">
              Acessar painel
              <ArrowRightIcon />
            </Link>
            <Link className="secondary-button large" href="/">
              Voltar para a página
            </Link>
          </div>

          <p className="fine-print">
            Não recebeu nada em alguns minutos? Verifique o WhatsApp informado no checkout e a caixa de spam do e-mail.
          </p>
        </section>
      </div>
    </main>
  );
}
