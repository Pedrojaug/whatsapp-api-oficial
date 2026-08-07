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
      {/* BARRA SUPERIOR DE ANÚNCIO */}
      <div className="top-announcement-bar">
        <span>⚡ Ativação assistida incluída — primeira campanha no ar esta semana.</span>
      </div>

      {/* HEADER DE ALTA CONVERSÃO */}
      <header className="site-header">
        <Brand />

        <nav className="public-nav" aria-label="Navegação da oferta">
          <a href="#como-funciona">Como funciona</a>
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
            Entrar no Painel
          </a>

          <a className="primary-button compact" href="#planos">
            <ZapIcon />
            Quero ativar minha conta
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

          {/* PREVIEW INTERATIVO DO WHATSAPP & DASHBOARD */}
          <div className="product-preview" aria-label="Prévia visual do Send Inteligentte">
            <div className="preview-topbar">
              <div className="live-indicator">
                <span className="pulse-dot" />
                <span>CAMPANHA EM ANDAMENTO</span>
              </div>
              <strong className="campaign-name">{content.previewCampaign}</strong>
            </div>

            {/* METRICAS VIVAS */}
            <div className="preview-metrics">
              <div className="metric-box">
                <span className="metric-label">DISPARADOS</span>
                <strong className="metric-value">1.284</strong>
                <small className="metric-sub">fila normal</small>
              </div>
              <div className="metric-box highlight">
                <span className="metric-label">ENTREGUES</span>
                <strong className="metric-value">1.197</strong>
                <small className="metric-sub">93,2%</small>
              </div>
              <div className="metric-box">
                <span className="metric-label">LIDOS</span>
                <strong className="metric-value">642</strong>
                <small className="metric-sub">53,6%</small>
              </div>
              <div className="metric-box">
                <span className="metric-label">CLIQUES</span>
                <strong className="metric-value">218</strong>
                <small className="metric-sub">link rastreado</small>
              </div>
            </div>

            {/* MOCKUP CHAT WHATSAPP */}
            <div className="whatsapp-mockup">
              <div className="mockup-header">
                <div className="avatar-circle">SI</div>
                <div className="header-info">
                  <strong>Sua Empresa (Oficial)</strong>
                  <span className="verified-badge">✓ TEMPLATE APROVADO</span>
                </div>
              </div>

              <div className="mockup-bubble">
                <p>{content.templateMessage}</p>
                <div className="bubble-time">09:41 ✓✓</div>

                <div className="mockup-buttons">
                  <span className="mockup-btn">Falar com o time</span>
                </div>
              </div>
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

        {/* SIMULADOR INTERATIVO DE ROI / IMPACTO */}
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

        {/* FOOTER ENTERPRISE & COMPLETO */}
        <footer className="site-footer">
          {/* BARRA DE STATUS DO SISTEMA */}
          <div className="footer-status-bar">
            <div className="system-status-indicator">
              <span className="status-dot-green" />
              <span>Sistemas Operacionais 100% • Meta Cloud API v19 Online</span>
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
                <a href="#recursos">n8n Workflows</a>
                <a href="#recursos">Webhooks Engine</a>
                <a href="#recursos">Link Tracker (/t/)</a>
              </div>

              <div className="link-group">
                <strong>Legal & Atendimento</strong>
                <Link href="/PoliticaDePrivacidade.html" target="_blank">
                  Política de Privacidade
                </Link>
                <Link href="/TermosECondicoes.html" target="_blank">
                  Termos e Condições
                </Link>
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
    </main>
  );
}
