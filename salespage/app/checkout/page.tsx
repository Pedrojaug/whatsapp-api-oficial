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
          <h1>Finalize sua assinatura e receba o acesso de boas-vindas.</h1>
          <p>
            Após a confirmação do pagamento, o Send dispara automaticamente a sequência de recepção com as orientações
            de ativação.
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
