import React from "react";
import Brand from "./Brand";
import siteContent from "../data/site-content.json";

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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

export default function SalesLanding() {
  const content = siteContent;
  const [activeTab, setActiveTab] = React.useState<"json" | "webhook" | "csv">("json");

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
    <main className="main-wrapper">
      {/* 1. HEADER MINIMALISTA */}
      <header className="site-header">
        <Brand />

        <nav className="public-nav" aria-label="Navegação principal">
          <a href="#como-funciona">Como funciona</a>
          <a href="#recursos">Recursos</a>
          <a href="#comparativo">Por que oficial?</a>
          <a href="#integracoes">Integrações</a>
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

      <div className="sales-page">
        {/* 2. HERO SECTION */}
        <section className="hero-section" id="hero">
          <div className="hero-container">
            <div className="hero-copy">
              <h1>
                Seu WhatsApp comercial. <br />
                <span className="text-highlight">Sem depender de celular, QR Code ou improviso.</span>
              </h1>

              <p className="hero-lead">
                {content.heroDescription}
              </p>

              <div className="hero-actions">
                <a className="primary-button large" href="#planos">
                  <span>{content.primaryCta}</span>
                  <ArrowRightIcon />
                </a>
                <a className="secondary-button large" href="#como-funciona">
                  <span>{content.secondaryCta}</span>
                </a>
              </div>

              <div className="hero-discrete-tags">
                <span>API oficial do WhatsApp</span>
                <span className="tag-dot">•</span>
                <span>Disparos em nuvem 24/7</span>
                <span className="tag-dot">•</span>
                <span>Opt-out automático (LGPD)</span>
                <span className="tag-dot">•</span>
                <span>Integração via REST API & n8n</span>
              </div>
            </div>

            {/* SHOWCASE EDITORIAL DO PRODUTO (VÍDEO REAL DO PAINEL) */}
            <div className="hero-product-showcase">
              <div className="product-window">
                <div className="window-bar">
                  <div className="window-dots">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                  </div>
                  <div className="window-title">app.sendinteligente.com.br/dashboard</div>
                  <div className="window-status-pill">
                    <span className="live-dot" />
                    <span>Oficial Conectado</span>
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
              </div>
            </div>
          </div>
        </section>

        {/* 3. DESTRUIR A OBJEÇÃO: O RISCO DO IMPROVISO */}
        <section className="problem-statement-section" id="como-funciona">
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
            <div className="problem-card muted">
              <div className="card-kicker danger">QR Code / Emulação</div>
              <h3>Sessões instáveis</h3>
              <p>Seu negócio fica preso a uma sessão de navegador que expira, desconecta e corre risco constante de bloqueio do chip.</p>
            </div>

            <div className="problem-card muted">
              <div className="card-kicker danger">Aparelho Celular</div>
              <h3>Gargalo físico</h3>
              <p>Bateria descarregada, Wi-Fi oscilando ou celular desligado travam imediatamente o envio das mensagens da sua empresa.</p>
            </div>

            <div className="problem-card highlighted">
              <div className="card-kicker green">Send Inteligentte</div>
              <h3>Infraestrutura oficial</h3>
              <p>As campanhas rodam diretamente nos servidores em nuvem da Meta, com estabilidade 24 horas por dia, 7 dias por semana.</p>
            </div>
          </div>
        </section>

        {/* 4. POR QUE ISSO IMPORTA: PREVISIBILIDADE COMERCIAL */}
        <section className="value-pillars-section">
          <div className="editorial-header">
            <h2>Quando o canal de vendas é importante demais para depender de improviso.</h2>
            <p>Tudo o que sua equipe precisa para ter tranquilidade operacional e foco exclusivo em vender mais.</p>
          </div>

          <div className="value-pillars-grid">
            <div className="pillar-item">
              <div className="pillar-number">01</div>
              <h3>Operação contínua</h3>
              <p>Sua equipe não precisa deixar nenhum computador ou celular conectado para a campanha funcionar e entregar.</p>
            </div>

            <div className="pillar-item">
              <div className="pillar-number">02</div>
              <h3>Mais controle</h3>
              <p>Campanhas, contatos, templates homologados e resultados consolidados em um único ambiente limpo.</p>
            </div>

            <div className="pillar-item">
              <div className="pillar-number">03</div>
              <h3>Menos risco</h3>
              <p>Estrutura dentro das diretrizes oficiais do WhatsApp, com gestão nativa de descadastro (Opt-out) para conformidade total com a LGPD.</p>
            </div>

            <div className="pillar-item">
              <div className="pillar-number">04</div>
              <h3>Integração real</h3>
              <p>Conecte seus sistemas existentes via Webhooks, API REST padronizada ou fluxos visuais no n8n sem depender de hacks.</p>
            </div>
          </div>
        </section>

        {/* 5. ARQUITETURA DO PRODUTO: OS 4 BLOCOS PRINCIPAIS */}
        <section className="product-architecture-section" id="recursos">
          <div className="editorial-header">
            <h2>O que você encontra na plataforma.</h2>
            <p>Criado com uma interface enxuta e direta, priorizando velocidade de disparo, facilidade de uso e clareza nas métricas.</p>
          </div>

          <div className="product-features-grid">
            <div className="feature-block">
              <div className="feature-kicker">Disparos</div>
              <h3>Campanhas & Segmentação</h3>
              <p>Suba planilhas CSV ou crie listas por tags. Programe disparos imediatos ou agendados, com controle automático de intervalo de envio.</p>
              <ul className="feature-bullet-list">
                <li><CheckCircleIcon /> Importação rápida com mapeamento inteligente</li>
                <li><CheckCircleIcon /> Variáveis dinâmicas no corpo e nos botões</li>
                <li><CheckCircleIcon /> Envio cadenciado contra sobrecarga</li>
              </ul>
            </div>

            <div className="feature-block">
              <div className="feature-kicker">Homologação</div>
              <h3>Gestão de Templates</h3>
              <p>Crie, edite e acompanhe o status de aprovação dos seus modelos de mensagem junto à Meta diretamente pelo painel.</p>
              <ul className="feature-bullet-list">
                <li><CheckCircleIcon /> Sincronização automática com a conta Meta</li>
                <li><CheckCircleIcon /> Pré-visualização idêntica ao aplicativo</li>
                <li><CheckCircleIcon /> Categorias de Marketing, Utilidade e Autenticação</li>
              </ul>
            </div>

            <div className="feature-block">
              <div className="feature-kicker">Inteligência</div>
              <h3>Links & Descadastro</h3>
              <p>Rastreie exatamente quais contatos clicaram nas suas ofertas e garanta descadastros automáticos sem intervenção manual.</p>
              <ul className="feature-bullet-list">
                <li><CheckCircleIcon /> Encurtador de links com contagem de cliques</li>
                <li><CheckCircleIcon /> Lista de supressão imediata por palavra-chave</li>
                <li><CheckCircleIcon /> Conformidade com LGPD e diretrizes Meta</li>
              </ul>
            </div>

            <div className="feature-block">
              <div className="feature-kicker">Conectividade</div>
              <h3>API Pública & n8n</h3>
              <p>Automações de ponta a ponta. Dispare mensagens a partir do seu CRM, checkout de e-commerce ou esteira de vendas.</p>
              <ul className="feature-bullet-list">
                <li><CheckCircleIcon /> Chaves de API com permissões granulares</li>
                <li><CheckCircleIcon /> Webhooks para eventos de envio, entrega e leitura</li>
                <li><CheckCircleIcon /> Compatível com n8n, Make, Typebot e Zapier</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 6. TABELA COMPARATIVA TÉCNICA */}
        <section className="comparison-table-section" id="comparativo">
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

        {/* 7. INTEGRAÇÃO E TERMINAL TÉCNICO */}
        <section className="integrations-section" id="integracoes">
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

        {/* 8. PROVA OPERACIONAL / CONFIANÇA */}
        <section className="operational-proof-section">
          <div className="editorial-header center-align">
            <h2>Transparência e foco em resultado desde o primeiro dia.</h2>
            <p>Construímos uma ferramenta objetiva: você conecta seu WhatsApp Business, valida seus modelos e começa a rodar suas campanhas com segurança.</p>
          </div>

          <div className="proof-deliverables-grid">
            <div className="proof-card">
              <ShieldCheckIcon />
              <h4>Configuração Apoiada</h4>
              <p>Auxiliamos na criação e verificação da sua conta no Gerenciador de Negócios da Meta.</p>
            </div>

            <div className="proof-card">
              <ShieldCheckIcon />
              <h4>Suporte Direto</h4>
              <p>Atendimento humanizado via WhatsApp com os desenvolvedores da plataforma para destravar suas campanhas.</p>
            </div>

            <div className="proof-card">
              <ShieldCheckIcon />
              <h4>Sem Fidelidade</h4>
              <p>Contrate o plano que melhor atende sua demanda de disparos e cancele quando quiser, sem multas.</p>
            </div>
          </div>
        </section>

        {/* 9. PLANOS E PREÇOS */}
        <section className="pricing-section" id="planos">
          <div className="editorial-header center-align">
            <h2>Planos transparentes para sua operação.</h2>
            <p>Escolha o volume ideal para o tamanho da sua base de clientes.</p>
          </div>

          <div className="pricing-grid">
            {content.plans.map((plan) => (
              <div
                key={plan.id}
                className={`pricing-card ${plan.isPopular ? "featured" : ""}`}
              >
                {plan.badge && <span className="pricing-badge">{plan.badge}</span>}

                <div className="pricing-card-header">
                  <h3>{plan.name}</h3>
                  <p className="pricing-desc">{plan.description}</p>
                </div>

                <div className="pricing-price-box">
                  <span className="price-currency">R$</span>
                  <span className="price-amount">{plan.price}</span>
                  <span className="price-period">{plan.period}</span>
                </div>

                <ul className="pricing-features">
                  {plan.features.map((feature, idx) => (
                    <li key={idx}>
                      <CheckCircleIcon />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href={`/checkout?plan=${plan.id}`}
                  className={`pricing-cta-button ${plan.isPopular ? "primary" : "secondary"}`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>

          <div className="pricing-meta-disclaimer">
            <p>
              * Os custos de mensagens da API Oficial são tarifados diretamente pela Meta de acordo com o tipo de conversa (Marketing, Utilidade ou Serviço).
            </p>
          </div>
        </section>

        {/* 10. PERGUNTAS FREQUENTES (FAQ) */}
        <section className="faq-section" id="faq">
          <div className="editorial-header">
            <h2>Perguntas Frequentes</h2>
            <p>Tudo o que você precisa saber antes de começar.</p>
          </div>

          <div className="faq-list">
            {content.faqs.map((faq, idx) => (
              <div key={idx} className="faq-item">
                <h3>{faq.question}</h3>
                <p>{faq.answer}</p>
              </div>
            ))}
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

        {/* 11. CTA FINAL */}
        <section className="final-closing-section">
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
      </div>
    </main>
  );
}
