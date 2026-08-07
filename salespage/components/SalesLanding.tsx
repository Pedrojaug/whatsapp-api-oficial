"use client";

import { useState } from "react";
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

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const calculatedDeliveries = Math.floor(contactCount * 0.992);
  const calculatedReads = Math.floor(contactCount * 0.74);
  const calculatedClicks = Math.floor(contactCount * 0.31);

  return (
    <main className="main-wrapper">
      {/* BARRA SUPERIOR DE ANÚNCIO */}
      <div className="top-announcement-bar">
        <span>⚡ Ativação assistida incluída — primeira campanha no ar esta semana.</span>
      </div>

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
        {/* HERO SECTION (PROPORÇÃO AJUSTADA COM IMAGEM MAIOR) */}
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

        {/* PASSO A PASSO EM FORMATO DE LINHA DO TEMPO (FIXED 4-COLUMN HORIZONTAL) */}
        <section className="timeline-section" id="como-funciona">
          <div className="section-header">
            <span className="section-badge">Linha do Tempo</span>
            <h2>Como funciona em 4 passos simples</h2>
            <p>Do cadastro até o disparo em massa seguro e homologado.</p>
          </div>

          <div className="timeline-container">
            <div className="timeline-step">
              <div className="step-top-row">
                <div className="step-badge">1</div>
                <span className="step-arrow">→</span>
              </div>
              <div className="step-content">
                <h3>Conecte a Meta API</h3>
                <p>Vinculação oficial em 2 minutos via login no Facebook.</p>
              </div>
            </div>

            <div className="timeline-step">
              <div className="step-top-row">
                <div className="step-badge">2</div>
                <span className="step-arrow">→</span>
              </div>
              <div className="step-content">
                <h3>Importe seus Contatos</h3>
                <p>Upload de planilhas CSV com tags e segmentação.</p>
              </div>
            </div>

            <div className="timeline-step">
              <div className="step-top-row">
                <div className="step-badge">3</div>
                <span className="step-arrow">→</span>
              </div>
              <div className="step-content">
                <h3>Crie o Template</h3>
                <p>Mensagens com botões interativos aprovados pela Meta.</p>
              </div>
            </div>

            <div className="timeline-step">
              <div className="step-top-row">
                <div className="step-badge">4</div>
                <span className="step-check">✓</span>
              </div>
              <div className="step-content">
                <h3>Dispare e Converta</h3>
                <p>Envio automático com métricas de entrega e cliques ao vivo.</p>
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

        {/* COMPARATIVO (ESQUERDA BOAS, DIREITA RUINS) */}
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

        {/* PERGUNTAS FREQUENTES (FAQ ACCORDION INTERATIVO) */}
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

        {/* RODAPÉ SIMPLES, DIRETO E FUNCIONAL */}
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
