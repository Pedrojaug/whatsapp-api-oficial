import Link from "next/link";
import { Brand } from "@/components/Brand";
import { Highlight } from "@/components/Highlight";
import { MotionLayer } from "@/components/MotionLayer";
import { ProductShowcase } from "@/components/ProductShowcase";
import { SiteFooter } from "@/components/SiteFooter";
import {
  AlertIcon,
  ArrowRightIcon,
  BoltIcon,
  CalendarIcon,
  ChartIcon,
  CheckIcon,
  CloseIcon,
  CodeIcon,
  LinkIcon,
  ListIcon,
  LockIcon,
  MessageIcon,
  PlusIcon,
  QuoteIcon,
  ShieldIcon,
  SparkleIcon,
} from "@/components/icons";
import {
  formatCurrency,
  formatCurrencyPrecise,
  monthlyEquivalent,
  plans,
  savingsAmount,
  savingsPercent,
} from "@/lib/plans";
import type { SiteContent } from "@/lib/site-content";

type SalesLandingProps = {
  content: SiteContent;
};

const painPoints = [
  {
    title: "O número cai sem aviso",
    description: "API não oficial viola os termos da Meta. O bloqueio leva junto o histórico e o canal inteiro.",
  },
  {
    title: "Ninguém sabe o que foi enviado",
    description: "Celular e planilha não deixam registro. Você não sabe quem recebeu, quem leu nem quem respondeu.",
  },
  {
    title: "A base vira risco jurídico",
    description: "Sem opt-out registrado, quem pediu para sair continua recebendo. Sob a LGPD, isso é exposição direta.",
  },
];

const steps = [
  {
    title: "Conecte seu número oficial",
    description: "Pareamento pelo login do Facebook ou por chaves manuais. Seu token fica criptografado.",
    icon: <ShieldIcon />,
  },
  {
    title: "Traga suas listas",
    description: "CSV com detecção automática de colunas, tags e segmentação por origem ou etapa comercial.",
    icon: <ListIcon />,
  },
  {
    title: "Monte o template",
    description: "Cabeçalho com mídia, variáveis, rodapé e botões — com simulador do WhatsApp em tempo real.",
    icon: <MessageIcon />,
  },
  {
    title: "Dispare e acompanhe",
    description: "A fila processa em segundo plano, reenvia sozinha e mostra entregue, lido e clicado.",
    icon: <ChartIcon />,
  },
];

const features = [
  {
    title: "Templates com mídia e botões",
    description: "Cabeçalho de imagem ou vídeo, variáveis, rodapé e botões — com prévia fiel.",
    icon: <MessageIcon />,
  },
  {
    title: "Campanhas recorrentes",
    description: "Disparo único ou recorrente: diário, semanal ou mensal.",
    icon: <CalendarIcon />,
  },
  {
    title: "Opt-out automático (LGPD)",
    description: "Quem responde “SAIR” entra na lista de exclusão por webhook, sozinho.",
    icon: <LockIcon />,
  },
  {
    title: "Rastreamento de links",
    description: "URLs curtas com contagem de cliques em tempo real.",
    icon: <LinkIcon />,
  },
  {
    title: "API pública",
    description: "Chave Bearer para disparar e consultar status. Integra com CRM e n8n.",
    icon: <CodeIcon />,
  },
  {
    title: "Relatórios e exportação",
    description: "Métricas por período em gráfico e histórico exportável em XLSX.",
    icon: <ChartIcon />,
  },
  {
    title: "Fila com reenvio automático",
    description: "Falha temporária entra em nova tentativa antes de virar erro.",
    icon: <BoltIcon />,
  },
  {
    title: "Vários números na mesma conta",
    description: "Cada número é um ambiente isolado, com listas e relatórios próprios.",
    icon: <SparkleIcon />,
  },
];

const comparison = [
  { label: "Número protegido contra bloqueio", official: true, unofficial: false, manual: true },
  { label: "Suporte e respaldo da Meta", official: true, unofficial: false, manual: true },
  { label: "Envio em escala", official: true, unofficial: true, manual: false },
  { label: "Templates aprovados previamente", official: true, unofficial: false, manual: false },
  { label: "Opt-out automático registrado", official: true, unofficial: false, manual: false },
  { label: "Métricas de entrega e leitura", official: true, unofficial: false, manual: false },
  { label: "Histórico central da operação", official: true, unofficial: false, manual: false },
];

/**
 * Todo `label` do comparativo é escrito no sentido positivo ("tem", "protege",
 * "registra"). Assim `value === true` é sempre a coluna vencedora e não existe
 * inversão de leitura: verde é bom em todas as linhas, sem exceção.
 */
