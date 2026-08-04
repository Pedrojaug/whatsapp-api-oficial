import type { CSSProperties } from "react";
import { BoltIcon, ChartIcon, LinkIcon, ListIcon, MessageIcon, TargetIcon } from "@/components/icons";

type ProductShowcaseProps = {
  campaign: string;
  templateMessage: string;
};

const bars = [
  { day: "Seg", height: 46 },
  { day: "Ter", height: 62 },
  { day: "Qua", height: 51 },
  { day: "Qui", height: 78 },
  { day: "Sex", height: 66 },
  { day: "Sáb", height: 88 },
  { day: "Dom", height: 57 },
];

/**
 * Mockup do painel exibido no hero. É ilustrativo: os números servem
 * para dar forma à interface, não representam dados de clientes.
 */
export function ProductShowcase({ campaign, templateMessage }: ProductShowcaseProps) {
  return (
    <div
      className="showcase"
      data-tilt
      role="img"
      aria-label="Prévia do painel do Send Inteligente com métricas de campanha"
    >
      <div className="showcase-glow" aria-hidden="true" />

      <div className="app-window">
        <div className="app-rail" aria-hidden="true">
          <span className="rail-dot" />
          <MessageIcon />
          <ListIcon />
          <TargetIcon />
          <ChartIcon />
          <LinkIcon />
        </div>

        <div className="app-body">
          <header className="app-topbar">
            <div>
              <small>Campanha em andamento</small>
              <strong>{campaign}</strong>
            </div>
            <span className="live-tag">
              <span className="live-dot" />
              ao vivo
            </span>
          </header>

          {/* data-count liga a contagem progressiva do MotionLayer quando o card entra na tela. */}
          <div className="app-kpis">
            <article>
              <small>Disparados</small>
              <strong data-count="1.284">1.284</strong>
              <span className="kpi-trend up">fila normal</span>
            </article>
            <article>
              <small>Entregues</small>
              <strong className="is-green" data-count="1.197">
                1.197
              </strong>
              <span className="kpi-trend up">93,2%</span>
            </article>
            <article>
              <small>Lidos</small>
              <strong className="is-cyan" data-count="642">
                642
              </strong>
              <span className="kpi-trend up">53,6%</span>
            </article>
            <article>
              <small>Cliques</small>
              <strong className="is-purple" data-count="218">
                218
              </strong>
              <span className="kpi-trend up">link rastreado</span>
            </article>
          </div>

          <div className="app-split">
            <div className="app-chart">
              <div className="chart-head">
                <span>Entregas nos últimos 7 dias</span>
                <span className="chart-legend">
                  <i className="dot-green" /> entregue
                </span>
              </div>
              {/* --i escalona o crescimento das barras; o CSS cuida da animação. */}
              <div className="chart-bars">
                {bars.map((bar, index) => (
                  <span key={bar.day} style={{ "--i": index } as CSSProperties}>
                    <i style={{ height: `${bar.height}%` }} />
                    <small>{bar.day}</small>
                  </span>
                ))}
              </div>
            </div>

            <div className="app-phone">
              <div className="phone-head">
                <span className="template-status">
                  <span className="status-dot" />
                  Template aprovado
                </span>
              </div>
              <div className="phone-screen">
                {/* Só aparece quando a camada de movimento está ativa (ver styles.css). */}
                <span className="typing-caret" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>

                <div className="chat-bubble">
                  <p>{templateMessage}</p>
                  <span className="bubble-time">
                    09:41
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m3 13 3.5 3.5L11 11" />
                      <path d="m12 16 1 1 8-8" />
                    </svg>
                  </span>
                </div>
                <button className="chat-cta" type="button" tabIndex={-1}>
                  Falar com o time
                </button>
              </div>
            </div>
          </div>

          <footer className="app-footer">
            <span className="queue-pill">
              <BoltIcon />
              Fila processando · reenvio automático em caso de falha
            </span>
          </footer>
        </div>
      </div>
    </div>
  );
}
