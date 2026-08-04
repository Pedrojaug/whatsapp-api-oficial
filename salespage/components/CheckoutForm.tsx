"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRightIcon, CheckIcon, LockIcon, ShieldIcon } from "@/components/icons";
import {
  formatCurrency,
  formatCurrencyPrecise,
  monthlyEquivalent,
  plans,
  savingsAmount,
  type Plan,
} from "@/lib/plans";

type CheckoutFormProps = {
  plan: Plan;
};

const paymentLabels = {
  pix: "Pix",
  card: "Cartão",
  boleto: "Boleto",
};

type PaymentMethod = keyof typeof paymentLabels;

export function CheckoutForm({ plan }: CheckoutFormProps) {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState(plan);
  const [payment, setPayment] = useState<PaymentMethod>("pix");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const saving = savingsAmount(selectedPlan);

  function handlePlanChange(slug: string) {
    const nextPlan = plans.find((availablePlan) => availablePlan.slug === slug) ?? selectedPlan;
    setSelectedPlan(nextPlan);
    router.replace(`/checkout?plano=${nextPlan.slug}`, { scroll: false });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const firstName = String(formData.get("name") ?? "").trim().split(" ")[0] || "cliente";

    setIsSubmitting(true);

    window.setTimeout(() => {
      router.push(`/boas-vindas?nome=${encodeURIComponent(firstName)}&plano=${selectedPlan.slug}`);
    }, 700);
  }

  return (
    <section className="checkout-layout">
      <aside className="order-panel">
        <span className="section-kicker">Resumo do pedido</span>
        <h2>Send Inteligente</h2>

        <div className="checkout-plan-picker" aria-label="Alterar plano">
          <span>Período de cobrança</span>
          {plans.map((availablePlan) => (
            <label className="checkout-plan-choice" key={availablePlan.slug}>
              <input
                checked={selectedPlan.slug === availablePlan.slug}
                name="checkoutPlan"
                type="radio"
                value={availablePlan.slug}
                onChange={() => handlePlanChange(availablePlan.slug)}
              />
              <span className="checkout-plan-card">
                <strong>
                  {availablePlan.name}
                  <small>
                    {availablePlan.months > 1
                      ? `${formatCurrencyPrecise(monthlyEquivalent(availablePlan))} por mês`
                      : "valor cheio por mês"}
                  </small>
                </strong>
                <em>{formatCurrency(availablePlan.price)}</em>
              </span>
            </label>
          ))}
        </div>

        <div className="order-line">
          <span>Plano</span>
          <strong>{selectedPlan.name}</strong>
        </div>
        <div className="order-line">
          <span>Recorrência</span>
          <strong>{selectedPlan.period}</strong>
        </div>
        {saving > 0 ? (
          <div className="order-line">
            <span>Economia no período</span>
            <strong className="is-green">−{formatCurrency(saving)}</strong>
          </div>
        ) : null}
        <div className="order-line is-total">
          <span>Total hoje</span>
          <strong>{formatCurrency(selectedPlan.price)}</strong>
        </div>

        <div className="safe-box">
          <strong>
            <CheckIcon />
            Incluso na assinatura
          </strong>
          <span>
            Disparos pela API Oficial da Meta, listas e segmentação, templates, campanhas recorrentes, relatórios e
            ativação assistida do seu número.
          </span>
        </div>
      </aside>

      <form className="checkout-form" onSubmit={handleSubmit}>
        <h2>Seus dados</h2>

        <input type="hidden" name="plan" value={selectedPlan.slug} />
        <div className="form-grid">
          <label>
            Nome completo
            <input type="text" name="name" placeholder="Seu nome" autoComplete="name" required />
          </label>
          <label>
            E-mail
            <input type="email" name="email" placeholder="voce@email.com" autoComplete="email" required />
          </label>
          <label>
            WhatsApp
            <input type="tel" name="phone" placeholder="(11) 99999-9999" autoComplete="tel" required />
          </label>
          <label>
            Empresa
            <input type="text" name="company" placeholder="Nome da empresa" autoComplete="organization" />
          </label>
        </div>

        <div className="payment-toggle" aria-label="Forma de pagamento">
          {Object.entries(paymentLabels).map(([value, label]) => {
            const method = value as PaymentMethod;

            return (
              <label className="payment-choice" key={method}>
                <input
                  checked={payment === method}
                  name="paymentMethod"
                  type="radio"
                  value={method}
                  onChange={() => setPayment(method)}
                />
                <span>{label}</span>
              </label>
            );
          })}
        </div>

        <button className="primary-button large full-width" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Confirmando pagamento..." : `Assinar por ${formatCurrency(selectedPlan.price)}`}
          {isSubmitting ? null : <ArrowRightIcon />}
        </button>

        <div className="trust-row">
          <span>
            <LockIcon />
            Pagamento processado pelo Asaas
          </span>
          <span>
            <ShieldIcon />
            Seus dados não são compartilhados
          </span>
        </div>

        <p className="fine-print">A confirmação do pagamento libera a sequência de boas-vindas e a ativação.</p>
      </form>
    </section>
  );
}