function ComparisonCell({ value, label, column }: { value: boolean; label: string; column: string }) {
  return (
    <td className={value ? "is-good" : "is-bad"}>
      <span className="cell-mark">{value ? <CheckIcon /> : <CloseIcon />}</span>
      <span className="visually-hidden">{`${label}: ${value ? "sim" : "não"} — ${column}`}</span>
    </td>
  );
}

export function SalesLanding({ content }: SalesLandingProps) {
  const featuredPlan = plans.find((plan) => plan.featured) ?? plans[0];
  const checkoutHref = `/checkout?plano=${featuredPlan.slug}`;

  return (
    <>
      <MotionLayer />
      <div className="scroll-progress" aria-hidden="true" />

      {content.announcement ? (
        <div className="announcement-bar">
          <SparkleIcon />
          <span>{content.announcement}</span>
        </div>
      ) : null}

      <header className="site-header">
        <Brand />

        <nav className="public-nav" aria-label="Navegação principal">
          <a href="#como-funciona">Como funciona</a>
          <a href="#recursos">Recursos</a>
          <a href="#planos">Planos</a>
          <a href="#duvidas">Dúvidas</a>
        </nav>

        <div className="header-actions">
          <Link className="ghost-link" href="/admin">
            Área ADM
          </Link>
          <Link className="primary-button compact" href={checkoutHref}>
            {content.primaryCta}
            <ArrowRightIcon />
          </Link>
        </div>
      </header>

      <main className="sales-page">
        <section className="hero" id="inicio">
          <div className="hero-aurora" aria-hidden="true" />
          <div className="hero-grid-lines" aria-hidden="true" />

          <div className="hero-inner">
            <div className="hero-copy">
              <span className="pill success">
                <CheckIcon />
                {content.heroBadge}
              </span>

              <h1>
                <Highlight text={content.heroTitle} />
              </h1>

              <p className="hero-lead">{content.heroDescription}</p>

              <div className="hero-actions">
                <Link className="primary-button large" href={checkoutHref}>
                  {content.primaryCta}
                  <ArrowRightIcon />
                </Link>
                <a className="secondary-button large" href="#como-funciona">
                  {content.secondaryCta}
                </a>
              </div>

              <ul className="proof-strip">
                {content.proofItems.map((item, index) => (
                  <li key={`proof-${index}`}>
                    <CheckIcon />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <ProductShowcase campaign={content.previewCampaign} templateMessage={content.templateMessage} />
          </div>
        </section>

        <section className="metrics-band" aria-label={content.socialProofLabel}>
          <span className="band-label">{content.socialProofLabel}</span>
          <div className="metrics-row">
            {content.metrics.map((metric, index) => (
              <div key={`metric-${index}`}>
                <strong data-count={metric.value}>{metric.value}</strong>
                <span>{metric.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="section pain-section">
          <div className="section-head">
            <span className="section-kicker">O problema</span>
            <h2>Disparar no WhatsApp virou um jogo de risco.</h2>
            <p>Funciona — até o dia em que para de funcionar.</p>
          </div>

          <div className="pain-grid">
            {painPoints.map((pain) => (
              <article key={pain.title}>
                <span className="pain-mark" aria-hidden="true">
                  <AlertIcon />
                </span>
                <h3>{pain.title}</h3>
                <p>{pain.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section steps-section" id="como-funciona">
          <div className="section-head">
            <span className="section-kicker">Como funciona</span>
            <h2>Do número conectado à primeira campanha, em quatro passos.</h2>
            <p>Sem conhecimento técnico. A gente acompanha cada etapa.</p>
          </div>

          <ol className="steps-grid" data-spotlight>
            {steps.map((step, index) => (
              <li key={step.title}>
                <span className="step-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="step-icon">{step.icon}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="section features-section" id="recursos">
          <div className="section-head">
            <span className="section-kicker">Recursos</span>
            <h2>Tudo que a campanha precisa, dentro do mesmo painel.</h2>
            <p>Sem juntar cinco ferramentas para disparar, medir e cumprir a LGPD.</p>
          </div>

          <div className="features-grid" data-spotlight>
            {features.map((feature) => (
              <article key={feature.title}>
                <span className="feature-icon">{feature.icon}</span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section comparison-section">
          <div className="section-head">
            <span className="section-kicker">Comparativo</span>
            <h2>Três formas de disparar. Uma que não coloca o número na mesa.</h2>
            <p>O custo da API não oficial não aparece na fatura. Aparece no dia do bloqueio.</p>
          </div>

          <div className="comparison-wrap">
            <table className="comparison-table">
              <caption className="visually-hidden">
                Comparação entre Send Inteligente pela API Oficial, APIs não oficiais e envio manual
              </caption>
              <thead>
                <tr>
                  <th scope="col">Recurso</th>
                  <th className="col-featured" scope="col">
                    <strong>Send Inteligente</strong>
                    <small>API Oficial</small>
                  </th>
                  <th scope="col">
                    <strong>API não oficial</strong>
                    <small>“robôs” de WhatsApp</small>
                  </th>
                  <th scope="col">
                    <strong>Envio manual</strong>
                    <small>celular e planilha</small>
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <ComparisonCell column="Send Inteligente" label={row.label} value={row.official} />
                    <ComparisonCell column="API não oficial" label={row.label} value={row.unofficial} />
                    <ComparisonCell column="Envio manual" label={row.label} value={row.manual} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="section testimonials-section">
          <div className="section-head">
            <span className="section-kicker">Quem usa</span>
            <h2>Resultado de quem trocou o improviso pela estrutura.</h2>
          </div>

          <div className="testimonials-grid">
            {content.testimonials.map((testimonial, index) => (
              <figure key={`testimonial-${index}`}>
                <QuoteIcon />
                <blockquote>{testimonial.quote}</blockquote>
                <figcaption>
                  <strong>{testimonial.author}</strong>
                  <span>{testimonial.role}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="section pricing-section" id="planos">
          <div className="section-head">
            <span className="section-kicker">{content.offerKicker}</span>
            <h2>{content.offerTitle}</h2>
            <p>{content.offerDescription}</p>
          </div>

          <div className="pricing-grid">
            {plans.map((plan) => {
              const saving = savingsAmount(plan);
              const percent = savingsPercent(plan);

              return (
                <article className={`price-card${plan.featured ? " is-featured" : ""}`} key={plan.slug}>
                  {plan.badge ? <span className="price-badge">{plan.badge}</span> : null}

                  <h3>{plan.name}</h3>

                  <div className="price-value">
                    <strong>{formatCurrency(plan.price)}</strong>
                    <span>{plan.period}</span>
                  </div>

                  {plan.months > 1 ? (
                    <p className="price-equivalent">
                      equivale a <strong>{formatCurrencyPrecise(monthlyEquivalent(plan))}</strong> por mês
                    </p>
                  ) : (
                    <p className="price-equivalent">valor cheio por mês</p>
                  )}

                  {saving > 0 ? (
                    <span className="price-saving">
                      economize {formatCurrency(saving)} ({percent}%)
                    </span>
                  ) : (
                    <span className="price-saving is-muted">plano de referência</span>
                  )}

                  <p className="price-note">{plan.note}</p>

                  <Link
                    className={`${plan.featured ? "primary-button" : "secondary-button"} full-width`}
                    href={`/checkout?plano=${plan.slug}`}
                  >
                    Assinar {plan.name.toLowerCase()}
                    <ArrowRightIcon />
                  </Link>
                </article>
              );
            })}
          </div>

          <div className="inclusion-panel">
            <div>
              <span className="section-kicker">Incluso em qualquer plano</span>
              <h3>Ativação assistida, do zero à primeira campanha.</h3>
            </div>
            <ul className="inclusion-list">
              {content.inclusions.map((item, index) => (
                <li key={`inclusion-${index}`}>
                  <CheckIcon />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {content.guarantee ? (
            <aside className="guarantee-card">
              <span className="guarantee-mark" aria-hidden="true">
                <ShieldIcon />
              </span>
              <div>
                <strong>Nosso compromisso</strong>
                <p>{content.guarantee}</p>
              </div>
            </aside>
          ) : null}
        </section>

        <section className="section faq-section" id="duvidas">
          <div className="section-head">
            <span className="section-kicker">Dúvidas frequentes</span>
            <h2>O que costuma travar a decisão.</h2>
          </div>

          <div className="faq-list">
            {content.faq.map((item, index) => (
              <details key={`faq-${index}`}>
                <summary>
                  <span>{item.question}</span>
                  <span className="faq-toggle" aria-hidden="true">
                    <PlusIcon />
                  </span>
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="final-cta">
          <div className="final-cta-inner">
            <span className="pill success">
              <BoltIcon />
              Ativação assistida incluída
            </span>
            <h2>{content.finalCtaTitle}</h2>
            <p>{content.finalCtaDescription}</p>

            <div className="hero-actions centered-actions">
              <Link className="primary-button large" href={checkoutHref}>
                {content.primaryCta}
                <ArrowRightIcon />
              </Link>
              <a className="secondary-button large" href="#planos">
                Comparar planos
              </a>
            </div>

            <p className="fine-print">
              Pagamento seguro via Asaas · Pix, cartão ou boleto · A ativação começa após a confirmação.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
