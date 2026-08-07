"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import dashboardPreview from "@/public/dashboard-preview.png";
import {
  ArrowRightIcon,
  ChartIcon,
  CheckIcon,
  ChevronDownIcon,
  CpuIcon,
  CrossIcon,
  LinkIcon,
  ListIcon,
  MenuIcon,
  MessageIcon,
  QuoteIcon,
  ShieldCheckIcon,
  ZapIcon,
} from "@/components/icons";
import { plans } from "@/lib/plans";
import type { SiteContent } from "@/lib/site-content";

/* -------------------------------------------------------------------------
 * Prova social.
 *
 * O texto de exemplo continua aqui de propósito, servindo de instrução para
 * quem for preencher — mas a landing NÃO publica nada disso: isPlaceholder()
 * filtra na renderização e a seção inteira some enquanto não houver dado real.
 *
 * Marcador de exemplo no ar converte pior que a ausência da seção, e inventar
 * número ou depoimento seria prova social falsa. Abordagem portada do commit
 * 6bf1aed (branch feat/salespage-redesign).
 * ---------------------------------------------------------------------- */
function isPlaceholder(value: string | undefined) {
  return /\[\s*(EXEMPLO|SUBSTITUIR|N[ÚU]MERO|Nome|Cargo|Empresa|Mensagens|Empresas|Taxa|Campanhas)/i.test(
    value ?? ""
  );
}

const TESTIMONIALS = [
  {
    quote:
      "[EXEMPLO] Substituir por depoimento real de cliente, descrevendo o problema antes da contratação e o resultado obtido.",
    name: "[Nome do cliente]",
    role: "[Cargo] • [Empresa]",
    initials: "??",
  },
  {
    quote:
      "[EXEMPLO] Depoimentos com números concretos convertem mais. Ex.: quantas campanhas por mês, qual taxa de entrega, quanto tempo economizado.",
    name: "[Nome do cliente]",
    role: "[Cargo] • [Empresa]",
    initials: "??",
  },
  {
    quote:
      "[EXEMPLO] Vale incluir ao menos um depoimento que trate da migração de um disparador não oficial para a API da Meta.",
    name: "[Nome do cliente]",
    role: "[Cargo] • [Empresa]",
    initials: "??",
  },
];

const METRICS = [
  { value: "—", label: "[Mensagens entregues no total]" },
  { value: "—", label: "[Empresas usando a plataforma]" },
  { value: "—", label: "[Taxa média de entrega medida]" },
  { value: "—", label: "[Campanhas disparadas por mês]" },
];

const NAV_LINKS = [
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#recursos", label: "Recursos" },
  { href: "#anti-ban", label: "API Oficial vs Paralelas" },
  { href: "#planos", label: "Planos" },
  { href: "#faq", label: "Dúvidas" },
];

type SalesLandingProps = {
  content: SiteContent;
};

export function SalesLanding({ content }: SalesLandingProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [contactCount, setContactCount] = useState<number>(5000);
  const [menuOpen, setMenuOpen] = useState(false);

  // Trava o scroll do fundo e permite fechar o drawer com Esc.
  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const calculatedDeliveries = Math.floor(contactCount * 0.992);
  const calculatedReads = Math.floor(contactCount * 0.74);
  const calculatedClicks = Math.floor(contactCount * 0.31);

  const cheapestMonthly = Math.min(
    ...plans.map((p) => p.monthlyEquivalent ?? p.price)
  );

  // Só publica o que já foi preenchido de verdade.
  const testimonials = TESTIMONIALS.filter(
    (t) => !isPlaceholder(t.quote) && !isPlaceholder(t.name)
  );
  const metrics = METRICS.filter(
    (m) => !isPlaceholder(m.label) && m.value.trim() !== "" && m.value.trim() !== "—"
  );
  const hasSocialProof = testimonials.length > 0 || metrics.length > 0;

  return (
    <main className="main-wrapper" id="conteudo">
      {/* BARRA SUPERIOR DE ANÚNCIO */}
      <div className="top-announcement-bar">
        <span>⚡ Ativação assistida incluída — primeira campanha no ar esta semana.</span>
      </div>

      {/* HEADER DE ALTA CONVERSÃO */}
      <header className="site-header">
        <Brand />

        <nav className="public-nav" aria-label="Navegação da oferta">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="header-actions">
          <a
            className="login-link"
            href="https://app.sendinteligente.com.br"
            target="_blank"
            rel="noopener noreferrer"
          >
            Entrar no Painel
          </a>

          <a className="primary-button compact" href="#planos">
            <ZapIcon />
            Quero ativar minha conta
          </a>

          <button
            type="button"
            className="menu-toggle"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menu de navegação"
            aria-expanded={menuOpen}
          >
            <MenuIcon />
          </button>
        </div>
      </header>

      {/* DRAWER DE NAVEGAÇÃO MOBILE */}
      {menuOpen ? (
        <>
          <button
            type="button"
            className="drawer-overlay"
            onClick={() => setMenuOpen(false)}
            aria-label="Fechar menu"
            tabIndex={-1}
          />
          <div className="mobile-drawer" role="dialog" aria-modal="true" aria-label="Menu de navegação">
            <div className="drawer-header">
              <Brand />
              <button
                type="button"
                className="drawer-close"
                onClick={() => setMenuOpen(false)}
                aria-label="Fechar menu"
                autoFocus
              >
                <CrossIcon />
              </button>
            </div>

            <nav aria-label="Navegação principal">
              {NAV_LINKS.map((link) => (
                <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="drawer-footer">
              <a
                className="secondary-button"
                href="https://app.sendinteligente.com.br"
                target="_blank"
                rel="noopener noreferrer"
              >
                Entrar no Painel
              </a>
              <a className="primary-button" href="#planos" onClick={() => setMenuOpen(false)}>
                <ZapIcon />
                Ver planos
              </a>
            </div>
          </div>
        </>
      ) : null}

      <div className="sales-page">
        {/* HERO SECTION */}
        <section className="hero-section" id="hero">
          <div className="hero-copy">
            <span className="pill success">
              <ShieldCheckIcon />
              {content.heroBadge}
            </span>

            <h1>
              Dispare campanhas no WhatsApp <span className="highlight-green">sem arriscar o seu número</span>
            </h1>

            <p>
              Disparo em massa pela API Oficial da Meta: templates aprovados, campanhas recorrentes e opt-out automático para cumprir a LGPD.
            </p>

            <div className="hero-actions">
              <a className="primary-button glowing" href="#planos">
                <ArrowRightIcon />
                Quero ativar minha conta
              </a>
              <a className="secondary-button" href="#como-funciona">
                Ver como funciona
              </a>
            </div>

            <div className="proof-strip" aria-label="Diferenciais principais">
              <span className="proof-chip">✓ API Oficial da Meta</span>
              <span className="proof-chip">✓ Opt-out automático (LGPD)</span>
              <span className="proof-chip">✓ Suporte na ativação</span>
            </div>
          </div>

          {/* PRINT REAL DO DASHBOARD SEND INTELIGENTTE */}
          <div className="product-preview-frame" aria-label="Painel de Métricas Real do Send Inteligentte">
            <div className="window-topbar">
              <div className="window-dots">
                <span className="dot red" />
                <span className="dot yellow" />
                <span className="dot green" />
              </div>
              <div className="window-address-bar">
                <span className="lock-icon">🔒</span>
                <span>app.sendinteligente.com.br/metricas</span>
              </div>
              <div className="live-status-pill">
                <span className="pulse-dot" /> AO VIVO
              </div>
            </div>

            <div className="dashboard-img-wrapper">
              <Image
                src={dashboardPreview}
                alt="Painel de métricas do Send Inteligentte exibindo mensagens disparadas, entregues e lidas"
                className="dashboard-real-img"
                priority
                sizes="(max-width: 1100px) 100vw, 55vw"
                placeholder="blur"
              />
            </div>
          </div>
        </section>

        {/* PASSO A PASSO COMO FUNCIONA */}
        <section className="how-it-works-section" id="como-funciona">
          <div className="section-header">
            <span className="section-badge">Passo a Passo</span>
            <h2>Como funciona o Send Inteligentte</h2>
            <p>Do primeiro clique até o disparo em massa seguro e homologado.</p>
          </div>

          <div className="steps-grid">
            <div className="step-card">
              <span className="step-number">01</span>
              <div className="icon-wrapper green">
                <ShieldCheckIcon />
              </div>
              <h3>Conecte seu número oficial</h3>
              <p>Pareamento pelo login do Facebook ou por chaves manuais. Seu token fica criptografado.</p>
            </div>

            <div className="step-card">
              <span className="step-number">02</span>
              <div className="icon-wrapper cyan">
                <ListIcon />
              </div>
              <h3>Traga suas listas</h3>
              <p>CSV com detecção automática de colunas, tags e segmentação por origem ou etapa comercial.</p>
            </div>

            <div className="step-card">
              <span className="step-number">03</span>
              <div className="icon-wrapper purple">
                <MessageIcon />
              </div>
              <h3>Monte o template</h3>
              <p>Cabeçalho com mídia, variáveis, rodapé e botões — com simulador do WhatsApp em tempo real.</p>
            </div>

            <div className="step-card">
              <span className="step-number">04</span>
              <div className="icon-wrapper green">
                <ChartIcon />
              </div>
              <h3>Dispare e acompanhe</h3>
              <p>A fila processa em segundo plano, reenvia sozinha e mostra entregue, lido e clicado.</p>
            </div>
          </div>
        </section>

        {/* COMPARATIVO: API OFICIAL VS PARALELAS */}
        <section className="comparison-section" id="anti-ban">
          <div className="section-header">
            <span className="section-badge warning">Segurança da sua operação</span>
            <h2>API Oficial da Meta vs. Disparadores Paralelos</h2>
            <p>
              Não arrisque perder o número principal da sua empresa usando ferramentas não oficiais de automação por web scraping.
            </p>
          </div>

          <div className="comparison-grid">
            {/* PARALELAS */}
            <div className="comparison-card danger">
              <div className="card-header">
                <span className="status-badge danger">
                  <CrossIcon /> Alto Risco de Perda
                </span>
                <h3>Disparadores Paralelos / Baileys</h3>
                <p className="card-sub">Automação por QR Code e raspagem de tela</p>
              </div>

              <ul className="comparison-list">
                <li>
                  <CrossIcon /> <strong>Risco Elevado de Banimento:</strong> O WhatsApp detecta o padrão de uso e pode bloquear o chip permanentemente.
                </li>
                <li>
                  <CrossIcon /> <strong>Dependência do Celular:</strong> Se a bateria acabar ou a internet cair, a campanha para na hora.
                </li>
                <li>
                  <CrossIcon /> <strong>Limites Reduzidos:</strong> Bloqueios frequentes ao tentar enviar grandes volumes.
                </li>
                <li>
                  <CrossIcon /> <strong>Sem Métricas Oficiais:</strong> Você não sabe se a mensagem foi entregue ou bloqueada pela operadora.
                </li>
              </ul>
            </div>

            {/* SEND INTELIGENTTE (META OFICIAL) */}
            <div className="comparison-card success featured">
              <div className="featured-banner">CAMINHO HOMOLOGADO</div>
              <div className="card-header">
                <span className="status-badge success">
                  <ShieldCheckIcon /> Canal Oficial da Meta
                </span>
                <h3>Send Inteligentte (Cloud API v19)</h3>
                <p className="card-sub">Conexão nativa com a infraestrutura da Meta</p>
              </div>

              <ul className="comparison-list">
                <li>
                  <CheckIcon /> <strong>Sem Risco de Bloqueio por Automação:</strong> Os disparos seguem integralmente os Termos de Serviço da Meta.
                </li>
                <li>
                  <CheckIcon /> <strong>Totalmente em Nuvem:</strong> Funciona 24 horas por dia sem precisar de celular ligado.
                </li>
                <li>
                  <CheckIcon /> <strong>Alta Escala e Velocidade:</strong> Dispare milhares de mensagens por hora dentro dos limites da sua conta na Meta.
                </li>
                <li>
                  <CheckIcon /> <strong>Relatórios Oficiais Meta:</strong> Saiba exatamente quem recebeu, leu e clicou nas ofertas.
                </li>
                <li>
                  <CheckIcon /> <strong>Suporte ao Selo Verde:</strong> Elegível para o selo oficial de verificação de empresa.
                </li>
              </ul>
            </div>
          </div>

          <p className="calculator-disclaimer" style={{ marginTop: 20 }}>
            A API Oficial elimina o risco de bloqueio por automação não autorizada. A Meta ainda pode aplicar
            restrições por qualidade — por isso o opt-out automático e a curadoria de listas fazem parte da plataforma.
          </p>
        </section>

        {/* FEATURES GRID & RECURSOS */}
        <section className="benefit-section" id="recursos">
          <div className="section-header">
            <span className="section-badge">Superpoderes do Send</span>
            <h2>Tudo o que sua operação precisa para vender no WhatsApp</h2>
          </div>

          <div className="features-grid">
            <article className="feature-card">
              <div className="icon-wrapper green">
                <MessageIcon />
              </div>
              <h3>Meta Cloud API v19 Native</h3>
              <p>Dispare templates homologados diretamente pela infraestrutura da Meta com suporte a botões interativos e respostas rápidas.</p>
            </article>

            <article className="feature-card" id="link-tracker">
              <div className="icon-wrapper cyan">
                <LinkIcon />
              </div>
              <h3>Links Rastreáveis</h3>
              <p>
                Encurte links das campanhas com <code className="inline-code">/t/:shortCode</code> e acompanhe quais contatos clicaram no seu CTA em tempo real.
              </p>
            </article>

            <article className="feature-card" id="api-webhooks">
              <div className="icon-wrapper purple">
                <CpuIcon />
              </div>
              <h3>API Key & Webhooks n8n</h3>
              <p>
                API REST dedicada em <code className="inline-code">/api/v1</code> com templates de workflow de n8n para conectar Typebot, Make, HubSpot e CRMs.
              </p>
            </article>

            <article className="feature-card">
              <div className="icon-wrapper green">
                <ShieldCheckIcon />
              </div>
              <h3>Blacklist & Opt-out Automático</h3>
              <p>Filtro inteligente contra contatos que pedirem para sair da lista. Mantenha a reputação da sua conta impecável.</p>
            </article>

            <article className="feature-card">
              <div className="icon-wrapper cyan">
                <ListIcon />
              </div>
              <h3>Listas Segmentadas</h3>
              <p>Organize contatos por origem, estágio no funil de vendas, interesses ou histórico de compras.</p>
            </article>

            <article className="feature-card">
              <div className="icon-wrapper purple">
                <ChartIcon />
              </div>
              <h3>Métricas e Análises Vivas</h3>
              <p>Acompanhe disparados, entregues, lidos e taxa de conversão em tempo real sem depender de planilhas.</p>
            </article>
          </div>
        </section>

        {/* PROVA SOCIAL — some por inteiro enquanto não houver dado real */}
        {hasSocialProof ? (
          <section className="social-proof-section" id="clientes">
            <div className="section-header">
              <span className="section-badge success">Quem já usa</span>
              <h2>Operações que vendem no WhatsApp todo dia</h2>
            </div>

            {testimonials.length > 0 ? (
              <div className="social-proof-grid">
                {testimonials.map((t, i) => (
                  <figure className="testimonial-card" key={i}>
                    <div className="icon-wrapper cyan">
                      <QuoteIcon />
                    </div>
                    <blockquote className="testimonial-quote">{t.quote}</blockquote>
                    <figcaption className="testimonial-author">
                      <span className="author-avatar" aria-hidden="true">{t.initials}</span>
                      <span className="author-info">
                        <strong>{t.name}</strong>
                        <span>{t.role}</span>
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : null}

            {metrics.length > 0 ? (
              <div className="metrics-strip">
                {metrics.map((m) => (
                  <div className="metric-item" key={m.label}>
                    <strong>{m.value}</strong>
                    <span>{m.label}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {/* SIMULADOR INTERATIVO DE ROI / IMPACTO */}
        <section className="roi-calculator-section">
          <div className="calculator-box">
            <div className="calculator-header">
              <span className="section-kicker">Simulador de Impacto</span>
              <h2>Calcule o alcance da sua próxima campanha</h2>
              <p>Arraste o seletor abaixo e veja uma projeção de alcance com a API Oficial do Send Inteligentte.</p>
            </div>

            <div className="calculator-slider-container">
              <div className="slider-label">
                <label htmlFor="roi-slider">Tamanho da sua Lista de Contatos:</label>
                <strong>{contactCount.toLocaleString("pt-BR")} contatos</strong>
              </div>
              <input
                id="roi-slider"
                type="range"
                min="1000"
                max="50000"
                step="1000"
                value={contactCount}
                onChange={(e) => setContactCount(Number(e.target.value))}
                className="roi-slider"
                aria-valuetext={`${contactCount.toLocaleString("pt-BR")} contatos`}
              />
              <div className="slider-range-indicators">
                <span>1.000</span>
                <span>25.000</span>
                <span>50.000</span>
              </div>
            </div>

            <div className="calculator-results" aria-live="polite">
              <div className="result-card">
                <span>Mensagens Entregues</span>
                <strong>{calculatedDeliveries.toLocaleString("pt-BR")}</strong>
                <small className="result-sub">Alta prioridade na rede Meta</small>
              </div>

              <div className="result-card highlight">
                <span>Visualizações Estimadas</span>
                <strong>~{calculatedReads.toLocaleString("pt-BR")}</strong>
                <small className="result-sub">Taxa média de abertura no WhatsApp</small>
              </div>

              <div className="result-card">
                <span>Cliques na Oferta</span>
                <strong>~{calculatedClicks.toLocaleString("pt-BR")}</strong>
                <small className="result-sub">
                  Rastreável com <code className="inline-code">/t/:shortCode</code>
                </small>
              </div>
            </div>

            <p className="calculator-disclaimer">
              Projeção ilustrativa baseada em médias de mercado para campanhas via API Oficial. Os resultados variam
              conforme a qualidade da lista, o conteúdo do template e o segmento — não constituem garantia de desempenho.
            </p>
          </div>
        </section>

        {/* CARDS DE PLANOS & PREÇOS */}
        <section className="pricing-section" id="planos">
          <div className="section-header">
            <h2>Um plano só. Escolha a periodicidade.</h2>
            <p>Todo mundo recebe todos os recursos. Quanto maior o período, menor o valor por mês.</p>
          </div>

          <div className="plans-grid">
            {plans.map((plan) => (
              <div
                key={plan.slug}
                className={`plan-card ${plan.highlighted ? "highlighted" : ""}`}
              >
                {plan.badge ? <div className="plan-badge">{plan.badge}</div> : null}

                <div className="plan-header">
                  <h3>{plan.name.toUpperCase()}</h3>

                  <div className="plan-price-wrapper">
                    <span className="currency">R$</span>
                    <span className="price">{plan.price}</span>
                    <span className="period">{plan.period}</span>
                  </div>

                  {plan.monthlyEquivalent ? (
                    <div className="monthly-equivalent">
                      equivale a <strong>R$ {plan.monthlyEquivalent}/mês</strong>
                    </div>
                  ) : (
                    <div className="monthly-equivalent muted">valor cheio por mês</div>
                  )}
                </div>

                <ul className="plan-features">
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <CheckIcon />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  className={`primary-button full-width ${plan.highlighted ? "glowing" : "secondary-style"}`}
                  href={`/checkout?plano=${plan.slug}`}
                >
                  Assinar {plan.name.toLowerCase()} →
                </Link>

                <p className="fine-print">Sem fidelidade. Cancele quando quiser.</p>
              </div>
            ))}
          </div>

          {/* BOX INCLUSO EM QUALQUER PLANO */}
          <div className="inclusions-banner-box">
            <div className="banner-left">
              <span className="section-kicker green-text">INCLUSO EM QUALQUER PLANO</span>
              <h3>Ativação assistida, do zero à primeira campanha.</h3>
            </div>
            <div className="banner-right">
              <ul>
                <li><CheckIcon /> Configuração assistida do número oficial</li>
                <li><CheckIcon /> Importação e organização das suas listas</li>
                <li><CheckIcon /> Criação dos primeiros templates Meta</li>
                <li><CheckIcon /> Acompanhamento na primeira campanha</li>
              </ul>
            </div>
          </div>
        </section>

        {/* PERGUNTAS FREQUENTES (FAQ ACCORDION INTERATIVO) */}
        <section className="faq-section" id="faq">
          <div className="section-header">
            <span className="section-badge">Tire suas Dúvidas</span>
            <h2>Perguntas Frequentes</h2>
            <p>Tudo o que você precisa saber sobre a API Oficial e a plataforma Send Inteligentte.</p>
          </div>

          <div className="faq-accordion">
            {(content.faqs ?? []).map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={faq.question} className={`faq-item ${isOpen ? "is-open" : ""}`}>
                  <h3>
                    <button
                      type="button"
                      className="faq-question"
                      onClick={() => toggleFaq(index)}
                      aria-expanded={isOpen}
                      aria-controls={`faq-answer-${index}`}
                      id={`faq-question-${index}`}
                    >
                      <span>{faq.question}</span>
                      <span className="chevron-icon">
                        <ChevronDownIcon />
                      </span>
                    </button>
                  </h3>

                  {/* Permanece no DOM mesmo fechado: permite animar, Ctrl+F e indexação. */}
                  <div
                    className="faq-answer-wrap"
                    id={`faq-answer-${index}`}
                    role="region"
                    aria-labelledby={`faq-question-${index}`}
                  >
                    <div className="faq-answer">
                      <p>{faq.answer}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* CTA FINAL DE CONVERSÃO */}
        <section className="final-cta-section">
          <div className="cta-box">
            <h2>Pronto para escalar suas vendas com a API Oficial no WhatsApp?</h2>
            <p>Junte-se às operações comerciais que vendem diariamente com alta taxa de entrega pelo canal oficial da Meta.</p>

            <a className="primary-button glowing large" href="#planos">
              <ZapIcon />
              Garantir meu Acesso ao Send Inteligentte
            </a>
          </div>
        </section>

        {/* FOOTER ENTERPRISE & COMPLETO */}
        <footer className="site-footer">
          {/* BARRA DE STATUS DO SISTEMA */}
          <div className="footer-status-bar">
            <div className="system-status-indicator">
              <span className="status-dot-green" />
              <span>Integrado à Meta Cloud API v19</span>
            </div>
            <div className="system-security-badge">
              🔒 Criptografia AES-256 • Conexão Segura SSL
            </div>
          </div>

          {/* GRID DE COLUNAS DO FOOTER */}
          <div className="footer-content-grid">
            <div className="footer-brand-col">
              <Brand />
              <p className="brand-description">
                Plataforma SaaS multi-tenant para automação, gestão de contatos e disparo seguro de campanhas no WhatsApp via Meta Cloud API v19.
              </p>
              <div className="tech-stack-chips">
                <span className="tech-chip">Meta Partner API</span>
                <span className="tech-chip">n8n Ready</span>
                <span className="tech-chip">Asaas Gateway</span>
              </div>
            </div>

            <div className="footer-nav-cols">
              <div className="link-group">
                <strong>Plataforma</strong>
                <a href="#como-funciona">Como funciona</a>
                <a href="#recursos">Recursos & Features</a>
                <a href="#anti-ban">API Oficial vs Paralelas</a>
                <a href="#planos">Planos & Valores</a>
              </div>

              <div className="link-group">
                <strong>Desenvolvedores</strong>
                <a href="https://github.com/Pedrojaug/whatsapp-api-oficial" target="_blank" rel="noopener noreferrer">
                  Documentação API REST
                </a>
                <a href="#api-webhooks">n8n & Webhooks</a>
                <a href="#link-tracker">Link Tracker</a>
                <a href="#recursos">Todos os recursos</a>
              </div>

              <div className="link-group">
                <strong>Legal & Atendimento</strong>
                <Link href="/politica-de-privacidade">Política de Privacidade</Link>
                <Link href="/termos-e-condicoes">Termos e Condições</Link>
                <a href="https://app.sendinteligente.com.br" target="_blank" rel="noopener noreferrer">
                  Área do Cliente (Login)
                </a>
                <a href="#faq">Central de Ajuda (FAQ)</a>
              </div>
            </div>
          </div>

          {/* BARRA DE MEIOS DE PAGAMENTO E DIREITOS */}
          <div className="footer-payment-security">
            <div className="payment-methods-box">
              <span className="payment-label">Processamento Seguro Asaas:</span>
              <span className="payment-chip">⚡ Pix (Aprovação Imediata)</span>
              <span className="payment-chip">💳 Cartão de Crédito</span>
              <span className="payment-chip">📄 Boleto Bancário</span>
            </div>
          </div>

          <div className="footer-bottom-bar">
            <p>© {new Date().getFullYear()} Send Inteligentte. Todos os direitos reservados.</p>
            <p className="disclaimer-text">
              O Send Inteligentte é um software independente para integração com a Meta WhatsApp Business Cloud API v19. WhatsApp e Meta são marcas registradas da Meta, Inc.
            </p>
          </div>
        </footer>
      </div>

      {/* BARRA DE CTA FIXA — SÓ APARECE NO MOBILE */}
      <div className="mobile-cta-bar">
        <span className="mobile-cta-info">
          <span>A partir de</span>
          <strong>R$ {cheapestMonthly}/mês</strong>
        </span>
        <a className="primary-button compact" href="#planos">
          Ver planos
          <ArrowRightIcon />
        </a>
      </div>
    </main>
  );
}
