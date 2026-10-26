import { useEffect, useState, type ReactNode } from "react";

// ─── Conversa simulada do painel direito do login ─────────────────────────────
// Tela do WhatsApp de uma cliente fictícia (Ana) recebendo um disparo de uma loja
// fictícia (Casa Aurora Perfumes) e respondendo até fechar a compra. Roda em loop.

type From = "biz" | "me";

interface ChatMsg {
  id: string;
  from: From;
  body: ReactNode;
  time: string;
  template?: boolean;
  quote?: string;
  read?: boolean;
}

const TEMPLATE_PREVIEW = "Oi, Ana! A Black Friday da Casa Aurora começou…";

const MSG = {
  template: {
    id: "template",
    from: "biz",
    template: true,
    time: "14:32",
    body: (
      <>
        Oi, Ana! ✨ A Black Friday da Casa Aurora começou: <strong>20% OFF</strong> em todos os perfumes até domingo.
      </>
    ),
  },
  tapReply: { id: "tap", from: "me", time: "14:33", quote: TEMPLATE_PREVIEW, body: "Ver ofertas" },
  offer: {
    id: "offer",
    from: "biz",
    time: "14:33",
    body: (
      <>
        Separei o seu favorito 👇{"\n"}
        <strong>Floral Intenso 100ml</strong>{"\n"}
        <s>R$ 289</s> por <strong>R$ 231</strong> com o cupom <strong>BLACK20</strong>
      </>
    ),
  },
  ask: { id: "ask", from: "me", time: "14:34", body: "Tem em 50ml também?" },
  answer: {
    id: "answer",
    from: "biz",
    time: "14:34",
    body: (
      <>
        Tem sim! O de 50ml sai por <strong>R$ 159</strong> com o cupom. Quer que eu reserve? 😊
      </>
    ),
  },
  confirm: { id: "confirm", from: "me", time: "14:35", body: "Quero! Pode reservar 🙌" },
  done: {
    id: "done",
    from: "biz",
    time: "14:35",
    body: <>Reservado ✅ Seu pedido <strong>#4821</strong> já está separado. Te aviso quando sair para entrega!</>,
  },
} satisfies Record<string, ChatMsg>;

const STAGES = ["Enviado", "Lido", "Respondeu", "Venda"];

const FINAL_TRANSCRIPT: ChatMsg[] = [MSG.template, MSG.tapReply, MSG.offer, MSG.ask, MSG.answer, MSG.confirm, MSG.done]
  .map(m => (m.from === "me" ? { ...m, read: true } : m));

function shouldAnimate() {
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    && !window.matchMedia("(max-width: 900px)").matches;
}

