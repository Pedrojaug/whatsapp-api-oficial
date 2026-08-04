import Link from "next/link";
import { Brand } from "@/components/Brand";
import { CheckoutForm } from "@/components/CheckoutForm";
import { ArrowLeftIcon } from "@/components/icons";
import { getPlan } from "@/lib/plans";

type CheckoutPageProps = {
  searchParams: Promise<{
    plano?: string;
  }>;
};

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const { plano } = await searchParams;
  const plan = getPlan(plano);

  return (
    <main>
      <header className="checkout-header">
        <Brand href="/" label="Checkout seguro" />
        <Link className="secondary-button compact" href="/">
          <ArrowLeftIcon />
          Voltar
        </Link>
      </header>

      <div className="checkout-page">
        <section className="checkout-copy">
          <span className="pill success">Checkout Asaas</span>
          <h1>Falta pouco para sua primeira campanha.</h1>
          <p>
            Preencha seus dados e escolha como prefere pagar. Assim que a confirmação chegar, começamos a ativação do
            seu número e você recebe as orientações por WhatsApp e e-mail.
          </p>

          <div className="checkout-steps" aria-label="Etapas do checkout">
            <span className="is-current">Dados</span>
            <span>Pagamento</span>
            <span>Boas-vindas</span>
          </div>
        </section>

        <CheckoutForm plan={plan} />
      </div>
    </main>
  );
}
