"use client";

import { useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import {
  ArrowRightIcon,
  ChartIcon,
  CheckIcon,
  ChevronDownIcon,
  CodeIcon,
  CpuIcon,
  CrossIcon,
  DatabaseIcon,
  GlobeIcon,
  LayersIcon,
  LinkIcon,
  ListIcon,
  MessageIcon,
  ServerIcon,
  ShieldCheckIcon,
  TerminalIcon,
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
  const [activeCodeTab, setActiveCodeTab] = useState<"curl" | "n8n" | "csv">("curl");
  const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const calculatedDeliveries = Math.floor(contactCount * 0.992);
  const calculatedReads = Math.floor(contactCount * 0.74);
  const calculatedClicks = Math.floor(contactCount * 0.28);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const snippets = {
    curl: `curl -X POST https://app.sendinteligente.com.br/api/v1/messages \\
  -H "Authorization: Bearer sk_live_9f83a1b42c..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "phoneNumber": "5511999998888",
    "templateName": "aviso_promocao_v1",
    "language": "pt_BR",
    "parameters": [
      { "type": "text", "text": "Carlos" },
      { "type": "text", "text": "15% OFF" }
    ]
  }'`,
    n8n: `// Webhook de Entrega e Leitura (Send Inteligentte -> n8n / CRM)
{
  "event": "message.status_updated",
  "messageId": "msg_89f023a12",
  "recipientPhone": "5511999998888",
  "status": "READ", // SENT | DELIVERED | READ | FAILED
  "templateName": "aviso_promocao_v1",
  "clickedTrackingLink": true,
  "clickedUrl": "https://suaempresa.com.br/oferta-vip",
  "timestamp": "2026-08-31T14:30:00.000Z"
}`,
    csv: `Nome,Telefone,CodigoPedido,Desconto
Carlos Silva,5511999998888,PED-9402,15%
Mariana Costa,5521988887777,PED-9403,20%
Lucas Souza,5531977776666,PED-9404,10%

// O sistema mapeia automaticamente {{1}}, {{2}} e higieniza números
// Aplicando filtro automático de Blacklist/Opt-out antes do envio.`,
  };

  return (
    <main className="main-wrapper">
      {/* BARRA SUPERIOR DE CONFORMIDADE */}
      <div className="top-announcement-bar">
        <span>{content.announcement}</span>
      </div>

      {/* HEADER PRINCIPAL */}
      <header className="site-header">
        <Brand />

        <nav className="public-nav" aria-label="Navegação do site">
          <a href="#cenario">Por que API Oficial?</a>
          <a href="#como-funciona">Como funciona</a>
          <a href="#recursos">Engenharia</a>
          <a href="#integracao">API & n8n</a>
          <a href="#simulador">Calculadora</a>
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
            Área do Cliente
          </a>

          <a className="primary-button compact" href="#planos">
            <ZapIcon />
            <span>Ativar Conta</span>
          </a>
        </div>
      </header>

      <div className="sales-page">
        {/* HERO SECTION */}
        <section className="hero-section" id="hero">
          <div className="hero-container">
            <div className="hero-copy">
              <div className="hero-badge-wrapper">
                <span className="pill status-live">
                  <span className="pulse-indicator" />
                  {content.heroBadge}
                </span>
                <span className="pill neutral">Sem dependência de celular</span>
              </div>

              <h1>
                Dispare campanhas no WhatsApp com a{" "}
                <span className="text-gradient">estabilidade da API Oficial</span> da Meta.
              </h1>

              <p className="hero-lead">
                {content.heroDescription}
              </p>

              <div className="hero-actions">
                <a className="primary-button large" href="#planos">
                  <ZapIcon />
                  <span>{content.primaryCta}</span>
                </a>
                <a
                  className="secondary-button large"
                  href="https://wa.me/5511999999999?text=Ol%C3%A1!%20Gostaria%20de%20tirar%20d%C3%BAvidas%20sobre%20o%20Send%20Inteligentte%20e%20a%20API%20Oficial."
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageIcon />
                  <span>Falar com o Suporte</span>
                </a>
              </div>

              <div className="trust-badges-grid">
                <div className="trust-badge-item">
                  <ShieldCheckIcon />
                  <span><strong>7 dias de garantia</strong> incondicional</span>
                </div>
                <div className="trust-badge-item">
                  <CheckIcon />
                  <span><strong>Onboarding assistido</strong> na ativação</span>
                </div>
                <div className="trust-badge-item">
                  <CheckIcon />
                  <span><strong>Sem contratos</strong> ou fidelidade oculta</span>
                </div>
              </div>
            </div>

            {/* PRODUCT PREVIEW FRAME */}
            <div className="product-preview-container">
              <div className="product-preview-frame">
                <div className="window-topbar">
                  <div className="window-dots">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                  </div>
                  <div className="window-address-bar">
                    <span className="lock-icon">🔒</span>
                    <span className="address-text">app.sendinteligente.com.br/dashboard</span>
                  </div>
                  <div className="window-meta-tag">
                    <ShieldCheckIcon />
                    <span>Meta Cloud v19 Conectado</span>
                  </div>
                </div>

                <div className="dashboard-img-wrapper">
                  <img
                    src="/dashboard-preview.png"
                    alt="Painel Operacional do Send Inteligentte com Métricas de Disparo"
                    className="dashboard-real-img"
                  />
                  <div className="dashboard-overlay-card">
                    <div className="overlay-metric">
                      <span className="metric-label">Taxa de Entrega</span>
                      <strong className="metric-val">99.4%</strong>
                    </div>
                    <div className="overlay-divider" />
                    <div className="overlay-metric">
                      <span className="metric-label">Proteção de Número</span>
                      <strong className="metric-val green">100% Homologado</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CENÁRIO & COMPARATIVO AUTÊNTICO */}
        <section className="problem-solution-section" id="cenario">
          <div className="section-header">
            <span className="section-badge">O Dilema do Mercado</span>
            <h2>Por que operações sérias abandonam disparadores por QR Code</h2>
            <p>Entenda as diferenças reais entre automações amadoras, gigantes corporativos engessados e o Send Inteligentte.</p>
          </div>

          <div className="comparison-three-grid">
            {/* CARD 1: NÃO OFICIAIS */}
            <div className="comparison-col danger-border">
              <div className="col-header">
                <span className="col-tag danger">Risco Crítico</span>
                <h3>Disparadores por QR Code / Baileys</h3>
                <p className="col-sub">Emulação de WhatsApp Web & Scraping</p>
              </div>
              <ul className="comparison-points">
                <li>
                  <CrossIcon />
                  <div>
                    <strong>Banimento Frequente do Chip:</strong>
                    <span>A Meta detecta padrões de emulação e bloqueia números de forma irreversível.</span>
                  </div>
                </li>
                <li>
                  <CrossIcon />
                  <div>
                    <strong>Dependência de Celular Ligado:</strong>
                    <span>Se a bateria acabar, o Wi-Fi oscilar ou a sessão cair, a operação inteira congela.</span>
                  </div>
                </li>
                <li>
                  <CrossIcon />
                  <div>
                    <strong>Falta de Métricas Confiáveis:</strong>
                    <span>Sem confirmação oficial de entrega; você não sabe se a mensagem chegou ou foi descartada.</span>
                  </div>
                </li>
                <li>
                  <CrossIcon />
                  <div>
                    <strong>Risco de Imagem e LGPD:</strong>
                    <span>Sem gestão de descadastro (opt-out), gerando denúncias de spam imediatas.</span>
                  </div>
                </li>
              </ul>
            </div>

            {/* CARD 2: ENTERPRISE TRADICIONAL */}
            <div className="comparison-col muted-border">
              <div className="col-header">
                <span className="col-tag muted">Corporativo Tradicional</span>
                <h3>Plataformas Antigas & Enterprise</h3>
                <p className="col-sub">Zenvia, Take Blip, RD Conversas</p>
              </div>
              <ul className="comparison-points">
                <li>
                  <CrossIcon />
                  <div>
                    <strong>Custo Base Exorbitante:</strong>
                    <span>Mensalidades fixas de R$ 500 a R$ 2.500 apenas para manter a plataforma ativa.</span>
                  </div>
                </li>
                <li>
                  <CrossIcon />
                  <div>
                    <strong>Contratos e Fidelidade:</strong>
                    <span>Amarras contratuais de 12 meses e burocracia comercial demorada para ativar.</span>
                  </div>
                </li>
                <li>
                  <CrossIcon />
                  <div>
                    <strong>Sistemas Complexos e Lentos:</strong>
                    <span>Centenas de recursos legados que seu time não utiliza e dificultam a criação de campanhas.</span>
                  </div>
                </li>
                <li>
                  <CrossIcon />
                  <div>
                    <strong>Suporte Lento por Ticket:</strong>
                    <span>Filas demoradas de atendimento quando você precisa de ajuda rápida.</span>
                  </div>
                </li>
              </ul>
            </div>

            {/* CARD 3: SEND INTELIGENTTE (VENCEDOR) */}
            <div className="comparison-col highlight-border">
              <div className="featured-top-badge">A SOLUÇÃO IDEAL</div>
              <div className="col-header">
                <span className="col-tag success">API Oficial Meta Cloud</span>
                <h3>Send Inteligentte</h3>
                <p className="col-sub">Infraestrutura em nuvem direta e sem atrito</p>
              </div>
              <ul className="comparison-points">
                <li>
                  <CheckIcon />
                  <div>
                    <strong>Conexão Oficial Meta Graph v19:</strong>
                    <span>Tráfego homologado com segurança total para a reputação da sua marca e número.</span>
                  </div>
                </li>
                <li>
                  <CheckIcon />
                  <div>
                    <strong>100% em Nuvem (24/7):</strong>
                    <span>Funciona independente de aparelho celular ou conexão de internet local.</span>
                  </div>
                </li>
                <li>
                  <CheckIcon />
                  <div>
                    <strong>Preço Justo e Sem Fidelidade:</strong>
                    <span>Planos acessíveis para operações de todos os tamanhos, com cancelamento simples.</span>
                  </div>
                </li>
                <li>
                  <CheckIcon />
                  <div>
                    <strong>Onboarding Assistido Próximo:</strong>
                    <span>Acompanhamento direto com nossa equipe para homologar seu número e templates.</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* COMO FUNCIONA (4 ETAPAS CLARAS) */}
        <section className="steps-pipeline-section" id="como-funciona">
          <div className="section-header">
            <span className="section-badge">Fluxo Operacional</span>
            <h2>Da ativação ao primeiro disparo em 4 passos simples</h2>
            <p>Processo transparente e guiado para colocar sua operação no ar sem complicações técnicas.</p>
          </div>

          <div className="pipeline-grid">
            <div className="pipeline-card">
              <div className="step-number-badge">01</div>
              <div className="card-icon-header">
                <ShieldCheckIcon />
              </div>
              <h3>Conexão Oficial Meta</h3>
              <p>
                Vinculação direta via Meta Business Manager. Seu número recebe o selo de infraestrutura oficial em nuvem, pronto para escalar.
              </p>
              <div className="card-footer-pill">
                <span>Homologação Cloud API</span>
              </div>
            </div>

            <div className="pipeline-card">
              <div className="step-number-badge">02</div>
              <div className="card-icon-header">
                <ListIcon />
              </div>
              <h3>Gestão e Higienização</h3>
              <p>
                Importe planilhas CSV com nomes e variáveis customizadas. O sistema filtra automaticamente contatos que solicitaram descadastro.
              </p>
              <div className="card-footer-pill">
                <span>Opt-out & LGPD Nativo</span>
              </div>
            </div>

            <div className="pipeline-card">
              <div className="step-number-badge">03</div>
              <div className="card-icon-header">
                <MessageIcon />
              </div>
              <h3>Templates & Links Rastreáveis</h3>
              <p>
                Crie mensagens com botões interativos e encurtador de links próprio (<code>/t/:codigo</code>) para medir cliques e intenção de compra.
              </p>
              <div className="card-footer-pill">
                <span>Rastreamento Individual</span>
              </div>
            </div>

            <div className="pipeline-card highlighted">
              <div className="step-number-badge">04</div>
              <div className="card-icon-header">
                <ZapIcon />
              </div>
              <h3>Disparo & Métricas Vivas</h3>
              <p>
                Envio assíncrono com transactional outbox e controle de vazão. Acompanhe taxas de entrega, leitura e cliques em tempo real.
              </p>
              <div className="card-footer-pill success">
                <span>Relatórios em Tempo Real</span>
              </div>
            </div>
          </div>
        </section>

        {/* ENGENHARIA & RECURSOS TÉCNICOS */}
        <section className="tech-features-section" id="recursos">
          <div className="section-header">
            <span className="section-badge">Engenharia do Produto</span>
            <h2>Construído para confiabilidade, velocidade e escala</h2>
            <p>Recursos pensados para garantir a entrega de cada mensagem e proteger a integridade do seu número comercial.</p>
          </div>

          <div className="tech-features-grid">
            <article className="tech-card">
              <div className="tech-card-icon">
                <ServerIcon />
              </div>
              <h3>Meta WhatsApp Cloud API v19</h3>
              <p>
                Conexão nativa com a infraestrutura de mensagens da Meta. Alta disponibilidade e elegibilidade para selo de verificação oficial.
              </p>
            </article>

            <article className="tech-card">
              <div className="tech-card-icon">
                <ShieldCheckIcon />
              </div>
              <h3>Opt-out e Blacklist Automático</h3>
              <p>
                Identificação automática de pedidos de saída ("PARAR", "SAIR") para respeitar a LGPD e manter a nota de qualidade do número alta.
              </p>
            </article>

            <article className="tech-card">
              <div className="tech-card-icon">
                <LinkIcon />
              </div>
              <h3>Links Rastreáveis (/t/:slug)</h3>
              <p>
                Encurtador próprio que mapeia exatamente qual lead clicou no link da campanha, permitindo ações imediatas de fechamento comercial.
              </p>
            </article>

            <article className="tech-card">
              <div className="tech-card-icon">
                <LayersIcon />
              </div>
              <h3>Transactional Outbox com Retries</h3>
              <p>
                Fila de mensagens com persistência transacional e re-tentativas com backoff exponencial para garantir entrega sem duplicidades.
              </p>
            </article>

            <article className="tech-card">
              <div className="tech-card-icon">
                <TerminalIcon />
              </div>
              <h3>API REST & Chaves de API Seguras</h3>
              <p>
                Endpoints públicos em <code>/api/v1</code> protegidos por hash SHA-256 (<code>sk_live_...</code>) para integração com seus sistemas e backends.
              </p>
            </article>

            <article className="tech-card">
              <div className="tech-card-icon">
                <CpuIcon />
              </div>
              <h3>Integração com n8n, Make & CRMs</h3>
              <p>
                Webhooks de eventos de entrega e templates de fluxo prontos para n8n, conectando formulários, Typebot e CRMs em minutos.
              </p>
            </article>
          </div>
        </section>

        {/* DEMO INTERATIVA DE CÓDIGO / INTEGRAÇÃO */}
        <section className="code-integration-section" id="integracao">
          <div className="integration-container">
            <div className="integration-copy">
              <span className="section-badge">Developer Experience</span>
              <h2>Integre com seu ecossistema em minutos</h2>
              <p>
                Seja disparando manualmente por planilhas CSV ou automatizando com n8n, Webhooks e REST API, o Send Inteligentte se adapta ao seu fluxo.
              </p>

              <div className="integration-points">
                <div className="point-item">
                  <CheckIcon />
                  <span>Templates n8n prontos para importar com 1 clique</span>
                </div>
                <div className="point-item">
                  <CheckIcon />
                  <span>Webhooks em tempo real com eventos de entrega e clique</span>
                </div>
                <div className="point-item">
                  <CheckIcon />
                  <span>Documentação técnica clara para desenvolvedores</span>
                </div>
              </div>

              <div className="cta-doc-wrapper">
                <a
                  className="secondary-button"
                  href="https://wa.me/5511999999999?text=Ol%C3%A1!%20Gostaria%20de%20saber%20mais%20sobre%20as%20integra%C3%A7%C3%B5es%20da%20API%20do%20Send."
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <CodeIcon />
                  <span>Tirar Dúvidas de Integração</span>
                </a>
              </div>
            </div>

            {/* CAIXA DE CÓDIGO INTERATIVA */}
            <div className="code-box-wrapper">
              <div className="code-box-header">
                <div className="code-tabs">
                  <button
                    type="button"
                    className={`code-tab-btn ${activeCodeTab === "curl" ? "active" : ""}`}
                    onClick={() => setActiveCodeTab("curl")}
                  >
                    cURL / API REST
                  </button>
                  <button
                    type="button"
                    className={`code-tab-btn ${activeCodeTab === "n8n" ? "active" : ""}`}
                    onClick={() => setActiveCodeTab("n8n")}
                  >
                    Webhook n8n / CRM
                  </button>
                  <button
                    type="button"
                    className={`code-tab-btn ${activeCodeTab === "csv" ? "active" : ""}`}
                    onClick={() => setActiveCodeTab("csv")}
                  >
                    Estrutura CSV
                  </button>
                </div>

                <button
                  type="button"
                  className="copy-btn"
                  onClick={() => handleCopy(snippets[activeCodeTab])}
                  aria-label="Copiar código"
                >
                  {copiedSnippet ? "Copiado! ✓" : "Copiar"}
                </button>
              </div>

              <pre className="code-content">
                <code>{snippets[activeCodeTab]}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* CALCULADORA & TRANSPARÊNCIA DE CUSTOS META */}
        <section className="roi-calculator-section" id="simulador">
          <div className="calculator-box">
            <div className="calculator-header">
              <span className="section-badge">Transparência Total</span>
              <h2>Simule o alcance da sua próxima campanha</h2>
              <p>Arraste a barra para estimar métricas de entrega e visualização baseadas na infraestrutura oficial.</p>
            </div>

            <div className="calculator-slider-container">
              <div className="slider-label">
                <span>Tamanho da sua lista de contatos:</span>
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
                aria-label="Seletor de quantidade de contatos"
              />

              <div className="slider-range-indicators">
                <span>1.000</span>
                <span>25.000</span>
                <span>50.000</span>
              </div>
            </div>

            <div className="calculator-results">
              <div className="result-card">
                <span className="result-title">Mensagens Entregues (~99.2%)</span>
                <strong>{calculatedDeliveries.toLocaleString("pt-BR")}</strong>
                <small>Alta prioridade na rede Meta Cloud</small>
              </div>

              <div className="result-card highlight">
                <span className="result-title">Aberturas Estimadas (~74%)</span>
                <strong>~{calculatedReads.toLocaleString("pt-BR")}</strong>
                <small>Taxa média de leitura no WhatsApp</small>
              </div>

              <div className="result-card">
                <span className="result-title">Cliques em Links (~28%)</span>
                <strong>~{calculatedClicks.toLocaleString("pt-BR")}</strong>
                <small>Rastreados individualmente com /t/</small>
              </div>
            </div>

            <div className="meta-pricing-explanation">
              <div className="explanation-header">
                <ShieldCheckIcon />
                <h4>Como funciona a cobrança oficial da Meta?</h4>
              </div>
              <p>
                A Meta fornece <strong>1.000 conversas de serviço gratuitas todos os meses</strong> para cada conta oficial.
                Para disparos ativos de marketing e utilidade, a Meta debita uma pequena taxa por conversa diretamente na sua conta do Facebook Business.
                A assinatura do <strong>Send Inteligentte</strong> cobre todo o painel, links rastreáveis, infraestrutura de envio, outbox e suporte assistido.
              </p>
            </div>
          </div>
        </section>

        {/* PLANOS & PREÇOS */}
        <section className="pricing-section" id="planos">
          <div className="section-header">
            <span className="section-badge">Planos & Acesso</span>
            <h2>Estrutura completa. Escolha a melhor periodicidade.</h2>
            <p>Todos os recursos liberados em qualquer plano. Desconto progressivo nos planos mais longos.</p>
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

                  <div className="plan-price-wrapper">
                    <span className="currency">R$</span>
                    <span className="price">{plan.price}</span>
                    <span className="period">{plan.period}</span>
                  </div>

                  {plan.monthlyEquivalent ? (
                    <div className="monthly-equivalent">
                      Equivale a <strong>R$ {plan.monthlyEquivalent}/mês</strong>
                    </div>
                  ) : (
                    <div className="monthly-equivalent muted">Cobrança mensal sem fidelidade</div>
                  )}

                  <p className="plan-description-text">{plan.description}</p>
                </div>

                <div className="plan-divider" />

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
                  <span>Assinar {plan.name}</span>
                  <ArrowRightIcon />
                </Link>

                <p className="fine-print">Pagamento seguro via Asaas • Cancele quando quiser</p>
              </div>
            ))}
          </div>

          {/* BANNER DE IMPLANTAÇÃO ASSISTIDA */}
          <div className="inclusions-banner-box">
            <div className="banner-left">
              <span className="section-kicker green-text">ONBOARDING ASSISTIDO</span>
              <h3>Configuração guiada do zero à primeira campanha.</h3>
              <p>Nossa equipe técnica acompanha os primeiros passos da sua conta para garantir que seus templates e número estejam 100% homologados.</p>
            </div>
            <div className="banner-right">
              <ul>
                <li><CheckIcon /> Vinculação assistida do seu Meta Business Manager</li>
                <li><CheckIcon /> Orientação na aprovação de templates oficiais</li>
                <li><CheckIcon /> Suporte na formatação e importação das primeiras listas</li>
                <li><CheckIcon /> Verificação de regras de opt-out e boas práticas anti-spam</li>
              </ul>
            </div>
          </div>
        </section>

        {/* PERGUNTAS FREQUENTES */}
        <section className="faq-section" id="faq">
          <div className="section-header">
            <span className="section-badge">Tire suas Dúvidas</span>
            <h2>Perguntas Frequentes</h2>
            <p>Respostas diretas sobre a API Oficial, requisitos técnicos e funcionamento da plataforma.</p>
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

          {/* BANNER SUPORTE WHATSAPP */}
          <div className="faq-whatsapp-cta">
            <div className="faq-cta-left">
              <span className="faq-cta-badge">ATENDIMENTO DIRETO</span>
              <h3>Ficou com alguma dúvida sobre a API Oficial?</h3>
              <p>Fale diretamente com nossa equipe técnica pelo WhatsApp. Ajudamos a avaliar se o seu caso de uso está pronto para a API Oficial.</p>
            </div>
            <a
              href="https://wa.me/5511999999999?text=Ol%C3%A1!%20Gostaria%20de%20conversar%20sobre%20o%20Send%20Inteligentte%20e%20a%20API%20Oficial."
              target="_blank"
              rel="noopener noreferrer"
              className="whatsapp-support-btn"
            >
              <MessageIcon />
              <span>Falar no WhatsApp</span>
            </a>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="final-cta-section">
          <div className="cta-box">
            <h2>Pronto para profissionalizar seus disparos no WhatsApp?</h2>
            <p>Conecte sua operação à API Oficial da Meta e tenha estabilidade contínua para suas campanhas comerciais.</p>

            <div className="final-cta-actions">
              <a className="primary-button large" href="#planos">
                <ZapIcon />
                <span>Escolher meu Plano de Acesso</span>
              </a>
            </div>

            <div className="guarantee-footer-tag">
              <ShieldCheckIcon />
              <span>Garantia incondicional de 7 dias • Teste sem risco</span>
            </div>
          </div>
        </section>

        {/* RODAPÉ */}
        <footer className="site-footer simple-footer">
          <div className="simple-footer-content">
            <Brand />

            <nav className="simple-footer-nav" aria-label="Links do rodapé">
              <a href="#cenario">Por que Oficial?</a>
              <a href="#como-funciona">Como funciona</a>
              <a href="#recursos">Engenharia</a>
              <a href="#integracao">API & n8n</a>
              <a href="#simulador">Calculadora</a>
              <a href="#planos">Planos</a>
              <Link href="/PoliticaDePrivacidade.html" target="_blank">Privacidade</Link>
              <Link href="/TermosECondicoes.html" target="_blank">Termos</Link>
              <a href="https://app.sendinteligente.com.br" target="_blank" rel="noopener noreferrer">Área do Cliente</a>
            </nav>
          </div>

          <div className="simple-footer-bottom">
            <p>© {new Date().getFullYear()} Send Inteligentte. Todos os direitos reservados.</p>
            <div className="footer-badges">
              <span className="footer-pill">🛡️ Processamento Seguro Asaas</span>
              <span className="footer-pill">⚡ Meta WhatsApp Cloud v19</span>
              <span className="footer-pill">🔒 Conformidade LGPD</span>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
