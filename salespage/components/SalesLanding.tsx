"use client";

import { useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import {
  ArrowRightIcon,
  BagIcon,
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
import { formatCurrency, plans } from "@/lib/plans";
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
      {/* HEADER DE ALTA CONVERSÃO */}
      <header className="site-header">
        <Brand />

        <nav className="public-nav" aria-label="Navegação da oferta">
          <a href="#recursos">Recursos</a>
          <a href="#anti-ban">API Oficial vs Paralelas</a>
          <a href="#planos">Planos & Valores</a>
          <a href="#faq">Dúvidas</a>
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
            Começar Agora
          </a>
        </div>
      </header>

      <div className="sales-page">
        {/* HERO SECTION */}
        <section className="hero-section" id="hero">
          <div className="hero-copy">
            {content.announcement ? (
              <div className="announcement-pill">
                <span className="sparkle">✨</span> {content.announcement}
              </div>
            ) : null}

            <span className="pill success">
              <ShieldCheckIcon />
              {content.heroBadge}
            </span>

            <h1>{content.heroTitle}</h1>
            <p>{content.heroDescription}</p>

            <div className="hero-actions">
              <a className="primary-button glowing" href="#planos">
                <ArrowRightIcon />
                {content.primaryCta}
              </a>
              <a className="secondary-button" href="#anti-ban">
                <ShieldCheckIcon />
                {content.secondaryCta}
              </a>
            </div>

            <div className="proof-strip" aria-label="Diferenciais principais">
              {content.proofItems.map((item) => (
                <span key={item} className="proof-chip">
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* PREVIEW INTERATIVO DO WHATSAPP & DASHBOARD */}
          <div className="product-preview" aria-label="Prévia visual do Send Inteligentte">
            <div className="preview-topbar">
              <div className="live-indicator">
                <span className="pulse-dot" />
                <span>Campanha em Tempo Real</span>
              </div>
              <strong className="campaign-name">{content.previewCampaign}</strong>
            </div>

            {/* METRICAS VIVAS */}
            <div className="preview-metrics">
              <div className="metric-box">
                <span className="metric-label">Disparados</span>
                <strong className="metric-value">12.450</strong>
              </div>
              <div className="metric-box highlight">
                <span className="metric-label">Entregues (99.4%)</span>
                <strong className="metric-value">12.375</strong>
              </div>
              <div className="metric-box">
                <span className="metric-label">Cliques no Link</span>
                <strong className="metric-value">3.868</strong>
              </div>
            </div>

            {/* MOCKUP CHAT WHATSAPP */}
            <div className="whatsapp-mockup">
              <div className="mockup-header">
                <div className="avatar-circle">SI</div>
                <div className="header-info">
                  <strong>Sua Empresa (Oficial)</strong>
                  <span className="verified-badge">✓ Conta Comercial Oficial</span>
                </div>
              </div>

              <div className="mockup-bubble">
                <p>{content.templateMessage}</p>
                <div className="bubble-time">10:42 • Enviado via Cloud API v19</div>

                <div className="mockup-buttons">
                  <span className="mockup-btn">🛍️ Ver Oferta Especial</span>
                  <span className="mockup-btn link">🌐 https://send.link/t/x8k9</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* COMPARTIVO: API OFICIAL VS PARALELAS */}
        <section className="comparison-section" id="anti-ban">
          <div className="section-header">
            <span className="section-badge warning">Segurança Absoluta</span>
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
                  <CrossIcon /> <strong>Risco Iminente de Banimento:</strong> O WhatsApp detecta o uso em poucos disparos e bloqueia o chip permanentemente.
                </li>
                <li>
                  <CrossIcon /> <strong>Dependência do Celular:</strong> Se a bateria acabar ou a internet cair, a campanha para na hora.
                </li>
                <li>
                  <CrossIcon /> <strong>Limites Reduzidos:</strong> Bloqueios frequentes ao tentar enviar mais de 50 mensagens.
                </li>
                <li>
                  <CrossIcon /> <strong>Sem Métricas Oficiais:</strong> Você não sabe se a mensagem foi entregue ou bloqueada pela operadora.
                </li>
              </ul>
            </div>

            {/* SEND INTELIGENTTE (META OFICIAL) */}
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
                  <CheckIcon /> <strong>0% Risco de Banimento:</strong> Disparos 100% em conformidade com os Termos de Serviço da Meta.
                </li>
                <li>
                  <CheckIcon /> <strong>Totalmente em Nuvem:</strong> Funciona 24 horas por dia sem precisar de celular ligado.
                </li>
                <li>
                  <CheckIcon /> <strong>Alta Escala e Velocidade:</strong> Dispare milhares de mensagens por hora com altíssima taxa de entrega.
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

            <article className="feature-card">
              <div className="icon-wrapper cyan">
                <LinkIcon />
              </div>
              <h3>Links Rastreáveis (/t/)</h3>
              <p>Encurte links das campanhas e acompanhe quais contatos clicaram no seu CTA em tempo real no painel.</p>
            </article>

            <article className="feature-card">
              <div className="icon-wrapper purple">
                <CpuIcon />
              </div>
              <h3>API Key & Webhooks n8n</h3>
              <p>API REST dedicada em <code>/api/v1</code> com templates de workflow de n8n para conectar Typebot, Make, HubSpot e CRMs.</p>
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

        {/* SIMULADOR INTERATIVO DE IMPACTO DE VENDAS */}
        <section className="roi-calculator-section">
          <div className="calculator-box">
            <div className="calculator-header">
              <span className="section-kicker">Simulador de Impacto</span>
              <h2>Calcule o alcance da sua próxima campanha</h2>
              <p>Arraste o seletor abaixo e veja a projeção de entregabilidade com a API Oficial do Send Inteligentte.</p>
            </div>

            <div className="calculator-slider-container">
              <div className="slider-label">
                <span>Tamanho da sua Lista de Contatos:</span>
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

        {/* CARDS DE PLANOS & PREÇOS */}
        <section className="pricing-section" id="planos">
          <div className="section-header">
            <span className="section-badge success">{content.offerKicker}</span>
            <h2>{content.offerTitle}</h2>
            <p>{content.offerDescription}</p>
          </div>

          <div className="plans-grid">
            {plans.map((plan) => (
              <div
                key={plan.slug}
                className={`plan-card ${plan.highlighted ? "highlighted" : ""}`}
              >
                {plan.badge ? <div className="plan-badge">{plan.badge}</div> : null}

                <div className="plan-header">
                  <h3>{plan.name}</h3>
                  <p className="plan-desc">{plan.description}</p>

                  <div className="plan-price-wrapper">
                    <span className="currency">R$</span>
                    <span className="price">{plan.price}</span>
                    <span className="period">{plan.period}</span>
                  </div>

                  {plan.monthlyEquivalent ? (
                    <div className="monthly-equivalent">
                      Equivale a <strong>R$ {plan.monthlyEquivalent}/mês</strong>
                    </div>
                  ) : null}
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
                  <BagIcon />
                  Assinar {plan.name}
                </Link>

                <p className="fine-print">Pagamento seguro via Asaas. Ativação imediata.</p>
              </div>
            ))}
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
            {content.faqs.map((faq, index) => {
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
            <h2>Pronto para escalar suas vendas com a API Oficial no WhatsApp?</h2>
            <p>Junte-se às operações comerciais que vendem diariamente com alta taxa de entrega e zero risco de banimento.</p>

            <a className="primary-button glowing large" href="#planos">
              <ZapIcon />
              Garantir meu Acesso ao Send Inteligentte
            </a>
          </div>
        </section>

        {/* FOOTER PROFISSIONAL */}
        <footer className="site-footer">
          <div className="footer-content">
            <div className="footer-brand">
              <Brand />
              <p>Plataforma SaaS para automação e disparo de campanhas via API Oficial do WhatsApp Meta Cloud v19.</p>
            </div>

            <div className="footer-links">
              <div className="link-group">
                <strong>Plataforma</strong>
                <a href="#recursos">Recursos</a>
                <a href="#anti-ban">API Oficial vs Paralelas</a>
                <a href="#planos">Planos</a>
              </div>

              <div className="link-group">
                <strong>Legal & Suporte</strong>
                <Link href="/PoliticaDePrivacidade.html" target="_blank">
                  Política de Privacidade
                </Link>
                <Link href="/TermosECondicoes.html" target="_blank">
                  Termos e Condições
                </Link>
                <a href="https://app.sendinteligente.com.br" target="_blank" rel="noopener noreferrer">
                  Área do Cliente
                </a>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <p>© {new Date().getFullYear()} Send Inteligentte. Todos os direitos reservados. Não afiliado ao Meta Inc.</p>
            <p className="secure-badge">🛡️ Processamento Seguro via Asaas</p>
          </div>
        </footer>
      </div>
    </main>
  );
}
