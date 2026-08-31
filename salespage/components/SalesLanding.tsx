"use client";

import { useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  CodeIcon,
  CrossIcon,
  LayersIcon,
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
  const [activeCodeTab, setActiveCodeTab] = useState<"curl" | "n8n" | "csv">("curl");
  const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

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
    n8n: `// Webhook em tempo real: Send Inteligentte -> n8n / CRM
{
  "event": "message.status_updated",
  "messageId": "msg_89f023a12",
  "recipientPhone": "5511999998888",
  "status": "READ", // SENT | DELIVERED | READ | FAILED
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

            {/* SHOWCASE EDITORIAL DO PRODUTO */}
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
                  <img
                    src="/dashboard-preview.png"
                    alt="Interface do Painel Operacional Send Inteligentte"
                    className="product-screenshot"
                  />
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
              <h3>Saída respeitada (LGPD)</h3>
              <p>O contato que não deseja mais receber mensagens é identificado e retirado automaticamente das próximas listas.</p>
            </div>

            <div className="pillar-item">
              <div className="pillar-number">04</div>
              <h3>Integrações de verdade</h3>
              <p>API REST pública, webhooks em tempo real e templates prontos para n8n, Make, Typebot e seu CRM.</p>
            </div>
          </div>
        </section>

        {/* 5. MOSTRAR O PRODUTO EM AÇÃO */}
        <section className="product-features-section" id="recursos">
          <div className="editorial-header">
            <h2>Tudo o que você precisa para transformar uma lista em campanha.</h2>
            <p>Interface direta, desenvolvida para ser operada sem atrito por times de marketing, vendas e tecnologia.</p>
          </div>

          <div className="product-features-grid">
            <div className="feature-block">
              <div className="feature-icon-box">
                <MessageIcon />
              </div>
              <h3>Campanhas</h3>
              <p>Importe sua lista de contatos, selecione o template homologado e coloque a campanha para rodar com controle de vazão.</p>
            </div>

            <div className="feature-block">
              <div className="feature-icon-box">
                <ListIcon />
              </div>
              <h3>Gestão de contatos</h3>
              <p>Organize sua base por tags, personalize variáveis como nome e pedido, e respeite automaticamente quem pediu para sair.</p>
            </div>

            <div className="feature-block">
              <div className="feature-icon-box">
                <LinkIcon />
              </div>
              <h3>Links rastreáveis</h3>
              <p>Encurtador próprio que identifica individualmente cada lead que clicou na mensagem para ações rápidas de fechamento.</p>
            </div>

            <div className="feature-block">
              <div className="feature-icon-box">
                <LayersIcon />
              </div>
              <h3>Métricas de entrega</h3>
              <p>Acompanhe em tempo real o que aconteceu com cada disparo: mensagens entregues, lidas, clicadas e eventuais falhas.</p>
            </div>
          </div>
        </section>

        {/* 6. TABELA COMPARATIVA: OFICIAL MUDA TUDO */}
        <section className="comparison-table-section" id="comparativo">
          <div className="editorial-header">
            <h2>Oficial muda tudo.</h2>
            <p>Veja as diferenças práticas entre soluções improvisadas por QR Code e a infraestrutura oficial do Send Inteligentte.</p>
          </div>

          <div className="table-wrapper">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th className="th-feature">Critério Operacional</th>
                  <th className="th-other">Disparadores por QR Code</th>
                  <th className="th-official">Send Inteligentte</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="td-label">Depende de celular ligado?</td>
                  <td className="td-other"><CrossIcon /> Sim (celular obrigatório)</td>
                  <td className="td-official"><CheckIcon /> <strong>Não (100% em Nuvem)</strong></td>
                </tr>
                <tr>
                  <td className="td-label">Sessão de WhatsApp Web instável?</td>
                  <td className="td-other"><CrossIcon /> Sim (cai com frequência)</td>
                  <td className="td-official"><CheckIcon /> <strong>Não (Conexão direta Meta)</strong></td>
                </tr>
                <tr>
                  <td className="td-label">API Oficial do WhatsApp?</td>
                  <td className="td-other"><CrossIcon /> Não (emulação não autorizada)</td>
                  <td className="td-official"><CheckIcon /> <strong>Sim (Homologado pela Meta)</strong></td>
                </tr>
                <tr>
                  <td className="td-label">Métricas reais de entrega e leitura?</td>
                  <td className="td-other"><CrossIcon /> Limitadas e imprecisas</td>
                  <td className="td-official"><CheckIcon /> <strong>Sim (Relatórios em tempo real)</strong></td>
                </tr>
                <tr>
                  <td className="td-label">Opt-out e descadastro automático (LGPD)?</td>
                  <td className="td-other"><CrossIcon /> Não (risco de denúncia de spam)</td>
                  <td className="td-official"><CheckIcon /> <strong>Sim (Filtro automático de saída)</strong></td>
                </tr>
                <tr>
                  <td className="td-label">Integração com n8n, Make e CRMs?</td>
                  <td className="td-other"><CrossIcon /> Instável e complexa</td>
                  <td className="td-official"><CheckIcon /> <strong>Sim (REST API & Webhooks)</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 7. INTEGRAÇÕES (A TECNOLOGIA COMO PROVA) */}
        <section className="integrations-section" id="integracoes">
          <div className="integrations-container">
            <div className="integrations-copy">
              <h2>Feito para integrar com o que sua operação já usa.</h2>
              <p>
                Disponibilizamos endpoints REST, webhooks e templates prontos para conectar formulários, n8n, Make, Typebot e seu CRM em minutos.
              </p>

              <div className="integrations-bullets">
                <div className="bullet-row">
                  <CheckIcon />
                  <span>Templates n8n prontos para importar</span>
                </div>
                <div className="bullet-row">
                  <CheckIcon />
                  <span>Webhooks com status de entrega e cliques</span>
                </div>
                <div className="bullet-row">
                  <CheckIcon />
                  <span>Autenticação segura via API Key</span>
                </div>
              </div>
            </div>

            <div className="code-editor-box">
              <div className="code-editor-header">
                <div className="code-tabs-nav">
                  <button
                    type="button"
                    className={`tab-btn ${activeCodeTab === "curl" ? "active" : ""}`}
                    onClick={() => setActiveCodeTab("curl")}
                  >
                    API REST (cURL)
                  </button>
                  <button
                    type="button"
                    className={`tab-btn ${activeCodeTab === "n8n" ? "active" : ""}`}
                    onClick={() => setActiveCodeTab("n8n")}
                  >
                    Webhook n8n / CRM
                  </button>
                  <button
                    type="button"
                    className={`tab-btn ${activeCodeTab === "csv" ? "active" : ""}`}
                    onClick={() => setActiveCodeTab("csv")}
                  >
                    Estrutura CSV
                  </button>
                </div>

                <button
                  type="button"
                  className="copy-code-btn"
                  onClick={() => handleCopy(snippets[activeCodeTab])}
                  aria-label="Copiar código"
                >
                  {copiedSnippet ? "Copiado! ✓" : "Copiar"}
                </button>
              </div>

              <pre className="code-body">
                <code>{snippets[activeCodeTab]}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* 8. PROVA OPERACIONAL (ONBOARDING & SUPORTE HUMANO) */}
        <section className="operational-proof-section">
          <div className="operational-proof-card">
            <div className="proof-header">
              <span className="proof-kicker">Estrutura & Acompanhamento</span>
              <h2>Não vendemos disparo. Vendemos previsibilidade.</h2>
              <p>
                Seu time não precisa pensar em sessão, QR Code ou infraestrutura de envio. Você define a campanha; nós cuidamos da operação com acompanhamento próximo.
              </p>
            </div>

            <div className="proof-deliverables-grid">
              <div className="deliverable-item">
                <div className="item-icon"><ShieldCheckIcon /></div>
                <h4>Configuração assistida</h4>
                <p>Ajudamos a vincular seu Meta Business Manager e cadastrar seu número oficial sem dores de cabeça.</p>
              </div>

              <div className="deliverable-item">
                <div className="item-icon"><MessageIcon /></div>
                <h4>Templates e campanhas</h4>
                <p>Orientação direta para criar e aprovar modelos de mensagem homologados pelo WhatsApp.</p>
              </div>

              <div className="deliverable-item">
                <div className="item-icon"><CodeIcon /></div>
                <h4>Integração descomplicada</h4>
                <p>Conecte a ferramenta ao restante do seu ecossistema via API Key, webhooks e fluxos no n8n.</p>
              </div>

              <div className="deliverable-item">
                <div className="item-icon"><ZapIcon /></div>
                <h4>Suporte humano direto</h4>
                <p>Quando surgir qualquer dúvida, você conversa diretamente com quem desenvolve e opera a plataforma.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 9. PLANOS & PREÇOS SIMPLIFICADOS */}
        <section className="pricing-section" id="planos">
          <div className="editorial-header">
            <h2>Escolha o tamanho da sua operação.</h2>
            <p>Todos os planos incluem acesso completo à plataforma, infraestrutura oficial em nuvem e implantação assistida.</p>
          </div>

          <div className="pricing-grid">
            {plans.map((plan) => (
              <div
                key={plan.slug}
                className={`pricing-card ${plan.highlighted ? "is-highlighted" : ""}`}
              >
                {plan.badge ? <div className="card-top-tag">{plan.badge}</div> : null}

                <div className="card-meta">
                  <h3>{plan.name}</h3>

                  <div className="card-price-row">
                    <span className="currency">R$</span>
                    <span className="price-number">{plan.price}</span>
                    <span className="price-period">{plan.period}</span>
                  </div>

                  {plan.monthlyEquivalent ? (
                    <div className="price-equivalent">
                      Equivale a <strong>R$ {plan.monthlyEquivalent}/mês</strong>
                    </div>
                  ) : (
                    <div className="price-equivalent muted">Cobrança mensal sem fidelidade</div>
                  )}

                  <p className="plan-summary-text">{plan.description}</p>
                </div>

                <div className="card-separator" />

                <ul className="card-feature-list">
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <CheckIcon />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  className={`primary-button full-width ${plan.highlighted ? "action-highlight" : "action-standard"}`}
                  href={`/checkout?plano=${plan.slug}`}
                >
                  <span>Assinar {plan.name}</span>
                  <ArrowRightIcon />
                </Link>

                <p className="card-footnote">Pagamento seguro via Asaas • Cancele quando quiser</p>
              </div>
            ))}
          </div>

          <div className="guarantee-box">
            <ShieldCheckIcon />
            <span>Garantia incondicional de 7 dias • Teste sua operação sem risco financeiro</span>
          </div>
        </section>

        {/* 10. PERGUNTAS FREQUENTES */}
        <section className="faq-section" id="faq">
          <div className="editorial-header">
            <h2>Perguntas Frequentes</h2>
            <p>Respostas diretas sobre a API Oficial, funcionamento da plataforma e implantação.</p>
          </div>

          <div className="faq-container">
            {(content.faqs ?? []).map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={faq.question} className={`faq-row ${isOpen ? "open" : ""}`}>
                  <button
                    type="button"
                    className="faq-question-btn"
                    onClick={() => toggleFaq(index)}
                    aria-expanded={isOpen}
                  >
                    <span>{faq.question}</span>
                    <span className="chevron-arrow">
                      <ChevronDownIcon />
                    </span>
                  </button>

                  {isOpen ? (
                    <div className="faq-answer-block">
                      <p>{faq.answer}</p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="faq-contact-box">
            <p>Ficou com alguma dúvida específica sobre o seu caso de uso?</p>
            <a
              href="https://wa.me/5511999999999?text=Ol%C3%A1!%20Gostaria%20de%20tirar%20d%C3%BAvidas%20sobre%20o%20Send%20Inteligentte%20e%20a%20API%20Oficial."
              target="_blank"
              rel="noopener noreferrer"
              className="faq-whatsapp-link"
            >
              <MessageIcon />
              <span>Falar diretamente no WhatsApp</span>
            </a>
          </div>
        </section>

        {/* 11. FECHAMENTO & CTA FINAL */}
        <section className="final-closing-section">
          <div className="closing-content-box">
            <h2>
              Seu WhatsApp já é um canal de vendas. <br />
              Está na hora de tratá-lo como infraestrutura.
            </h2>
            <p>Comece a enviar suas campanhas pela API oficial com previsibilidade total e acompanhamento da nossa equipe.</p>

            <div className="closing-actions">
              <a className="primary-button large" href="#planos">
                <span>Começar agora</span>
                <ArrowRightIcon />
              </a>
            </div>
          </div>
        </section>

        {/* RODAPÉ */}
        <footer className="site-footer">
          <div className="footer-top-row">
            <Brand />

            <nav className="footer-nav" aria-label="Links do rodapé">
              <a href="#como-funciona">Como funciona</a>
              <a href="#recursos">Recursos</a>
              <a href="#comparativo">Comparativo</a>
              <a href="#integracoes">Integrações</a>
              <a href="#planos">Planos</a>
              <Link href="/PoliticaDePrivacidade.html" target="_blank">Privacidade</Link>
              <Link href="/TermosECondicoes.html" target="_blank">Termos</Link>
              <a href="https://app.sendinteligente.com.br" target="_blank" rel="noopener noreferrer">Área do Cliente</a>
            </nav>
          </div>

          <div className="footer-bottom-row">
            <p>© {new Date().getFullYear()} Send Inteligentte. Todos os direitos reservados.</p>
            <div className="footer-compliance-tags">
              <span>Infraestrutura WhatsApp Cloud API</span>
              <span>•</span>
              <span>Processamento Seguro Asaas</span>
              <span>•</span>
              <span>Conformidade LGPD</span>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
