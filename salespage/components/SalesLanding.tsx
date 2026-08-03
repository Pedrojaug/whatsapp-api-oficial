import Link from "next/link";
import { Brand } from "@/components/Brand";
import { ArrowRightIcon, BagIcon, ChartIcon, CheckIcon, ListIcon, MessageIcon } from "@/components/icons";
import { formatCurrency, plans } from "@/lib/plans";
import type { SiteContent } from "@/lib/site-content";

type SalesLandingProps = {
  content: SiteContent;
};

export function SalesLanding({ content }: SalesLandingProps) {
  const defaultPlan = plans[0];

  return (
    <main>
      <header className="site-header">
        <Brand />

        <nav className="public-nav" aria-label="Navegação da oferta">
          <a href="#beneficios">Benefícios</a>
          <a href="#oferta">Oferta</a>
          <Link href="/admin">Área ADM</Link>
        </nav>

        <Link className="primary-button compact" href={`/checkout?plano=${defaultPlan.slug}`}>
          <BagIcon />
          Assinar
        </Link>
      </header>

      <div className="sales-page">
        <section className="hero-section" id="oferta">
          <div className="hero-copy">
            {content.announcement ? <span className="announcement-pill">{content.announcement}</span> : null}

            <span className="pill success">
              <CheckIcon />
              {content.heroBadge}
            </span>
            <h1>{content.heroTitle}</h1>
            <p>{content.heroDescription}</p>

            <div className="hero-actions">
              <Link className="primary-button" href={`/checkout?plano=${defaultPlan.slug}`}>
                <ArrowRightIcon />
                {content.primaryCta}
              </Link>
              <a className="secondary-button" href="#beneficios">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 5v14" />
                  <path d="m19 12-7 7-7-7" />
                </svg>
                {content.secondaryCta}
              </a>
            </div>

            <div className="proof-strip" aria-label="Diferenciais principais">
              {content.proofItems.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>

          <div className="product-preview" aria-label="Prévia visual do Send Inteligente">
            <div className="preview-topbar">
              <span>Campanha ativa</span>
              <strong>{content.previewCampaign}</strong>
            </div>
            <div className="preview-metrics">
              <div>
                <span>Disparados</span>
                <strong>1.284</strong>
              </div>
              <div>
                <span>Entregues</span>
                <strong>1.197</strong>
              </div>
              <div>
                <span>Lidos</span>
                <strong>642</strong>
              </div>
            </div>
            <div className="composer-preview">
              <div className="template-header">
                <span className="status-dot" />
                Template Meta aprovado
              </div>
              <p>{content.templateMessage}</p>
              <button type="button">Enviar campanha</button>
            </div>
            <div className="mini-bars" aria-hidden="true">
              <span style={{ height: "36%" }} />
              <span style={{ height: "58%" }} />
              <span style={{ height: "44%" }} />
              <span style={{ height: "76%" }} />
              <span style={{ height: "62%" }} />
              <span style={{ height: "88%" }} />
            </div>
          </div>
        </section>

        <section className="benefit-section" id="beneficios">
          <article>
            <MessageIcon />
            <h2>Envios pela API Oficial</h2>
            <p>Use estrutura profissional para campanhas no WhatsApp com templates da Meta.</p>
          </article>
          <article>
            <ListIcon />
            <h2>Listas segmentadas</h2>
            <p>Organize contatos por origem, interesse, etapa comercial e status da compra.</p>
          </article>
          <article>
            <ChartIcon />
            <h2>Métricas de entrega</h2>
            <p>Acompanhe disparados, enviados, entregues, lidos e falhas sem planilha paralela.</p>
          </article>
        </section>

        <section className="offer-card">
          <div className="offer-content">
            <span className="section-kicker">{content.offerKicker}</span>
            <h2>{content.offerTitle}</h2>
            <p>{content.offerDescription}</p>

            <div className="inclusion-list">
              {content.inclusions.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>

          <form className="pricing-panel" action="/checkout" method="get">
            <div className="plan-options" aria-label="Planos disponíveis">
              {plans.map((plan, index) => (
                <label className="plan-choice" key={plan.slug}>
                  <input name="plano" type="radio" value={plan.slug} defaultChecked={index === 0} />
                  <span className="plan-option">
                    <span>{plan.name}</span>
                    <strong>{formatCurrency(plan.price)}</strong>
                  </span>
                </label>
              ))}
            </div>

            <div className="price-summary">
              <span>Escolha seu plano</span>
              <strong>Mensal, trimestral ou anual</strong>
              <small>O plano selecionado será enviado ao checkout.</small>
            </div>

            <button className="primary-button full-width" type="submit">
              <ArrowRightIcon />
              Ir para o checkout
            </button>
            <p className="fine-print">Pagamento seguro via Asaas. A ativação começa após a confirmação.</p>
          </form>
        </section>
      </div>
    </main>
  );
}
