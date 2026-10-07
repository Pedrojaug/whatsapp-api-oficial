"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ScenarioId = "cobranca" | "carrinho" | "pedido" | "reativacao";
type DemoEvent = "click" | "reply" | "agent";

const SCENARIOS: Record<
  ScenarioId,
  { label: string; title: string; pre: string; post: string; button: string; clickNote: string }
> = {
  cobranca: {
    label: "Cobrança",
    title: "Lembrete de pagamento",
    pre: "Oi, ",
    post: "! Seu Pix de R$ 189,90 vence hoje. É só tocar abaixo para pagar em 1 minuto.",
    button: "Pagar agora",
    clickNote: "{nome} abriu o link de pagamento",
  },
  carrinho: {
    label: "Carrinho",
    title: "Seu carrinho está te esperando",
    pre: "",
    post: ", o tênis 42 ainda está no seu carrinho. Separamos para você por mais 2 horas.",
    button: "Finalizar compra",
    clickNote: "{nome} voltou para o carrinho",
  },
  pedido: {
    label: "Pedido",
    title: "Pedido a caminho",
    pre: "",
    post: ", seu pedido #9402 saiu para entrega e chega hoje até as 18h.",
    button: "Acompanhar entrega",
    clickNote: "{nome} abriu o rastreio",
  },
  reativacao: {
    label: "Reativação",
    title: "Sentimos sua falta",
    pre: "",
    post: ", faz 60 dias desde sua última compra. Seu cupom VOLTA15 vale até domingo.",
    button: "Usar meu cupom",
    clickNote: "{nome} abriu a loja com o cupom",
  },
};

const SCENARIO_IDS = Object.keys(SCENARIOS) as ScenarioId[];

