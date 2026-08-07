"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import {
  ArrowRightIcon,
  ChartIcon,
  CheckIcon,
  ChevronDownIcon,
  CpuIcon,
  CrossIcon,
  LinkIcon,
  ListIcon,
  MessageIcon,
  ShieldCheckIcon,
  ZapIcon,
} from "@/components/icons";
import { plans } from "@/lib/plans";
import type { SiteContent } from "@/lib/site-content";

type SalesLandingProps = {
  content: SiteContent;
};

export function SalesLanding({ content }: SalesLandingProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [contactCount, setContactCount] = useState<number>(5000);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [activeSteps, setActiveSteps] = useState<number[]>([]);
  const [expandedTimelineStep, setExpandedTimelineStep] = useState<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const toggleTimelineStep = (index: number) => {
    setExpandedTimelineStep(expandedTimelineStep === index ? null : index);
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const calculatedDeliveries = Math.floor(contactCount * 0.992);
  const calculatedReads = Math.floor(contactCount * 0.74);
  const calculatedClicks = Math.floor(contactCount * 0.31);

  useEffect(() => {
    const handleScroll = () => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // Calcular o progresso de preenchimento da linha central
      const totalHeight = rect.height;
      const currentTop = windowHeight * 0.5 - rect.top;
      let progress = currentTop / (totalHeight * 0.85);
      progress = Math.max(0, Math.min(1, progress));
      setScrollProgress(progress);

      // Ativar visualmente os passos à medida que entram no viewport
      const stepItems = timelineRef.current.querySelectorAll(".vertical-step-item");
      const newActive: number[] = [];
      stepItems.forEach((el, index) => {
        const stepRect = el.getBoundingClientRect();
        if (stepRect.top < windowHeight * 0.72) {
          newActive.push(index);
        }
      });
      setActiveSteps(newActive);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <main className="main-wrapper">
      {/* HEADER COMPACTO E LIMPO */}
      <header className="site-header">
        <Brand />

        <nav className="public-nav" aria-label="Navegação da oferta">
          <a href="#como-funciona">Como funciona</a>
          <a href="#simulador">Simulador</a>
          <a href="#recursos">Recursos</a>
          <a href="#anti-ban">API Oficial vs Paralelas</a>
          <a href="#planos">Planos</a>
          <a href="#faq">Dúvidas</a>
        </nav>

        <div className="header-actions">
          <a
            className="login-link"
            href="https://app.sendinteligente.com.br"
            target="_blank"
            rel="noopener noreferrer"
          >
            Entrar
          </a>

          <a className="primary-button compact" href="#planos">
            <ZapIcon />
            Ativar Conta
          </a>
        </div>
      </header>

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

            <p className="hero-subtext">
              Disparo em massa pela API Oficial da Meta: templates aprovados, alta taxa de entrega e zero risco de banimento do seu chip comercial.
            </p>

            <div className="hero-actions">
              <a className="primary-button glowing large" href="#planos">
                <ArrowRightIcon />
                Quero ativar minha conta
              </a>
              <a className="secondary-button" href="#simulador">
                Simular Alcance
              </a>
            </div>

            <div className="proof-strip" aria-label="Diferenciais principais">
              <span className="proof-chip">✓ API Oficial da Meta</span>
              <span className="proof-chip">✓ Opt-out automático (LGPD)</span>
              <span className="proof-chip">✓ Suporte na ativação</span>
            </div>
          </div>

          {/* PRINT REAL DO DASHBOARD EM DESTAQUE */}
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
              <img
                src="/dashboard-preview.png"
                alt="Painel de Métricas Oficial do Send Inteligentte"
                className="dashboard-real-img"
              />
            </div>
          </div>
        </section>

        {/* LINHA DO TEMPO VERTICAL INTERATIVA COM SCROLL */}
        <section className="timeline-section" id="como-funciona" ref={timelineRef}>
          <div className="section-header">
            <span className="section-badge">Linha do Tempo</span>
            <h2>Como funciona a operação em 4 passos</h2>
            <p>Acompanhe o fluxo seguro do cadastro ao disparo em massa.</p>
          </div>

          <div className="vertical-timeline-wrapper">
            {/* EIXO CENTRAL VERTICAL */}
            <div className="vertical-timeline-axis">
              <div
                className="vertical-axis-progress"
                style={{ height: `${scrollProgress * 100}%` }}
              />
            </div>

            <div className="vertical-steps-container">
              {/* PASSO 01 - ESQUERDA */}
              <div className={`vertical-step-item step-left ${activeSteps.includes(0) ? "is-active" : ""}`}>
                <div className="step-side-col left-side">
                  <div className="vertical-icon-bubble">
                    <ShieldCheckIcon />
                  </div>
                  <div className="step-dashed-connector" />
                  <div
                    className={`vertical-step-card ${expandedTimelineStep === 0 ? "is-expanded" : ""}`}
                    onClick={() => toggleTimelineStep(0)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="card-top-header">
                      <span className="step-highlight-pill">PASSO 01</span>
                      <span className="expand-toggle-btn">
                        {expandedTimelineStep === 0 ? "Ocultar ▲" : "Ver detalhes ▼"}
                      </span>
                    </div>
                    <h3 className="main-step-title">Conexão Oficial Meta</h3>
                    {expandedTimelineStep === 0 && (
                      <div className="step-explanation-box">
                        <p className="impact-subtitle">⚡ Ativação em 2 minutos via Facebook Business</p>
                        <p className="detail-text">Vinculação nativa homologada pela Meta. Sem QR Code, sem queda de chip e 100% à prova de banimento.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="step-axis-col">
                  <div className="timeline-node-dot" />
                </div>

                <div className="step-side-col right-side empty" />
              </div>

              {/* PASSO 02 - DIREITA */}
              <div className={`vertical-step-item step-right ${activeSteps.includes(1) ? "is-active" : ""}`}>
                <div className="step-side-col left-side empty" />

                <div className="step-axis-col">
                  <div className="timeline-node-dot" />
                </div>

                <div className="step-side-col right-side">
                  <div
                    className={`vertical-step-card ${expandedTimelineStep === 1 ? "is-expanded" : ""}`}
                    onClick={() => toggleTimelineStep(1)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="card-top-header">
                      <span className="step-highlight-pill">PASSO 02</span>
                      <span className="expand-toggle-btn">
                        {expandedTimelineStep === 1 ? "Ocultar ▲" : "Ver detalhes ▼"}
                      </span>
                    </div>
                    <h3 className="main-step-title">Importação de Contatos</h3>
                    {expandedTimelineStep === 1 && (
                      <div className="step-explanation-box">
                        <p className="impact-subtitle">📊 Planilhas CSV com tags e opt-out automático</p>
                        <p className="detail-text">Suba suas listas em segundos. O sistema organiza os contatos e remove automaticamente quem solicitar saída.</p>
                      </div>
                    )}
                  </div>
                  <div className="step-dashed-connector" />
                  <div className="vertical-icon-bubble">
                    <ListIcon />
                  </div>
                </div>
              </div>

              {/* PASSO 03 - ESQUERDA */}
              <div className={`vertical-step-item step-left ${activeSteps.includes(2) ? "is-active" : ""}`}>
                <div className="step-side-col left-side">
                  <div className="vertical-icon-bubble">
                    <MessageIcon />
                  </div>
                  <div className="step-dashed-connector" />
                  <div
                    className={`vertical-step-card ${expandedTimelineStep === 2 ? "is-expanded" : ""}`}
                    onClick={() => toggleTimelineStep(2)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="card-top-header">
                      <span className="step-highlight-pill">PASSO 03</span>
                      <span className="expand-toggle-btn">
                        {expandedTimelineStep === 2 ? "Ocultar ▲" : "Ver detalhes ▼"}
                      </span>
                    </div>
                    <h3 className="main-step-title">Templates Interativos</h3>
                    {expandedTimelineStep === 2 && (
                      <div className="step-explanation-box">
                        <p className="impact-subtitle">🎯 Mensagens com botões de ação e links /t/</p>
                        <p className="detail-text">Cadastre modelos com botões de resposta rápida e links rastreáveis que medem o interesse real de cada lead.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="step-axis-col">
                  <div className="timeline-node-dot" />
                </div>

                <div className="step-side-col right-side empty" />
              </div>

              {/* PASSO 04 - DIREITA */}
              <div className={`vertical-step-item step-right ${activeSteps.includes(3) ? "is-active" : ""}`}>
                <div className="step-side-col left-side empty" />

                <div className="step-axis-col">
                  <div className="timeline-node-dot" />
                </div>

                <div className="step-side-col right-side">
                  <div
                    className={`vertical-step-card featured ${expandedTimelineStep === 3 ? "is-expanded" : ""}`}
                    onClick={() => toggleTimelineStep(3)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="card-top-header">
                      <span className="step-highlight-pill highlight">PASSO 04</span>
                      <span className="expand-toggle-btn">
                        {expandedTimelineStep === 3 ? "Ocultar ▲" : "Ver detalhes ▼"}
                      </span>
                    </div>
                    <h3 className="main-step-title">Disparo & Conversão</h3>
                    {expandedTimelineStep === 3 && (
                      <div className="step-explanation-box">
                        <p className="impact-subtitle">🚀 Envio em massa com métricas ao vivo</p>
                        <p className="detail-text">Dispare com alta prioridade de entrega e acompanhe visualizações e cliques em tempo real no seu painel.</p>
                      </div>
                    )}
                  </div>
                  <div className="step-dashed-connector" />
                  <div className="vertical-icon-bubble highlight">
                    <ZapIcon />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SIMULADOR INTERATIVO DE IMPACTO */}
        <section className="roi-calculator-section" id="simulador">
          <div className="calculator-box">
            <div className="calculator-header">
              <span className="section-badge success">Simulador de Impacto</span>
              <h2>Simule o alcance da sua próxima campanha</h2>
              <p>Arraste o seletor e veja a projeção real de entregabilidade com a API Oficial.</p>
            </div>

            <div className="calculator-slider-container">
              <div className="slider-label">
                <span>Sua Lista de Contatos:</span>
                <strong>{contactCount.toLocaleString("pt-BR")} contatos</strong>
              </div>
              <input
                type="range"
                min="1000"
                max="50000"
                step="1000"
                value={contactCount}
                onChange={(e) => setContactCount(Number(e.target.value))}
                className="roi-slider"
              />
              <div className="slider-range-indicators">
                <span>1.000</span>
                <span>25.000</span>
                <span>50.000</span>
              </div>
            </div>

            <div className="calculator-results">
              <div className="result-card">
                <span>Mensagens Entregues (99.2%)</span>
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
                <small className="result-sub">Rastreável com `/t/:shortCode`</small>
              </div>
            </div>
          </div>
        </section>

        {/* SUPERPODERES DO SEND */}
        <section className="benefit-section" id="recursos">
          <div className="section-header">
            <span className="section-badge">Superpoderes do Send</span>
            <h2>Tudo o que sua operação precisa para explodir em vendas</h2>
          </div>

          <div className="features-grid">
            <article className="feature-card">
              <div className="icon-wrapper green">
                <ShieldCheckIcon />
              </div>
              <h3>0% Risco de Banimento</h3>
              <p>Sua conta opera 100% homologada na infraestrutura oficial da Meta com selo de verificação.</p>
            </article>

            <article className="feature-card">
              <div className="icon-wrapper cyan">
                <LinkIcon />
              </div>
              <h3>Links Rastreáveis (/t/)</h3>
              <p>Saiba exatamente quem clicou nas suas ofertas e converta leads quentes em tempo real.</p>
            </article>

            <article className="feature-card">
              <div className="icon-wrapper purple">
                <CpuIcon />
              </div>
              <h3>Automação n8n & Webhooks</h3>
              <p>API REST dedicada em <code>/api/v1</code> para integrar Typebot, Make, HubSpot e qualquer CRM.</p>
            </article>

            <article className="feature-card">
              <div className="icon-wrapper green">
                <ListIcon />
              </div>
              <h3>Opt-out LGPD Automático</h3>
              <p>Filtro inteligente que remove automaticamente contatos que pedirem para sair da lista.</p>
            </article>

            <article className="feature-card">
              <div className="icon-wrapper cyan">
                <MessageIcon />
              </div>
              <h3>Listas Segmentadas</h3>
              <p>Agrupe contatos por interesse, etapa no funil ou histórico e envie mensagens cirúrgicas.</p>
            </article>

            <article className="feature-card">
              <div className="icon-wrapper purple">
                <ChartIcon />
              </div>
              <h3>Métricas Vivas de Conversão</h3>
              <p>Acompanhe disparados, entregues, lidos e taxa de vendas ao vivo sem planilhas.</p>
            </article>
          </div>
        </section>

        {/* COMPARATIVO */}
        <section className="comparison-section" id="anti-ban">
          <div className="section-header">
            <span className="section-badge warning">Decisão Inteligente</span>
            <h2>API Oficial da Meta vs. Disparadores Paralelos</h2>
            <p>Escolha a segurança do seu canal de vendas oficial contra o risco de perder o número.</p>
          </div>

          <div className="comparison-grid">
            {/* SEND INTELIGENTTE NA ESQUERDA */}
            <div className="comparison-card success featured">
              <div className="featured-banner">RECOMENDADO PELA META</div>
              <div className="card-header">
                <span className="status-badge success">
                  <ShieldCheckIcon /> 100% Seguro & Oficial
                </span>
                <h3>Send Inteligentte (Cloud API v19)</h3>
                <p className="card-sub">Conexão nativa com a infraestrutura da Meta</p>
              </div>

              <ul className="comparison-list">
                <li>
                  <CheckIcon /> <strong>0% Risco de Banimento:</strong> Disparos 100% em conformidade com as diretrizes Meta.
                </li>
                <li>
                  <CheckIcon /> <strong>Totalmente em Nuvem:</strong> Funciona 24/7 sem depender de celular ou internet ligada.
                </li>
                <li>
                  <CheckIcon /> <strong>Alta Escala e Velocidade:</strong> Dispare milhares de mensagens com altíssima entregabilidade.
                </li>
                <li>
                  <CheckIcon /> <strong>Relatórios Oficiais Meta:</strong> Saiba exatamente quem recebeu, leu e clicou nas ofertas.
                </li>
                <li>
                  <CheckIcon /> <strong>Suporte ao Selo Verde:</strong> Elegível para a verificação oficial de conta comercial.
                </li>
              </ul>
            </div>

            {/* PARALELAS NA DIREITA */}
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
                  <CrossIcon /> <strong>Risco Iminente de Banimento:</strong> O WhatsApp detecta o uso e bloqueia o chip permanentemente.
                </li>
                <li>
                  <CrossIcon /> <strong>Dependência do Celular:</strong> Se a bateria acabar ou o sinal cair, a campanha trava.
                </li>
                <li>
                  <CrossIcon /> <strong>Limites Reduzidos:</strong> Bloqueios frequentes ao tentar enviar mais de 50 mensagens.
                </li>
                <li>
                  <CrossIcon /> <strong>Sem Métricas Oficiais:</strong> Você não sabe se a mensagem foi entregue ou barrada.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* CARDS DE PLANOS & PREÇOS */}
        <section className="pricing-section" id="planos">
          <div className="section-header">
            <h2>Um plano só. Escolha a periodicidade.</h2>
            <p>Todos os recursos liberados em qualquer plano. Economize nos planos de maior duração.</p>
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

        {/* PERGUNTAS FREQUENTES */}
        <section className="faq-section" id="faq">
          <div className="section-header">
            <span className="section-badge">Tire suas Dúvidas</span>
            <h2>Perguntas Frequentes</h2>
            <p>Tudo o que você precisa saber sobre a API Oficial e o Send Inteligentte.</p>
          </div>

          <div className="faq-accordion">
            {(content.faqs ?? []).map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={faq.question} className={`faq-item ${isOpen ? "is-open" : ""}`}>
                  <button
                    type="button"
                    className="faq-question"
                    onClick={() => toggleFaq(index)}
                    aria-expanded={isOpen}
                  >
                    <span>{faq.question}</span>
                    <span className="chevron-icon">
                      <ChevronDownIcon />
                    </span>
                  </button>

                  {isOpen ? (
                    <div className="faq-answer">
                      <p>{faq.answer}</p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        {/* CTA FINAL DE CONVERSÃO */}
        <section className="final-cta-section">
          <div className="cta-box">
            <h2>Pronto para escalar suas vendas no WhatsApp sem risco?</h2>
            <p>Junte-se às operações comerciais que vendem diariamente pela API Oficial da Meta.</p>

            <a className="primary-button glowing large" href="#planos">
              <ZapIcon />
              Garantir meu Acesso ao Send Inteligentte
            </a>
          </div>
        </section>

        {/* RODAPÉ SIMPLES */}
        <footer className="site-footer simple-footer">
          <div className="simple-footer-content">
            <Brand />

            <nav className="simple-footer-nav" aria-label="Links do rodapé">
              <a href="#como-funciona">Como funciona</a>
              <a href="#simulador">Simulador</a>
              <a href="#recursos">Recursos</a>
              <a href="#planos">Planos</a>
              <Link href="/PoliticaDePrivacidade.html" target="_blank">Privacidade</Link>
              <Link href="/TermosECondicoes.html" target="_blank">Termos</Link>
              <a href="https://app.sendinteligente.com.br" target="_blank" rel="noopener noreferrer">Área do Cliente</a>
            </nav>
          </div>

          <div className="simple-footer-bottom">
            <p>© {new Date().getFullYear()} Send Inteligentte. Todos os direitos reservados.</p>
            <p className="secure-badge">🛡️ Processamento Seguro via Asaas</p>
          </div>
        </footer>
      </div>
    </main>
  );
}
