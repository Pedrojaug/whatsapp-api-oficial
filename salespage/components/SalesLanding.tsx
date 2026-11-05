"use client";

import React, { useEffect, useRef, useState } from "react";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { WhatsAppDemo } from "./WhatsAppDemo";
import "./sales-landing.css";

const displayFont = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-sl-display",
});

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-sl-body",
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-sl-mono",
});

const WHATSAPP_URL = "https://wa.me/5583920017106";

type Plan = {
  id: string;
  name: string;
  description: string;
  price: string;
  period: string;
  badge: string | null;
  isPopular: boolean;
  features: string[];
  cta: string;
};

type Faq = { question: string; answer: string };

export const DEFAULT_PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Para dar o primeiro passo no WhatsApp oficial.",
    price: "197",
    period: "/mês",
    badge: null,
    isPopular: false,
    features: [
      "5.000 mensagens por mês",
      "1 número oficial",
      "Contatos separados por grupo",
      "Veja quem clicou em cada link",
      "Descadastro automático (LGPD)",
      "Suporte via WhatsApp",
    ],
    cta: "Começar no Starter",
  },
  {
    id: "pro",
    name: "Profissional",
    description: "Para quem vende pelo WhatsApp todos os dias.",
    price: "397",
    period: "/mês",
    badge: "Mais escolhido",
    isPopular: true,
    features: [
      "25.000 mensagens por mês",
      "Até 3 números oficiais",
      "Integração com loja, CRM e n8n",
      "Configuração guiada pela nossa equipe",
      "Atendimento prioritário",
    ],
    cta: "Escolher Profissional",
  },
  {
    id: "scale",
    name: "Escala",
    description: "Para grandes volumes e operações que não podem parar.",
    price: "797",
    period: "/mês",
    badge: null,
    isPopular: false,
    features: [
      "Mensagens sem limite de plano",
      "Vários números e contas",
      "Integrações dedicadas",
      "Um gerente só para sua conta",
      "Atendimento 24/7",
    ],
    cta: "Falar com consultor",
  },
];

export const DEFAULT_FAQS: Faq[] = [
  {
    question: "Preciso deixar o celular ligado?",
    answer: "Não. Tudo roda na nuvem da Meta, com seu celular e computador desligados.",
  },
  {
    question: "Posso usar meu número atual?",
    answer: "Sim, e nós fazemos a migração com você. Números novos, fixos e 0800 também funcionam.",
  },
  {
    question: "Meu número ainda pode ser bloqueado?",
    answer:
      "O risco cai muito: você usa o canal oficial, com mensagens aprovadas pela Meta e descadastro automático. E a gente te mostra as boas práticas desde o começo.",
  },
  {
    question: "Não entendo nada de tecnologia. Consigo usar?",
    answer:
      "Consegue. Nossa equipe faz a configuração com você e aprova suas primeiras mensagens. Depois, é subir a planilha e enviar.",
  },
];

// Limites mensais usados pelo recomendador de plano.
const PLAN_LIMITS: { id: string; max: number }[] = [
  { id: "starter", max: 5000 },
  { id: "pro", max: 25000 },
  { id: "scale", max: Infinity },
];

function recommendPlan(volume: number) {
  return (PLAN_LIMITS.find((p) => volume <= p.max) ?? PLAN_LIMITS[PLAN_LIMITS.length - 1]).id;
}

