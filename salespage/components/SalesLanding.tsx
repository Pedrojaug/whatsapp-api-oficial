"use client";

import React, { useState, useEffect } from "react";
import { Brand } from "./Brand";

// Ícones SVG Inline Minimalistas de Engenharia
function CheckCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

const PROMPT_SUGGESTIONS = [
  "Quero disparar uma oferta VIP para 5.000 clientes com 20% OFF...",
  "Quero recuperar carrinhos abandonados da minha loja no WhatsApp...",
  "Quero enviar confirmações de pedido e rastreio via n8n e Webhooks...",
  "Quero reativar clientes inativos com templates aprovados pela Meta..."
];

export const DEFAULT_PLANS = [
  {
    id: "starter",
    name: "Starter",
    description: "Ideal para pequenas empresas iniciando operações com a API Oficial.",
    price: "197",
    period: "/mês",
    badge: null,
    isPopular: false,
    features: [
      "Até 5.000 mensagens/mês",
      "1 Número de WhatsApp Oficial",
      "Gestão de Listas & Segmentação",
      "Links Rastreáveis (/t/:slug)",
      "Módulo de Opt-out automático (LGPD)",
      "Suporte via WhatsApp",
    ],
    cta: "Começar no Starter",
  },
  {
    id: "pro",
    name: "Profissional",
    description: "Para empresas com fluxo constante de disparos e automações integradas.",
    price: "397",
    period: "/mês",
    badge: "Mais Escolhido",
    isPopular: true,
    features: [
      "Até 25.000 mensagens/mês",
      "Até 3 Números de WhatsApp Oficial",
      "Acesso completo à API REST & Webhooks",
      "Templates de automação para n8n",
      "Links Rastreáveis com métricas em tempo real",
      "Onboarding assistido com nossa equipe",
      "Suporte Prioritário",
    ],
    cta: "Escolher Profissional",
  },
  {
    id: "scale",
    name: "Enterprise / Escala",
    description: "Para grandes volumes de envio e esteiras críticas de vendas.",
    price: "797",
    period: "/mês",
    badge: "Alta Vazão",
    isPopular: false,
    features: [
      "Disparos em escala ilimitada",
      "Múltiplos números e instâncias",
      "Vazão de alta prioridade (Tier Meta)",
      "Webhooks dedicados e IP exclusivo",
      "SLA de atendimento 24/7",
      "Gerente de conta exclusivo",
    ],
    cta: "Falar com Consultor",
  },
];

export const DEFAULT_FAQS = [
  {
    question: "Preciso manter o celular ligado à internet durante os disparos?",
    answer: "Não. Toda a infraestrutura roda 100% em nuvem. As mensagens trafegam diretamente pelos servidores oficiais da Meta, funcionando mesmo com seu computador e celular desligados.",
  },
  {
    question: "A API é oficial do WhatsApp?",
    answer: "Sim. A operação utiliza a infraestrutura oficial do WhatsApp Business Platform (Meta Cloud API). Isso elimina o risco de banimento de chip comum em disparadores não oficiais por emulação de QR Code.",
  },
  {
    question: "Posso utilizar meu número de telefone atual?",
    answer: "Sim! Se o seu número já estiver no WhatsApp comum ou Business, auxiliamos na migração para a API Oficial. Você também pode ativar números novos, fixos ou 0800 diretamente no seu Meta Business Manager.",
  },
  {
    question: "Como integro o Send Inteligentte com n8n, Make ou meu CRM?",
    answer: "Disponibilizamos uma API REST pública e segura autenticada por API Key, além de webhooks em tempo real de eventos de entrega, leitura e cliques em links. Você também recebe templates prontos de fluxo para n8n.",
  },
  {
    question: "Consigo acompanhar os resultados de entrega das minhas campanhas?",
    answer: "Sim. O painel exibe detalhadamente quais contatos receberam, leram e clicaram nos links das suas mensagens, além de registrar automaticamente qualquer pedido de descadastro.",
  },
  {
    question: "Vocês ajudam na configuração inicial (onboarding)?",
    answer: "Sim! Nossa equipe acompanha os primeiros passos da sua conta: ajudamos a vincular seu Meta Business Manager, configurar seu número oficial e homologar seus primeiros templates de campanha.",
  },
];