function Ticks({ read }: { read?: boolean }) {
  return (
    <svg className={`wa-demo-ticks${read ? " is-read" : ""}`} width="16" height="11" viewBox="0 0 16 11" fill="none" aria-hidden="true">
      <path d="M1 5.5L4.5 9L11 1.5M7 8L8.5 9.5L15 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Bubble({ msg, pressed }: { msg: ChatMsg; pressed: string | null }) {
  return (
    <div className={`wa-demo-row wa-demo-row--${msg.from}`}>
      <div className={`wa-demo-bubble wa-demo-bubble--${msg.from}${msg.template ? " wa-demo-bubble--template" : ""}`}>
        {msg.template && (
          <div className="wa-demo-banner">
            <span>Black Friday</span>
            <strong>-20%</strong>
          </div>
        )}
        {msg.quote && (
          <div className="wa-demo-quote">
            <span>Casa Aurora Perfumes</span>
            {msg.quote}
          </div>
        )}
        <div className="wa-demo-text">{msg.body}</div>
        {msg.template && <div className="wa-demo-footer">Responda SAIR para não receber mais</div>}
        <div className="wa-demo-meta">
          {msg.time}
          {msg.from === "me" && <Ticks read={msg.read} />}
        </div>
      </div>
      {msg.template && (
        <div className="wa-demo-buttons">
          {["Ver ofertas", "Agora não"].map(label => (
            <div key={label} className={`wa-demo-button${pressed === label ? " is-pressed" : ""}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 14L4 9l5-5" />
                <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
              </svg>
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LoginChatDemo() {
  const [animate] = useState(shouldAnimate);
  const [messages, setMessages] = useState<ChatMsg[]>(() => (animate ? [] : FINAL_TRANSCRIPT));
  const [stage, setStage] = useState(animate ? 0 : STAGES.length);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [pressed, setPressed] = useState<string | null>(null);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!animate) return;

    let cancelled = false;
    const timers: number[] = [];
    // Se o componente desmontar, o timer é limpo e a promessa nunca resolve: o roteiro para ali.
    const wait = (ms: number) => new Promise<void>(resolve => {
      timers.push(window.setTimeout(() => { if (!cancelled) resolve(); }, ms));
    });

    const push = (msg: ChatMsg) => setMessages(prev => [...prev, msg]);
    const markRead = () => setMessages(prev => prev.map(m => (m.from === "me" ? { ...m, read: true } : m)));

    const bizSays = async (msg: ChatMsg, typingMs: number) => {
      markRead();
      setTyping(true);
      await wait(typingMs);
      setTyping(false);
      push(msg);
    };

    const iType = async (msg: ChatMsg, text: string) => {
      for (let i = 1; i <= text.length; i++) {
        setDraft(text.slice(0, i));
        await wait(text[i - 1] === " " ? 90 : 55);
      }
      await wait(350);
      setDraft("");
      push(msg);
    };

    const play = async () => {
      for (;;) {
        await wait(700);
        setMessages([]);
        setStage(0);
        setPressed(null);
        setFading(false);

        await wait(900);
        push(MSG.template);
        setStage(1);

        await wait(2400);
        setStage(2);
        setPressed("Ver ofertas");
        await wait(450);
        push(MSG.tapReply);
        setStage(3);

        await wait(800);
        await bizSays(MSG.offer, 1700);

        await wait(1800);
        await iType(MSG.ask, "Tem em 50ml também?");

        await wait(900);
        await bizSays(MSG.answer, 1600);

        await wait(1600);
        await iType(MSG.confirm, "Quero! Pode reservar 🙌");

        await wait(900);
        await bizSays(MSG.done, 1500);
        setStage(4);

        await wait(5000);
        setFading(true);
      }
    };

    play();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [animate]);

  return (
    <div className="wa-demo">
      <ol className="wa-demo-stages">
        {STAGES.map((label, i) => (
          <li key={label} className={i < stage ? "is-done" : undefined}>
            <span className="wa-demo-stage-dot" />
            {label}
          </li>
        ))}
      </ol>

      <div className="wa-demo-phone">
        <div className="wa-demo-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <div className="wa-demo-avatar">CA</div>
          <div className="wa-demo-contact">
            <span className="wa-demo-name">
              Casa Aurora Perfumes
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="10" fill="#25d366" />
                <path d="M7.5 12.5l3 3 6-6.5" stroke="#0b141a" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="wa-demo-status">{typing ? "digitando…" : "Conta comercial"}</span>
          </div>
        </div>

        <div className={`wa-demo-chat${fading ? " is-fading" : ""}`}>
          <div className="wa-demo-date">Hoje</div>
          {messages.map(msg => <Bubble key={msg.id} msg={msg} pressed={pressed} />)}
          {typing && (
            <div className="wa-demo-row wa-demo-row--biz">
              <div className="wa-demo-bubble wa-demo-bubble--biz wa-demo-typing">
                <span /><span /><span />
              </div>
            </div>
          )}
        </div>

        <div className="wa-demo-composer">
          <div className={`wa-demo-input${draft ? " has-text" : ""}`}>{draft || "Mensagem"}</div>
          <div className="wa-demo-send">
            {draft ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M3.4 20.4l17.45-7.48a1 1 0 0 0 0-1.84L3.4 3.6a.99.99 0 0 0-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
              </svg>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