function checkoutHref(planId: string) {
  const slug = planId === "starter" ? "mensal" : planId === "scale" ? "anual" : "trimestral";
  return `/checkout?plano=${slug}&plan=${planId}`;
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function HeroTick({ double, final }: { double?: boolean; final?: boolean }) {
  const stroke = final ? "var(--sl-accent)" : "#9AA39E";
  if (!double) {
    return (
      <svg className="sl-tick sl-tick--single" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path pathLength={1} d="M4 13 L9 18 L20 6" stroke={stroke} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg className="sl-tick" viewBox="0 0 32 24" fill="none" aria-hidden="true">
      <path pathLength={1} d="M2 13 L7 18 L18 6" stroke={stroke} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path pathLength={1} d="M13 16 L15 18 L26 6" stroke={stroke} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const USE_CASES = [
  { title: "Recupere vendas perdidas", text: "Lucas, o tênis 42 ainda está no seu carrinho. Separamos por mais 2 horas.", time: "14:02" },
  { title: "Receba em dia", text: "Carla, seu boleto de R$ 189,90 vence amanhã. O código está aqui embaixo.", time: "09:00" },
  { title: "Menos “cadê meu pedido?”", text: "Pedido 9402 saiu para entrega. Chega hoje até as 18h.", time: "08:15" },
  { title: "Traga clientes de volta", text: "Mariana, faz 60 dias. Seu cupom VOLTA15 vale até domingo.", time: "18:30" },
];

const COMPARISON = [
  ["Seu número", "Pode ser bloqueado no meio da campanha", "Protegido no canal oficial"],
  ["Celular", "Precisa ficar ligado e carregado", "Pode desligar"],
  ["Funcionamento", "Para quando a conexão cai", "24 horas por dia"],
  ["Resultados", "Você não sabe quem leu", "Vê quem recebeu, leu e clicou"],
  ["Descadastro", "Controle manual em planilha", "Automático e dentro da LGPD"],
];

export function SalesLanding({ content }: { content?: any }) {
  const plans: Plan[] =
    content && Array.isArray(content.plans) && content.plans.length > 0 ? content.plans : DEFAULT_PLANS;
  const faqs: Faq[] =
    content && Array.isArray(content.faqs) && content.faqs.length > 0 ? content.faqs : DEFAULT_FAQS;

  const [volume, setVolume] = useState(8000);
  const recommended = recommendPlan(volume);
  const recommendedName = plans.find((p) => p.id === recommended)?.name ?? "";
  const volumeLabel = volume >= 100000 ? "100 mil ou mais" : volume.toLocaleString("pt-BR");

  // O botão flutuante só aparece depois do hero e some no CTA final/rodapé,
  // para não cobrir a demo, o link de suporte nem os botões que já levam ao WhatsApp.
  const heroRef = useRef<HTMLElement>(null);
  const endRef = useRef<HTMLElement>(null);
  const [heroVisible, setHeroVisible] = useState(true);
  const [endVisible, setEndVisible] = useState(false);

  useEffect(() => {
    const hero = heroRef.current;
    const end = endRef.current;
    if (!hero || !end || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.target === hero) setHeroVisible(entry.isIntersecting);
        if (entry.target === end) setEndVisible(entry.isIntersecting);
      });
    });
    observer.observe(hero);
    observer.observe(end);
    return () => observer.disconnect();
  }, []);

  const fabHidden = heroVisible || endVisible;

  return (
    <div className={`sl ${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
      <header className="sl-header">
        <div className="sl-wrap">
          <a href="#topo" className="sl-logo" aria-label="Send Inteligentte — início">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/send-logo.png" alt="Send Inteligentte" width={177} height={32} />
          </a>
          <nav className="sl-nav" aria-label="Navegação principal">
            <a href="#como-funciona">Como funciona</a>
            <a href="#usos">Casos de uso</a>
            <a href="#integracoes">Integrações</a>
            <a href="#planos">Planos</a>
          </nav>
          <div className="sl-header-actions">
            <a className="sl-header-login" href="https://app.sendinteligente.com.br" target="_blank" rel="noopener noreferrer">
              Entrar
            </a>
            <a href="#planos" className="sl-btn sl-btn--ink sl-btn--sm">
              Começar agora
            </a>
          </div>
        </div>
      </header>

      <main>
        <section id="topo" className="sl-wrap sl-hero" ref={heroRef}>
          <div className="sl-hero-copy">
            <p className="sl-kicker">WhatsApp oficial para empresas</p>
            <h1 className="sl-hero-title">
              <span className="sl-hero-line">
                Enviada.
                <HeroTick />
              </span>
              <span className="sl-hero-line">
                Entregue.
                <HeroTick double />
              </span>
              <span className="sl-hero-line">
                Lida.
                <HeroTick double final />
              </span>
            </h1>
            <p className="sl-hero-sub">
              Fale com milhares de clientes de uma vez, pelo canal oficial do WhatsApp. Cobranças, ofertas e avisos que
              chegam, são lidos e viram venda — sem arriscar o seu número.
            </p>
            <div className="sl-hero-ctas">
              <a href="#planos" className="sl-btn sl-btn--accent">
                Começar agora <ArrowRightIcon />
              </a>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="sl-btn sl-btn--ghost">
                Tirar dúvidas no WhatsApp
              </a>
            </div>
            <p className="sl-hero-note">Sem fidelidade · Configuração feita com a nossa equipe</p>
            <a href="#demo" className="sl-demo-jump">
              Veja como seu cliente recebe ↓
            </a>
          </div>
          <WhatsAppDemo />
        </section>

        <section className="sl-facts" aria-label="Garantias da plataforma">
          <div className="sl-wrap">
            <div className="sl-fact">
              <strong>Seu número protegido</strong>
              <span>Canal oficial da Meta, longe do bloqueio do QR Code.</span>
            </div>
            <div className="sl-fact">
              <strong>Funciona 24 horas</strong>
              <span>Pode desligar o celular e fechar o computador.</span>
            </div>
            <div className="sl-fact">
              <strong>Ninguém fica sem receber</strong>
              <span>Se uma mensagem falhar, reenviamos sozinhos.</span>
            </div>
            <div className="sl-fact">
              <strong>Você vê quem leu</strong>
              <span>E quem clicou, cliente por cliente.</span>
            </div>
          </div>
        </section>

        <section className="sl-wrap sl-section">
          <div className="sl-split">
            <h2 className="sl-h2 sl-reveal">QR Code funciona. Até o dia em que não funciona.</h2>
            <p>
              Basta o celular descarregar ou o chip ser bloqueado para suas vendas pararem — e seus contatos irem junto.
              Quem vende pelo WhatsApp não pode depender de sorte.
            </p>
          </div>
          <div className="sl-table-box">
            <table className="sl-table">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Critério</span>
                  </th>
                  <th scope="col">Do jeito improvisado</th>
                  <th scope="col">Com o Send</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map(([label, before, after]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    <td>{before}</td>
                    <td>{after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="como-funciona" className="sl-band">
          <div className="sl-wrap sl-section">
            <h2 className="sl-h2 sl-reveal">Da conta criada à primeira venda, com a gente do lado.</h2>
            <ol className="sl-steps">
              <li className="sl-step">
                <span className="sl-step-bar" aria-hidden="true" />
                <p className="sl-step-num">01</p>
                <h3>Conecte seu número</h3>
                <p>Use o número que seus clientes já conhecem. Nossa equipe faz a configuração com você.</p>
              </li>
              <li className="sl-step">
                <span className="sl-step-bar" aria-hidden="true" />
                <p className="sl-step-num">02</p>
                <h3>Escreva sua mensagem</h3>
                <p>Monte o texto no painel. A Meta aprova e você acompanha tudo por lá.</p>
              </li>
              <li className="sl-step">
                <span className="sl-step-bar" aria-hidden="true" />
                <p className="sl-step-num">03</p>
                <h3>Envie e acompanhe</h3>
                <p>Suba sua planilha de contatos, escolha o horário e veja as respostas chegando.</p>
              </li>
            </ol>
          </div>
        </section>

        <section id="usos" className="sl-wrap sl-section">
          <div className="sl-split">
            <h2 className="sl-h2 sl-reveal">Tem dinheiro parado esperando um lembrete.</h2>
            <p>
              Carrinho esquecido, boleto vencendo, cliente sumido. Cada um é uma venda que volta com a mensagem certa — com
              o nome do cliente e o link pronto para pagar.
            </p>
          </div>
          <div className="sl-cases">
            {USE_CASES.map((c) => (
              <article key={c.title} className="sl-case">
                <h3>{c.title}</h3>
                <div className="sl-case-bubble">
                  {c.text}
                  <div className="sl-case-meta">
                    {c.time} <span className="sl-case-ticks">✓✓</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="integracoes" className="sl-dark">
          <div className="sl-wrap sl-section">
            <div className="sl-dark-copy">
              <p className="sl-kicker">Integrações</p>
              <h2 className="sl-h2 sl-reveal">Conversa com o sistema que você já usa.</h2>
              <p>
                Loja virtual, CRM ou n8n: a mensagem sai sozinha quando o pedido é feito ou o boleto vence. Sua equipe
                técnica conecta em minutos.
              </p>
              <ul className="sl-chips">
                <li>n8n</li>
                <li>Make</li>
                <li>API</li>
                <li>Planilha</li>
              </ul>
            </div>
            <div className="sl-code">
              <div className="sl-code-label">Uma chamada envia a mensagem</div>
              <pre>
                <code>
                  <span className="sl-method">POST</span>
                  {` /api/v1/send
Authorization: Bearer sk_••••••••

{
  "to": "5583999990000",
  "templateName": "lembrete_pix",
  "variables": ["Carla", "R$ 189,90"]
}`}
                </code>
              </pre>
            </div>
          </div>
        </section>

        <section id="planos" className="sl-wrap sl-section">
          <h2 className="sl-h2 sl-reveal">Escolha pelo tamanho da sua operação.</h2>
          <p className="sl-pricing-sub">Sem fidelidade. Troque de plano quando crescer ou cancele quando quiser.</p>

          <div className="sl-picker">
            <label htmlFor="sl-volume">
              Quantas mensagens você envia por mês?
              <output htmlFor="sl-volume">{volumeLabel}</output>
            </label>
            <input
              id="sl-volume"
              type="range"
              min={1000}
              max={100000}
              step={1000}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
            />
            {recommendedName && (
              <p>
                Para esse volume, o plano ideal é o <strong>{recommendedName}</strong>.
              </p>
            )}
          </div>

          <div className="sl-plans">
            {plans.map((plan) => {
              const isRecommended = plan.id === recommended;
              const classes = [
                "sl-plan",
                plan.isPopular ? "sl-plan--featured" : "",
                isRecommended ? "sl-plan--recommended" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <article key={plan.id} className={classes}>
                  <div className="sl-plan-tagrow">
                    {isRecommended ? (
                      <span className="sl-tag sl-tag--rec">Ideal para o seu volume</span>
                    ) : (
                      plan.badge && <span className="sl-tag">{plan.badge}</span>
                    )}
                  </div>
                  <h3>{plan.name}</h3>
                  <p className="sl-plan-desc">{plan.description}</p>
                  <p className="sl-plan-price">
                    <span>R$</span>
                    <strong>{plan.price}</strong>
                    <span className="sl-plan-period">{plan.period}</span>
                  </p>
                  <ul>
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                  <a href={checkoutHref(plan.id)} className="sl-btn sl-btn--ghost">
                    {plan.cta}
                  </a>
                </article>
              );
            })}
          </div>
          <p className="sl-pricing-note">
            Além do plano, a Meta cobra um valor por conversa direto na sua conta, que varia conforme o tipo de mensagem
            (marketing, aviso ou atendimento).
          </p>
        </section>

        <section id="faq" className="sl-band sl-faq">
          <div className="sl-wrap sl-section">
            <h2 className="sl-h2 sl-reveal">Antes de você perguntar.</h2>
            <dl>
              {faqs.map((faq) => (
                <div key={faq.question}>
                  <dt>{faq.question}</dt>
                  <dd>{faq.answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="sl-final" ref={endRef}>
          <div className="sl-wrap">
            <h2 className="sl-reveal">Sua próxima campanha não precisa de um celular ligado.</h2>
            <div className="sl-final-ctas">
              <a href="#planos" className="sl-btn sl-btn--ink">
                Começar agora
              </a>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="sl-btn sl-btn--ghost">
                Falar com um especialista
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="sl-footer">
        <div className="sl-wrap">
          <div className="sl-footer-brand">
            <span>Um produto</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/lab-logo-light.png" alt="Inteligentte Lab" width={134} height={30} />
            <span>· © {new Date().getFullYear()} Send Inteligentte</span>
          </div>
          <nav aria-label="Rodapé">
            <a href="https://app.sendinteligente.com.br" target="_blank" rel="noopener noreferrer">
              Entrar
            </a>
            <a href="/politica-de-privacidade">Privacidade</a>
            <a href="/termos-e-condicoes">Termos de uso</a>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              Suporte
            </a>
          </nav>
        </div>
      </footer>

      <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={`sl-fab${fabHidden ? " sl-fab--hidden" : ""}`}
        aria-label="Tirar dúvidas no WhatsApp"
        aria-hidden={fabHidden}
        tabIndex={fabHidden ? -1 : undefined}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--sl-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.6-5.4A8.5 8.5 0 1 1 21 11.5z" />
        </svg>
        <span>Tirar dúvidas</span>
      </a>
    </div>
  );
}

export default SalesLanding;