export function SalesLanding({ content }: { content?: any }) {
  const [activeTab, setActiveTab] = useState<"json" | "webhook" | "csv">("json");
  const [promptIndex, setPromptIndex] = useState(0);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const plans = (content && Array.isArray(content.plans) && content.plans.length > 0) ? content.plans : DEFAULT_PLANS;
  const faqs = (content && Array.isArray(content.faqs) && content.faqs.length > 0) ? content.faqs : DEFAULT_FAQS;

  // Efeito de rotação suave de prompts inspirador no Hero Base44
  useEffect(() => {
    const interval = setInterval(() => {
      setPromptIndex((prev) => (prev + 1) % PROMPT_SUGGESTIONS.length);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  // Intersection Observer para animação de scroll progressivo em todos os blocos
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -50px 0px"
      }
    );

    const elements = document.querySelectorAll(".reveal-block, .showcase-reveal");
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  const terminalSnippets = {
    json: `POST https://api.sendinteligente.com.br/v1/messages
Authorization: Bearer sec_live_94f8a2...
Content-Type: application/json

{
  "to": "5511999998888",
  "template": "aviso_promocao_vip",
  "parameters": {
    "nome": "Carlos Silva",
    "cupom": "VIP20OFF",
    "link": "https://suaempresa.com.br/oferta-vip"
  }
}`,
    webhook: `// Evento entregue via Webhook em tempo real
{
  "event": "message.delivered",
  "messageId": "wamid.HBgLMTE5OTk...",
  "recipient": "5511999998888",
  "status": "READ",
  "templateName": "aviso_promocao_v1",
  "clickedTrackingLink": true,
  "clickedUrl": "https://suaempresa.com.br/oferta-vip",
  "timestamp": "2026-08-31T15:00:00.000Z"
}`,
    csv: `Nome,Telefone,CodigoPedido,Desconto
Carlos Silva,5511999998888,PED-9402,15%
Mariana Costa,5521988887777,PED-9403,20%
Lucas Souza,5531977776666,PED-9404,10%

// Mapeamento automático de variáveis {{1}}, {{2}} e
// higienização automática com filtro de Opt-out (LGPD).`,
  };

  return (
    <div className="site-canvas-bg">
      {/* 1. HEADER TÉCNICO COM MOLDURA EDITORIAL */}
      <header className="site-header">
        <div className="header-left">
          <Brand />
          <div className="header-meta-badge">
            <span className="pulse-dot">
              <span className="pulse-ring"></span>
              <span className="pulse-core"></span>
            </span>
            <span className="badge-text">API Oficial Meta</span>
          </div>
        </div>

        <nav className="public-nav" aria-label="Navegação principal">
          <a href="#metricas">Métricas</a>
          <a href="#como-funciona">Como funciona</a>
          <a href="#showcase">Demonstração</a>
          <a href="#recursos">Recursos</a>
          <a href="#comparativo">Por que oficial?</a>
          <a href="#planos">Planos</a>
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
            <span>Começar agora</span>
          </a>
        </div>
      </header>

      {/* 2. HERO SECTION ESTILO BASE44 — EDITORIAL TECH COM MARCADORES EM CRUZ (+) */}
      <section className="hero-base44-section" id="hero">
        {/* Marcadores decorativos em cruz (+) nos cantos do container */}
        <div className="tech-cross tech-cross-tl" aria-hidden="true">+</div>
        <div className="tech-cross tech-cross-tr" aria-hidden="true">+</div>
        <div className="tech-cross tech-cross-bl" aria-hidden="true">+</div>
        <div className="tech-cross tech-cross-br" aria-hidden="true">+</div>

        <div className="hero-content-wrapper">
          {/* Badge Editorial de Marca / Infraestrutura */}
          <div className="hero-brand-pill">
            <span className="hero-pill-icon">
              <span className="pulse-core"></span>
            </span>
            <span className="hero-pill-title">Send Inteligentte</span>
            <span className="hero-pill-divider">/</span>
            <span className="hero-pill-meta">WhatsApp Meta Cloud API</span>
          </div>

          {/* Título Editorial Massivo com Tracking Fechado (-0.03em) */}
          <h1 className="hero-main-title">
            Dispare milhares de mensagens no WhatsApp sem depender de celular ou QR Code.
          </h1>

          {/* Subtítulo Editorial */}
          <p className="hero-sub-title">
            Infraestrutura em nuvem 24/7 para disparos em massa, recuperação de clientes e integrações via API com a estabilidade e conformidade oficial da Meta.
          </p>

          {/* Prompt Interativo de Início Rápido (Estilo Base44) */}
          <div className="hero-prompt-box">
            <div className="hero-prompt-input-wrapper">
              <span className="prompt-sparkle">✨</span>
              <span className="hero-prompt-text" key={promptIndex}>
                {PROMPT_SUGGESTIONS[promptIndex]}
              </span>
            </div>
            <a href="#planos" className="hero-prompt-action-btn">
              <span>Começar agora</span>
              <ArrowRightIcon />
            </a>
          </div>

          {/* Indicador Suave de Scroll */}
          <a href="#metricas" className="scroll-indicator-wrapper" aria-label="Rolar para ver métricas e painel">
            <div className="scroll-mouse-icon">
              <div className="scroll-mouse-dot" />
            </div>
            <span>Métricas &amp; Painel</span>
          </a>
        </div>
      </section>

      {/* 3. BENTO GRID DE MÉTRICAS (NOVO BLOCO DE PROVA MODULAR BASE44) */}
      <section className="metrics-bento-section reveal-block" id="metricas">
        <div className="metrics-bento-container">
          <div className="metrics-cross metrics-cross-tl" aria-hidden="true">+</div>
          <div className="metrics-cross metrics-cross-tr" aria-hidden="true">+</div>
          <div className="metrics-cross metrics-cross-bl" aria-hidden="true">+</div>
          <div className="metrics-cross metrics-cross-br" aria-hidden="true">+</div>

          <div className="metrics-bento-grid">
            {/* Card 1: 99.8% */}
            <div className="metric-bento-card">
              <div className="metric-card-top">
                <span className="metric-tag">METRIC.01 // DELIVERY</span>
                <span className="metric-status-dot"></span>
              </div>
              <div className="metric-giant-number">99.8%</div>
              <div className="metric-card-bottom">
                <h3 className="metric-label">Entregabilidade garantida</h3>
                <p className="metric-subtext">Envios diretos aos servidores da Meta sem filtros intermediários ou perda de pacotes.</p>
              </div>
            </div>

            {/* Card 2: 0 */}
            <div className="metric-bento-card solid-dark">
              <div className="metric-card-top">
                <span className="metric-tag">METRIC.02 // HARDWARE</span>
                <span className="metric-status-dot"></span>
              </div>
              <div className="metric-giant-number">0</div>
              <div className="metric-card-bottom">
                <h3 className="metric-label">Celulares conectados ou risco de queda</h3>
                <p className="metric-subtext">Sua operação roda 100% em nuvem com alta disponibilidade sem depender de aparelhos físicos.</p>
              </div>
            </div>

            {/* Card 3: < 2s */}
            <div className="metric-bento-card">
              <div className="metric-card-top">
                <span className="metric-tag">METRIC.03 // LATENCY</span>
                <span className="metric-status-dot"></span>
              </div>
              <div className="metric-giant-number">&lt; 2s</div>
              <div className="metric-card-bottom">
                <h3 className="metric-label">Latência média por disparo</h3>
                <p className="metric-subtext">Processamento de fila de alta vazão com confirmação de entrega e leitura em tempo real.</p>
              </div>
            </div>

            {/* Card 4: 100% */}
            <div className="metric-bento-card">
              <div className="metric-card-top">
                <span className="metric-tag">METRIC.04 // COMPLIANCE</span>
                <span className="metric-status-dot"></span>
              </div>
              <div className="metric-giant-number">100%</div>
              <div className="metric-card-bottom">
                <h3 className="metric-label">Cloud API Oficial Meta</h3>
                <p className="metric-subtext">Templates homologados pela Meta, opt-out automático e total conformidade com a LGPD.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. SHOWCASE REVELADO NO SCROLL (MOLDURA TÉCNICA BENTO) */}
      <section className="showcase-section showcase-perspective-wrapper" id="showcase">
        <div className="product-window showcase-reveal bento-showcase-frame">
          <div className="window-bar technical-window-bar">
            <div className="window-left-col">
              <div className="window-dots">
                <span className="dot dot-close" />
                <span className="dot dot-minimize" />
                <span className="dot dot-maximize" />
              </div>
              <div className="window-endpoint">
                <span className="endpoint-method">POST</span>
                <span className="endpoint-path">api.sendinteligente.com.br/v1/messages</span>
              </div>
            </div>

            <div className="window-center-col">
              <span className="window-console-title">CONSOLE // PRODUCTION_VIEW</span>
            </div>

            <div className="window-right-col">
              <div className="window-status-pill technical-status-pill">
                <span className="live-dot" />
                <span className="status-label">Meta Cloud API v19 • Operacional</span>
              </div>
            </div>
          </div>

          <div className="window-body">
            <video
              src="/showcase.mp4"
              poster="/dashboard-preview.png"
              controls
              playsInline
              autoPlay
              muted
              loop
              preload="metadata"
              className="product-video"
            >
              <source src="/showcase.mp4" type="video/mp4" />
              <img
                src="/dashboard-preview.png"
                alt="Interface do Painel Operacional Send Inteligentte"
                className="product-screenshot"
              />
            </video>
          </div>

          <div className="window-footer-bar">
            <div className="window-footer-item">
              <span className="footer-meta-key">ENGINE:</span>
              <span className="footer-meta-val">Meta Cloud API v19.0</span>
            </div>
            <div className="window-footer-item">
              <span className="footer-meta-key">ROUTING:</span>
              <span className="footer-meta-val">Direct BSP Cloud</span>
            </div>
            <div className="window-footer-item">
              <span className="footer-meta-key">SECURITY:</span>
              <span className="footer-meta-val">LGPD Opt-out Suppressed</span>
            </div>
          </div>
        </div>
      </section>

      <main className="sales-page">
        {/* 4. DESTRUIR A OBJEÇÃO: O RISCO DO IMPROVISO */}
        <section className="problem-statement-section reveal-block" id="como-funciona">
          <div className="editorial-header">
            <h2>
              O problema não é enviar uma mensagem. <br />
              É enviar milhares delas sem transformar seu número em um problema.
            </h2>
            <p>
              Muitas operações ainda dependem de QR Code, sessões de WhatsApp Web, celulares conectados ou soluções que simulam o aplicativo. Funciona... até deixar de funcionar. O Send Inteligentte foi construído para operações que precisam de previsibilidade.
            </p>
          </div>

          <div className="problem-comparison-grid">
            <div className="problem-card muted reveal-block delay-1">
              <div className="card-kicker danger">QR Code / Emulação</div>
              <h3>Sessões instáveis</h3>
              <p>Seu negócio fica preso a uma sessão de navegador que expira, desconecta e corre risco constante de bloqueio do chip.</p>
            </div>

            <div className="problem-card muted reveal-block delay-2">
              <div className="card-kicker danger">Aparelho Celular</div>
              <h3>Gargalo físico</h3>
              <p>Bateria descarregada, Wi-Fi oscilando ou celular desligado travam imediatamente o envio das mensagens da sua empresa.</p>
            </div>

            <div className="problem-card highlighted reveal-block delay-3">
              <div className="card-kicker green">Send Inteligentte</div>
              <h3>Infraestrutura oficial</h3>
              <p>As campanhas rodam diretamente nos servidores em nuvem da Meta, com estabilidade 24 horas por dia, 7 dias por semana.</p>
            </div>
          </div>
        </section>

        {/* 5. PILARES DE VALOR (01, 02, 03, 04) */}
        <section className="value-pillars-section reveal-block">
          <div className="editorial-header">
            <h2>Quando o canal de vendas é importante demais para depender de improviso.</h2>
            <p>Tudo o que sua equipe precisa para ter tranquilidade operacional e foco exclusivo em vender mais.</p>
          </div>

          <div className="value-pillars-grid">
            <div className="pillar-item reveal-block delay-1">
              <div className="pillar-number">01</div>
              <h3>Operação contínua</h3>
              <p>Sua equipe não precisa deixar nenhum computador ou celular conectado para a campanha funcionar e entregar.</p>
            </div>

            <div className="pillar-item reveal-block delay-2">
              <div className="pillar-number">02</div>
              <h3>Mais controle</h3>
              <p>Campanhas, contatos, templates homologados e resultados consolidados em um único ambiente limpo.</p>
            </div>

            <div className="pillar-item reveal-block delay-3">
              <div className="pillar-number">03</div>
              <h3>Menos risco</h3>
              <p>Estrutura dentro das diretrizes oficiais do WhatsApp, com gestão nativa de descadastro (Opt-out) para conformidade com a LGPD.</p>
            </div>

            <div className="pillar-item reveal-block delay-4">
              <div className="pillar-number">04</div>
              <h3>Integração real</h3>
              <p>Conecte seus sistemas existentes via Webhooks, API REST padronizada ou fluxos no n8n sem depender de gambiarras.</p>
            </div>
          </div>
        </section>

        {/* 6. ARQUITETURA DO PRODUTO (BENTO GRID MODULAR COM LISTAS INTERATIVAS) */}
        <section className="product-architecture-section reveal-block" id="recursos">
          <div className="editorial-header">
            <div className="section-kicker">INFRAESTRUTURA &amp; RECURSOS</div>
            <h2>Engenharia de precisão para sua esteira de WhatsApp.</h2>
            <p>Criado para máxima velocidade de disparo, homologação instantânea de templates e rastreamento avançado.</p>
          </div>

          <div className="bento-resources-container">
            {/* Card 1: Campanhas e Segmentação (Asymmetric Span 7) */}
            <div className="bento-resource-card span-7">
              <div className="bento-card-header">
                <span className="bento-kicker">RECURSO.01 // CAMPAIGNS &amp; DISPATCH</span>
                <h3>Disparos em massa com cadência inteligente</h3>
                <p>Importe planilhas massivas com auto-mapping e controle a vazão de envio por segundo para máxima entregabilidade.</p>
              </div>

              <div className="interactive-resource-list">
                <div className="interactive-resource-item">
                  <div className="resource-item-info">
                    <span className="resource-item-title">Importação instantânea CSV / XLSX com auto-mapping</span>
                    <span className="resource-item-desc">Mapeamento automático de variáveis customizadas como nome, cupom e pedido</span>
                  </div>
                  <span className="action-circle-btn" aria-hidden="true">
                    <ArrowUpRightIcon />
                  </span>
                </div>

                <div className="interactive-resource-item">
                  <div className="resource-item-info">
                    <span className="resource-item-title">Controle de cadência e vazão por segundo</span>
                    <span className="resource-item-desc">Fila distribuída com intervalos controlados para assegurar alta reputação junto à Meta</span>
                  </div>
                  <span className="action-circle-btn" aria-hidden="true">
                    <ArrowUpRightIcon />
                  </span>
                </div>

                <div className="interactive-resource-item">
                  <div className="resource-item-info">
                    <span className="resource-item-title">Variáveis dinâmicas no corpo e nos botões</span>
                    <span className="resource-item-desc">Personalize o texto, links individuais e botões de resposta rápida</span>
                  </div>
                  <span className="action-circle-btn" aria-hidden="true">
                    <ArrowUpRightIcon />
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Homologação de Templates (Asymmetric Span 5) */}
            <div className="bento-resource-card span-5">
              <div className="bento-card-header">
                <span className="bento-kicker">RECURSO.02 // META TEMPLATES</span>
                <h3>Homologação oficial de templates</h3>
                <p>Crie, edite e sincronize modelos diretamente com os servidores da Meta sem sair do painel.</p>
              </div>

              <div className="interactive-resource-list">
                <div className="interactive-resource-item">
                  <div className="resource-item-info">
                    <span className="resource-item-title">Sincronização bidirecional em tempo real</span>
                    <span className="resource-item-desc">Acompanhe status Aprovado, Pendente ou Rejeitado pela Meta</span>
                  </div>
                  <span className="action-circle-btn" aria-hidden="true">
                    <ArrowUpRightIcon />
                  </span>
                </div>

                <div className="interactive-resource-item">
                  <div className="resource-item-info">
                    <span className="resource-item-title">Pré-visualização fiel ao smartphone</span>
                    <span className="resource-item-desc">Valide o visual da mensagem em telas iOS e Android antes do disparo</span>
                  </div>
                  <span className="action-circle-btn" aria-hidden="true">
                    <ArrowUpRightIcon />
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Links & Opt-out LGPD (Asymmetric Span 5) */}
            <div className="bento-resource-card span-5">
              <div className="bento-card-header">
                <span className="bento-kicker">RECURSO.03 // TRACKING &amp; LGPD</span>
                <h3>Links rastreáveis e proteção LGPD</h3>
                <p>Monitore quem clica em cada campanha e garanta conformidade legal imediata com descadastro automático.</p>
              </div>

              <div className="interactive-resource-list">
                <div className="interactive-resource-item">
                  <div className="resource-item-info">
                    <span className="resource-item-title">Encurtador próprio com métricas por contato</span>
                    <span className="resource-item-desc">Identifique exatamente quais leads clicaram nos seus links de oferta</span>
                  </div>
                  <span className="action-circle-btn" aria-hidden="true">
                    <ArrowUpRightIcon />
                  </span>
                </div>

                <div className="interactive-resource-item">
                  <div className="resource-item-info">
                    <span className="resource-item-title">Supressão automática por palavra-chave (Opt-out)</span>
                    <span className="resource-item-desc">Blacklist instantânea ao receber &quot;PARAR&quot; ou &quot;SAIR&quot;, blindando sua operação</span>
                  </div>
                  <span className="action-circle-btn" aria-hidden="true">
                    <ArrowUpRightIcon />
                  </span>
                </div>
              </div>
            </div>

            {/* Card 4: Conectividade & n8n (Asymmetric Span 7) */}
            <div className="bento-resource-card span-7 solid-dark">
              <div className="bento-card-header">
                <span className="bento-kicker">RECURSO.04 // INTEGRATIONS &amp; API</span>
                <h3>API REST dedicada e ecossistema n8n</h3>
                <p>Integre seu CRM, plataformas de e-commerce e esteiras de automação sem depender de soluções amadoras.</p>
              </div>

              <div className="interactive-resource-list">
                <div className="interactive-resource-item">
                  <div className="resource-item-info">
                    <span className="resource-item-title">Webhooks em tempo real com eventos de telemetria</span>
                    <span className="resource-item-desc">Notificações imediatas para mensagens entregues, lidas e links clicados</span>
                  </div>
                  <span className="action-circle-btn" aria-hidden="true">
                    <ArrowUpRightIcon />
                  </span>
                </div>

                <div className="interactive-resource-item">
                  <div className="resource-item-info">
                    <span className="resource-item-title">Templates pré-configurados para n8n &amp; Make</span>
                    <span className="resource-item-desc">Fluxos prontos para recuperação de boletos, pix e avisos de entrega</span>
                  </div>
                  <span className="action-circle-btn" aria-hidden="true">
                    <ArrowUpRightIcon />
                  </span>
                </div>

                <div className="interactive-resource-item">
                  <div className="resource-item-info">
                    <span className="resource-item-title">Chaves de API seguras com autenticação Bearer</span>
                    <span className="resource-item-desc">Controle granular de acesso para múltiplos desenvolvedores e ambientes</span>
                  </div>
                  <span className="action-circle-btn" aria-hidden="true">
                    <ArrowUpRightIcon />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7. TABELA COMPARATIVA TÉCNICA */}
        <section className="comparison-table-section reveal-block" id="comparativo">
          <div className="editorial-header">
            <h2>Por que migrar para a infraestrutura oficial?</h2>
            <p>Entenda a diferença estrutural entre soluções caseiras e uma plataforma desenhada para escala.</p>
          </div>

          <div className="table-wrapper">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Critério Operacional</th>
                  <th className="highlight-col">Send Inteligentte (Oficial)</th>
                  <th>Soluções QR Code / Web</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="criteria-name">Conexão</td>
                  <td className="highlight-col text-green">Nuvem direta na Meta (Cloud API)</td>
                  <td className="text-muted">Sessão web pareada em navegador</td>
                </tr>
                <tr>
                  <td className="criteria-name">Dependência física</td>
                  <td className="highlight-col text-green">Zero celular ou computador ligado</td>
                  <td className="text-muted">Celular com internet e bateria contínua</td>
                </tr>
                <tr>
                  <td className="criteria-name">Segurança contra banimento</td>
                  <td className="highlight-col text-green">Templates aprovados pela Meta</td>
                  <td className="text-muted">Alto risco por envio automatizado não oficial</td>
                </tr>
                <tr>
                  <td className="criteria-name">Velocidade & Vazão</td>
                  <td className="highlight-col text-green">Centenas de mensagens por segundo</td>
                  <td className="text-muted">Lento e sujeito a desconexão</td>
                </tr>
                <tr>
                  <td className="criteria-name">Status em Tempo Real</td>
                  <td className="highlight-col text-green">Enviado, Entregue, Lido e Clicado</td>
                  <td className="text-muted">Confirmação instável ou ausente</td>
                </tr>
                <tr>
                  <td className="criteria-name">Proteção Jurídica (LGPD)</td>
                  <td className="highlight-col text-green">Módulo de Opt-out automático</td>
                  <td className="text-muted">Controle manual em planilhas</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 8. INTEGRAÇÃO E TERMINAL TÉCNICO */}
        <section className="integrations-section reveal-block" id="integracoes">
          <div className="integrations-container">
            <div className="integrations-copy">
              <div className="section-kicker">Desenvolvedores & Automação</div>
              <h2>Feito para integrar com o que você já usa.</h2>
              <p>
                Seja disparando por uma planilha CSV ou integrando sua esteira com n8n, CRM ou webhook de pagamentos, o Send Inteligentte se adapta ao seu fluxo sem fricção.
              </p>

              <div className="integration-chips-list">
                <span className="chip">REST API</span>
                <span className="chip">Webhooks</span>
                <span className="chip">n8n Community</span>
                <span className="chip">CSV / Excel</span>
                <span className="chip">Typebot</span>
                <span className="chip">Zapier & Make</span>
              </div>
            </div>

            <div className="terminal-box">
              <div className="terminal-header">
                <div className="terminal-tabs">
                  <button
                    className={`terminal-tab ${activeTab === "json" ? "active" : ""}`}
                    onClick={() => setActiveTab("json")}
                  >
                    API REST
                  </button>
                  <button
                    className={`terminal-tab ${activeTab === "webhook" ? "active" : ""}`}
                    onClick={() => setActiveTab("webhook")}
                  >
                    Webhooks
                  </button>
                  <button
                    className={`terminal-tab ${activeTab === "csv" ? "active" : ""}`}
                    onClick={() => setActiveTab("csv")}
                  >
                    CSV & Variáveis
                  </button>
                </div>
              </div>
              <pre className="terminal-body">
                <code>{terminalSnippets[activeTab]}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* 9. PROVA OPERACIONAL / CONFIANÇA */}
        <section className="operational-proof-section reveal-block">
          <div className="editorial-header center-align">
            <h2>Transparência e foco em resultado desde o primeiro dia.</h2>
            <p>Construímos uma ferramenta objetiva: você conecta seu WhatsApp Business, valida seus modelos e começa a rodar suas campanhas com segurança.</p>
          </div>

          <div className="proof-deliverables-grid">
            <div className="proof-card reveal-block delay-1">
              <ShieldCheckIcon />
              <h4>Configuração Apoiada</h4>
              <p>Auxiliamos na criação e verificação da sua conta no Gerenciador de Negócios da Meta.</p>
            </div>

            <div className="proof-card reveal-block delay-2">
              <ShieldCheckIcon />
              <h4>Suporte Direto</h4>
              <p>Atendimento humanizado via WhatsApp com os desenvolvedores da plataforma para destravar suas campanhas.</p>
            </div>

            <div className="proof-card reveal-block delay-3">
              <ShieldCheckIcon />
              <h4>Sem Fidelidade</h4>
              <p>Contrate o plano que melhor atende sua demanda de disparos e cancele quando quiser, sem multas.</p>
            </div>
          </div>
        </section>

        {/* 10. PLANOS E PREÇOS (TABELA ASSIMÉTRICA) */}
        <section className="pricing-section reveal-block" id="planos">
          <div className="editorial-header center-align">
            <div className="section-kicker">PLANOS &amp; INVESTIMENTO</div>
            <h2>Preços transparentes para escalar sua operação.</h2>
            <p>Infraestrutura em nuvem pronta para disparar. Sem contratos de fidelidade ou taxas ocultas.</p>
          </div>

          <div className="pricing-grid asymmetric-pricing-grid">
            {plans.map((plan: any) => {
              const planSlug = plan.id === "starter" ? "mensal" : plan.id === "scale" ? "anual" : "trimestral";
              const isMain = plan.isPopular;

              return (
                <div
                  key={plan.id}
                  className={`pricing-card ${isMain ? "featured-asymmetric" : "secondary-card"}`}
                >
                  {isMain && (
                    <div className="asymmetric-badge">
                      <span>RECOMENDADO // MAIS ESCOLHIDO</span>
                    </div>
                  )}

                  <div className="pricing-card-header">
                    <span className="pricing-plan-id">PLANO // {plan.id.toUpperCase()}</span>
                    <h3>{plan.name}</h3>
                    <p className="pricing-desc">{plan.description}</p>
                  </div>

                  <div className="pricing-price-box">
                    <span className="price-currency">R$</span>
                    <span className="price-amount">{plan.price}</span>
                    <span className="price-period">{plan.period}</span>
                  </div>

                  <ul className="pricing-features">
                    {plan.features.map((feature: string, idx: number) => (
                      <li key={idx}>
                        <CheckCircleIcon />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <a
                    href={`/checkout?plano=${planSlug}&plan=${plan.id}`}
                    className={`pricing-cta-button ${isMain ? "primary" : "secondary"}`}
                  >
                    {plan.cta}
                    {isMain && <ArrowRightIcon />}
                  </a>
                </div>
              );
            })}
          </div>

          <div className="pricing-meta-disclaimer">
            <p>
              * As mensagens pela API Oficial da Meta são tarifadas pelo seu consumo direto no Meta Business Manager conforme as categorias de Marketing, Utilidade e Serviço.
            </p>
          </div>
        </section>

        {/* 11. FAQ EM ACORDEÃO EDITORIAL */}
        <section className="faq-section reveal-block" id="faq">
          <div className="editorial-header">
            <div className="section-kicker">TIRE SUAS DÚVIDAS</div>
            <h2>Perguntas Frequentes</h2>
            <p>Tudo o que você precisa saber sobre a Cloud API Oficial da Meta e o funcionamento da plataforma.</p>
          </div>

          <div className="faq-accordion-container">
            {faqs.map((faq: any, idx: number) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className={`faq-accordion-item ${isOpen ? "is-expanded" : ""}`}
                >
                  <button
                    type="button"
                    className="faq-accordion-trigger"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                  >
                    <div className="faq-trigger-left">
                      <span className="faq-item-index">0{idx + 1}</span>
                      <span className="faq-item-question">{faq.question}</span>
                    </div>
                    <span className="faq-toggle-circle" aria-hidden="true">
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>

                  <div className={`faq-accordion-body ${isOpen ? "open" : ""}`}>
                    <div className="faq-accordion-inner">
                      <p>{faq.answer}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="faq-contact-box">
            <div>
              <h4>Ainda tem dúvidas sobre a API Oficial?</h4>
              <p>Fale diretamente com nosso time técnico pelo WhatsApp.</p>
            </div>
            <a
              href="https://wa.me/5583920017106?text=Ol%C3%A1!%20Gostaria%20de%20tirar%20d%C3%BAvidas%20sobre%20o%20Send%20Inteligentte."
              target="_blank"
              rel="noopener noreferrer"
              className="secondary-button"
            >
              Conversar com especialista →
            </a>
          </div>
        </section>

        {/* 12. CTA FINAL */}
        <section className="final-closing-section reveal-block">
          <div className="closing-content-box">
            <h2>Pronto para profissionalizar seus disparos de WhatsApp?</h2>
            <p>
              Abandone o improviso do QR Code e coloque sua esteira de vendas na infraestrutura mais estável do mercado.
            </p>
            <div className="closing-actions">
              <a className="primary-button large" href="#planos">
                <span>Criar minha conta agora</span>
                <ArrowRightIcon />
              </a>
              <a
                className="secondary-button large"
                href="https://wa.me/5583920017106?text=Ol%C3%A1!%20Quero%20uma%20demonstra%C3%A7%C3%A3o%20do%20Send%20Inteligentte."
                target="_blank"
                rel="noopener noreferrer"
              >
                Falar com consultor
              </a>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="site-footer">
          <div className="footer-top">
            <Brand />
            <p className="footer-description">
              Plataforma de disparo e automação em nuvem para WhatsApp utilizando a API Oficial da Meta Cloud.
            </p>
          </div>

          <div className="footer-bottom">
            <p>© {new Date().getFullYear()} Send Inteligentte. Todos os direitos reservados.</p>
            <div className="footer-links">
              <a href="/politica-de-privacidade">Privacidade</a>
              <a href="/termos-e-condicoes">Termos de Uso</a>
              <a href="https://wa.me/5583920017106" target="_blank" rel="noopener noreferrer">Suporte</a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default SalesLanding;