function DoubleTick({ color, label }: { color: string; label: string }) {
  return (
    <svg width="17" height="11" viewBox="0 0 32 24" fill="none" role="img" aria-label={label}>
      <path d="M2 13 L7 18 L18 6" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 16 L15 18 L26 6" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Demonstração interativa: a conversa como o cliente final vê no WhatsApp,
 * com os status que a empresa acompanha no painel.
 */
export function WhatsAppDemo() {
  const [scenario, setScenario] = useState<ScenarioId>("cobranca");
  const [name, setName] = useState("");
  // 0 = ainda não enviada, 1 = enviada, 2 = entregue, 3 = lida
  const [phase, setPhase] = useState(0);
  const [events, setEvents] = useState<DemoEvent[]>([]);
  const [replyRead, setReplyRead] = useState(false);
  const [agentTyping, setAgentTyping] = useState(false);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  const play = useCallback(() => {
    clearTimers();
    setPhase(0);
    setEvents([]);
    setReplyRead(false);
    setAgentTyping(false);
    later(200, () => setPhase(1));
    later(900, () => setPhase(2));
    later(2400, () => setPhase(3));
  }, [clearTimers, later]);

  useEffect(() => {
    play();
    return clearTimers;
  }, [play, clearTimers]);

  // Mantém a última mensagem visível, como no WhatsApp.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [phase, events, replyRead]);

  const msg = SCENARIOS[scenario];
  const firstName = name.trim() || "Carla";
  const clicked = events.includes("click");
  const replied = events.includes("reply");

  function pickScenario(id: ScenarioId) {
    setScenario(id);
    play();
  }

  function tapLink() {
    if (clicked) return;
    setPhase(3);
    setEvents((prev) => [...prev, "click"]);
  }

  function tapReply() {
    if (replied) return;
    setPhase(3);
    setEvents((prev) => [...prev, "reply"]);
    later(900, () => {
      setReplyRead(true);
      setAgentTyping(true);
    });
    later(2700, () => {
      setAgentTyping(false);
      setEvents((prev) => [...prev, "agent"]);
    });
  }

  const statuses = [
    { label: "Enviada", on: phase >= 1 },
    { label: "Entregue", on: phase >= 2 },
    { label: "Lida", on: phase >= 3 },
    { label: "Clicou", on: clicked },
    { label: "Respondeu", on: replied },
  ];

  return (
    <div className="sl-demo">
      <div className="sl-demo-tabs" role="group" aria-label="Escolha um exemplo de mensagem">
        {SCENARIO_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className="sl-demo-tab"
            aria-pressed={id === scenario}
            onClick={() => pickScenario(id)}
          >
            {SCENARIOS[id].label}
          </button>
        ))}
      </div>

      <label className="sl-demo-name">
        Teste com o nome de um cliente:
        <input
          type="text"
          value={name}
          maxLength={20}
          placeholder="Carla"
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <div className="wa-phone">
        <div className="wa-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          <div className="wa-avatar" aria-hidden="true">LE</div>
          <div className="wa-contact">
            <div className="wa-contact-name">
              Loja Exemplo
              <svg width="15" height="15" viewBox="0 0 24 24" role="img" aria-label="Conta verificada">
                <path d="M12 1.5l2.4 1.8 3-.2 1 2.8 2.6 1.6-.7 2.9 1.2 2.7-2.2 2 .1 3-2.9.8-1.5 2.6-2.9-.8-2.6 1.5-2.1-2.1-3-.3-.4-3-2.4-1.8 1.1-2.8-1.1-2.8 2.4-1.8.4-3 3-.3 2.1-2.1z" fill="#25D366" />
                <path d="M8 12.2l2.6 2.6L16.2 9" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="wa-contact-sub">{agentTyping ? "digitando…" : "Conta comercial"}</div>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="5" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="12" cy="19" r="1.8" />
          </svg>
        </div>

        <div className="wa-scroll" ref={scrollRef}>
          <div className="wa-body">
            <div className="wa-pill">HOJE</div>
            <div className="wa-notice">Esta empresa usa um serviço seguro da Meta para gerenciar esta conversa.</div>

            {phase >= 1 && (
              <div className="wa-in" key={scenario}>
                <div className="wa-template">
                  <p className="wa-template-title">{msg.title}</p>
                  <p>
                    {msg.pre}
                    <span className="wa-name">{firstName}</span>
                    {msg.post}
                  </p>
                  <p className="wa-footer-note">Responda PARAR para não receber mais.</p>
                  <div className="wa-time">09:41</div>
                </div>
                <button
                  type="button"
                  className={`wa-btn${phase >= 3 && !clicked && !replied ? " wa-btn--hint" : ""}`}
                  onClick={tapLink}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
                  </svg>
                  {msg.button}
                </button>
                <button type="button" className="wa-btn" onClick={tapReply}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 14L4 9l5-5" />
                    <path d="M4 9h10a6 6 0 0 1 6 6v5" />
                  </svg>
                  Falar com atendente
                </button>
              </div>
            )}

            {events.map((ev) => {
              if (ev === "click") {
                return (
                  <div key={ev} className="wa-pill">
                    {msg.clickNote.replace("{nome}", firstName)}
                  </div>
                );
              }
              if (ev === "reply") {
                return (
                  <div key={ev} className="wa-out">
                    Falar com atendente
                    <span className="wa-out-meta">
                      09:42
                      <DoubleTick color={replyRead ? "#53BDEB" : "#8696A0"} label={replyRead ? "Lida" : "Entregue"} />
                    </span>
                  </div>
                );
              }
              return (
                <div key={ev} className="wa-in">
                  <div className="wa-in-text">
                    Oi, {firstName}! Aqui é a Juliana, do atendimento. Como posso te ajudar?
                    <div className="wa-time">09:42</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="wa-composer" aria-hidden="true">
          <div className="wa-composer-input">Mensagem</div>
          <div className="wa-composer-mic">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </div>
        </div>
      </div>

      <div className="sl-demo-panel">
        <div className="sl-demo-panel-head">
          <span className="sl-kicker">No seu painel, em tempo real</span>
          <button type="button" className="sl-demo-replay" onClick={play} aria-label="Reiniciar demonstração">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        </div>
        <ol className="sl-status" aria-live="polite">
          {statuses.map((s) => (
            <li key={s.label} className={s.on ? "is-on" : undefined}>
              {s.label}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export default WhatsAppDemo;
