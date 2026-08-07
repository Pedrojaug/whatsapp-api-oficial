"use client";

import { useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { ArrowRightIcon, BagIcon, CheckIcon, ShieldCheckIcon } from "@/components/icons";
import { formatCurrency, plans } from "@/lib/plans";

type CheckoutFormProps = {
  initialPlanSlug?: string;
};

export function CheckoutForm({ initialPlanSlug = "trimestral" }: CheckoutFormProps) {
  const [selectedPlanSlug, setSelectedPlanSlug] = useState(
    plans.some((p) => p.slug === initialPlanSlug) ? initialPlanSlug : "trimestral"
  );
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "cartao">("pix");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedPlan = plans.find((p) => p.slug === selectedPlanSlug) || plans[1];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Redirecionamento simulação do checkout Asaas / Boas-Vindas
    setTimeout(() => {
      window.location.href = `/boas-vindas?plano=${selectedPlan.slug}&pagamento=${paymentMethod}`;
    }, 1200);
  };

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
          <form className="checkout-form-box" onSubmit={handleSubmit}>
            <div className="form-header">
              <h2>Finalize sua Assinatura</h2>
              <p>Preencha os dados do responsável da conta comercial.</p>
            </div>

            <div className="form-group">
              <label htmlFor="name">Nome Completo</label>
              <input id="name" type="text" placeholder="Seu nome completo" required className="form-input" />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="email">E-mail Corporativo</label>
                <input id="email" type="email" placeholder="seu@empresa.com.br" required className="form-input" />
              </div>

              <div className="form-group">
                <label htmlFor="whatsapp">WhatsApp Comercial</label>
                <input id="whatsapp" type="tel" placeholder="(11) 99999-9999" required className="form-input" />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="document">CPF ou CNPJ</label>
              <input id="document" type="text" placeholder="000.000.000-00" required className="form-input" />
            </div>

            {/* SELEÇÃO DE FORMA DE PAGAMENTO */}
            <div className="form-group">
              <label>Forma de Pagamento (Asaas)</label>
              <div className="payment-toggle">
                <button
                  type="button"
                  className={`toggle-btn ${paymentMethod === "pix" ? "active" : ""}`}
                  onClick={() => setPaymentMethod("pix")}
                >
                  ⚡ Pix (Aprovação Imediata)
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${paymentMethod === "cartao" ? "active" : ""}`}
                  onClick={() => setPaymentMethod("cartao")}
                >
                  💳 Cartão de Crédito
                </button>
              </div>
            </div>

            <button className="primary-button full-width large glowing" type="submit" disabled={isSubmitting}>
              <BagIcon />
              {isSubmitting ? "Processando no Asaas..." : `Concluir Pagamento de ${formatCurrency(selectedPlan.price)}`}
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
                  <div className="mini-plan-info">
                    <strong>{p.name}</strong>
                    <span>{formatCurrency(p.price)} {p.period}</span>
                  </div>
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
              <li><CheckIcon /> Links Rastreáveis com `/t/`</li>
              <li><CheckIcon /> API Keys & Webhooks n8n</li>
              <li><CheckIcon /> Suporte via WhatsApp</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
