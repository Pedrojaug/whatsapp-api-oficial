"use client";

import { useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { AlertIcon, BagIcon, CheckIcon, ShieldCheckIcon } from "@/components/icons";
import { formatCurrency, plans } from "@/lib/plans";
import {
  maskDocument,
  maskPhone,
  validateCheckout,
  type CheckoutErrors,
  type CheckoutFields,
} from "@/lib/forms";

type CheckoutFormProps = {
  initialPlanSlug?: string;
};

const EMPTY_FIELDS: CheckoutFields = {
  name: "",
  email: "",
  whatsapp: "",
  document: "",
  acceptedTerms: false,
};

export function CheckoutForm({ initialPlanSlug = "trimestral" }: CheckoutFormProps) {
  const [selectedPlanSlug, setSelectedPlanSlug] = useState(
    plans.some((p) => p.slug === initialPlanSlug) ? initialPlanSlug : "trimestral"
  );
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "cartao">("pix");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fields, setFields] = useState<CheckoutFields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [showErrors, setShowErrors] = useState(false);

  const selectedPlan = plans.find((p) => p.slug === selectedPlanSlug) || plans[1];

  const setField = <K extends keyof CheckoutFields>(key: K, value: CheckoutFields[K]) => {
    const next = { ...fields, [key]: value };
    setFields(next);
    // Depois da primeira tentativa, revalida a cada tecla para o erro sumir sozinho.
    if (showErrors) setErrors(validateCheckout(next));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const found = validateCheckout(fields);
    setErrors(found);
    setShowErrors(true);

    if (Object.keys(found).length > 0) {
      const first = document.querySelector<HTMLElement>("[data-invalid='true']");
      first?.scrollIntoView({ block: "center", behavior: "smooth" });
      first?.focus({ preventScroll: true });
      return;
    }

    setIsSubmitting(true);

    // TODO(asaas): substituir pela criação real da cobrança na API do Asaas.
    // Hoje isto apenas simula a ida ao gateway e redireciona.
    setTimeout(() => {
      window.location.href = `/boas-vindas?plano=${selectedPlan.slug}&pagamento=${paymentMethod}`;
    }, 1200);
  };

  const fieldError = (key: keyof CheckoutFields) => (showErrors ? errors[key] : undefined);

  return (
    <div className="checkout-wrapper">
      <header className="site-header">
        <Brand />
        <Link className="secondary-button compact" href="/">
          ← Voltar para a Oferta
        </Link>
      </header>

      <div className="checkout-container">
        <div className="checkout-grid">
          {/* FORMULÁRIO DE PAGAMENTO */}
          <form className="checkout-form-box" onSubmit={handleSubmit} noValidate>
            <div className="form-header">
              <h2>Finalize sua Assinatura</h2>
              <p>Preencha os dados do responsável da conta comercial.</p>
            </div>

            <div className="form-group">
              <label htmlFor="name">Nome Completo</label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Seu nome completo"
                className={`form-input ${fieldError("name") ? "has-error" : ""}`}
                value={fields.name}
                onChange={(e) => setField("name", e.target.value)}
                aria-invalid={!!fieldError("name")}
                aria-describedby={fieldError("name") ? "error-name" : undefined}
                data-invalid={!!fieldError("name")}
              />
              {fieldError("name") ? (
                <p className="field-error" id="error-name" role="alert">
                  <AlertIcon /> {fieldError("name")}
                </p>
              ) : null}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="email">E-mail Corporativo</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="seu@empresa.com.br"
                  className={`form-input ${fieldError("email") ? "has-error" : ""}`}
                  value={fields.email}
                  onChange={(e) => setField("email", e.target.value)}
                  aria-invalid={!!fieldError("email")}
                  aria-describedby={fieldError("email") ? "error-email" : undefined}
                  data-invalid={!!fieldError("email")}
                />
                {fieldError("email") ? (
                  <p className="field-error" id="error-email" role="alert">
                    <AlertIcon /> {fieldError("email")}
                  </p>
                ) : null}
              </div>

              <div className="form-group">
                <label htmlFor="whatsapp">WhatsApp Comercial</label>
                <input
                  id="whatsapp"
                  name="whatsapp"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="(11) 99999-9999"
                  className={`form-input ${fieldError("whatsapp") ? "has-error" : ""}`}
                  value={fields.whatsapp}
                  onChange={(e) => setField("whatsapp", maskPhone(e.target.value))}
                  aria-invalid={!!fieldError("whatsapp")}
                  aria-describedby={fieldError("whatsapp") ? "error-whatsapp" : undefined}
                  data-invalid={!!fieldError("whatsapp")}
                />
                {fieldError("whatsapp") ? (
                  <p className="field-error" id="error-whatsapp" role="alert">
                    <AlertIcon /> {fieldError("whatsapp")}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="document">CPF ou CNPJ</label>
              <input
                id="document"
                name="document"
                type="text"
                inputMode="numeric"
                placeholder="000.000.000-00"
                className={`form-input ${fieldError("document") ? "has-error" : ""}`}
                value={fields.document}
                onChange={(e) => setField("document", maskDocument(e.target.value))}
                aria-invalid={!!fieldError("document")}
                aria-describedby={fieldError("document") ? "error-document" : undefined}
                data-invalid={!!fieldError("document")}
              />
              {fieldError("document") ? (
                <p className="field-error" id="error-document" role="alert">
                  <AlertIcon /> {fieldError("document")}
                </p>
              ) : null}
            </div>

            {/* SELEÇÃO DE FORMA DE PAGAMENTO */}
            <div className="form-group">
              <span id="payment-label" className="payment-group-label">
                Forma de Pagamento (Asaas)
              </span>
              <div className="payment-toggle" role="radiogroup" aria-labelledby="payment-label">
                <button
                  type="button"
                  role="radio"
                  aria-checked={paymentMethod === "pix"}
                  className={`toggle-btn ${paymentMethod === "pix" ? "active" : ""}`}
                  onClick={() => setPaymentMethod("pix")}
                >
                  ⚡ Pix (Aprovação Imediata)
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={paymentMethod === "cartao"}
                  className={`toggle-btn ${paymentMethod === "cartao" ? "active" : ""}`}
                  onClick={() => setPaymentMethod("cartao")}
                >
                  💳 Cartão de Crédito
                </button>
              </div>
            </div>

            {/* ACEITE DOS TERMOS */}
            <div className="form-group">
              <label className="terms-consent" htmlFor="acceptedTerms">
                <input
                  id="acceptedTerms"
                  name="acceptedTerms"
                  type="checkbox"
                  checked={fields.acceptedTerms}
                  onChange={(e) => setField("acceptedTerms", e.target.checked)}
                  aria-invalid={!!fieldError("acceptedTerms")}
                  aria-describedby={fieldError("acceptedTerms") ? "error-terms" : undefined}
                  data-invalid={!!fieldError("acceptedTerms")}
                />
                <span>
                  Li e aceito os{" "}
                  <Link href="/termos-e-condicoes" target="_blank">
                    Termos e Condições
                  </Link>{" "}
                  e a{" "}
                  <Link href="/politica-de-privacidade" target="_blank">
                    Política de Privacidade
                  </Link>
                  , e autorizo a cobrança recorrente do plano selecionado.
                </span>
              </label>
              {fieldError("acceptedTerms") ? (
                <p className="field-error" id="error-terms" role="alert">
                  <AlertIcon /> {fieldError("acceptedTerms")}
                </p>
              ) : null}
            </div>

            <button className="primary-button full-width large glowing" type="submit" disabled={isSubmitting}>
              <BagIcon />
              {isSubmitting
                ? "Processando no Asaas..."
                : `Concluir Pagamento de ${formatCurrency(selectedPlan.price)}`}
            </button>

            <div className="security-notice">
              <ShieldCheckIcon />
              <span>Ambiente de checkout 100% criptografado e seguro.</span>
            </div>
          </form>

          {/* RESUMO DO PEDIDO */}
          <div className="order-summary-box">
            <h3>Resumo do Pedido</h3>

            <div className="plan-selector-mini">
              {plans.map((p) => (
                <label key={p.slug} className={`mini-plan-choice ${selectedPlanSlug === p.slug ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="plan-choice"
                    value={p.slug}
                    checked={selectedPlanSlug === p.slug}
                    onChange={() => setSelectedPlanSlug(p.slug)}
                  />
                  <span className="mini-plan-info">
                    <strong>{p.name}</strong>
                    <span>
                      {formatCurrency(p.price)} {p.period}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <div className="summary-details">
              <div className="summary-row">
                <span>Plano Selecionado:</span>
                <strong>{selectedPlan.name}</strong>
              </div>
              <div className="summary-row">
                <span>Ativação do Painel:</span>
                <strong className="green-text">Imediata</strong>
              </div>
              <div className="summary-row total">
                <span>Total Hoje:</span>
                <strong>{formatCurrency(selectedPlan.price)}</strong>
              </div>
            </div>

            <ul className="summary-features">
              <li><CheckIcon /> Conexão Meta Cloud API v19</li>
              <li>
                <CheckIcon /> Links rastreáveis com <code className="inline-code">/t/</code>
              </li>
              <li><CheckIcon /> API Keys & Webhooks n8n</li>
              <li><CheckIcon /> Suporte via WhatsApp</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
