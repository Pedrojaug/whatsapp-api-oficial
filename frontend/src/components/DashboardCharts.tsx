import { useId, useMemo, useState } from "react";

// Gráficos leves do Painel de Métricas, em SVG puro e com cores dos tokens (acompanham o tema).

/** Curva suave (Catmull-Rom → Bézier) passando por todos os pontos. */
function smoothPath(points: Array<[number, number]>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const t = 0.18;
    const c1x = p1[0] + (p2[0] - p0[0]) * t;
    const c1y = p1[1] + (p2[1] - p0[1]) * t;
    const c2x = p2[0] - (p3[0] - p1[0]) * t;
    const c2y = p2[1] - (p3[1] - p1[1]) * t;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/** Duplica o único ponto para a curva ter largura quando o período tem um só dia. */
function toPoints(values: number[], width: number, height: number, max: number, pad = 4): Array<[number, number]> {
  const v = values.length === 1 ? [values[0], values[0]] : values;
  const step = v.length > 1 ? width / (v.length - 1) : 0;
  return v.map((val, i) => [i * step, height - pad - (max > 0 ? (val / max) * (height - pad * 2) : 0)]);
}

/** Minigráfico de tendência para os indicadores. */
export function Sparkline({ values, color, label }: { values: number[]; color: string; label: string }) {
  const gid = useId();
  const W = 100;
  const H = 32;
  const max = Math.max(...values, 1);
  const pts = toPoints(values, W, H, max);
  const line = smoothPath(pts);
  if (values.length === 0) return null;
  return (
    <svg className="sparkline" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.35 }} />
          <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <path d={`${line} L ${W} ${H} L 0 ${H} Z`} fill={`url(#${gid})`} />
      <path d={line} fill="none" style={{ stroke: color }} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  );
}

/** Anel de progresso (0–100). */
export function RingGauge({ value, color, size = 96, children }: { value: number; color: string; size?: number; children?: React.ReactNode }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="ring-gauge" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" className="ring-gauge__track" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          style={{ stroke: color }}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * c} ${c}`}
          transform="rotate(-90 50 50)"
          className="ring-gauge__value"
        />
      </svg>
      <div className="ring-gauge__label">{children}</div>
    </div>
  );
}

interface AreaPoint {
  date: string;
  sent: number;
  read: number;
  failed: number;
  replies?: number;
}

/** Gráfico de área: enviadas e lidas com gradiente, falhas como marcadores; leitura ao passar o mouse. */
export function AreaChart({ data, formatLabel }: { data: AreaPoint[]; formatLabel: (date: string) => string }) {
  const gidSent = useId();
  const gidRead = useId();
  const [hover, setHover] = useState<number | null>(null);
  const W = 1000;
  const H = 240;

  const { maxVal, sentPts, readPts, ticks } = useMemo(() => {
    const rawMax = Math.max(...data.map((d) => Math.max(d.sent, d.read)), 10);
    const mag = Math.pow(10, Math.floor(Math.log10(rawMax)));
    const maxVal = Math.ceil(rawMax / (mag / 2)) * (mag / 2);
    return {
      maxVal,
      sentPts: toPoints(data.map((d) => d.sent), W, H, maxVal, 6),
      readPts: toPoints(data.map((d) => d.read), W, H, maxVal, 6),
      ticks: [1, 0.5, 0].map((f) => Math.round(maxVal * f)),
    };
  }, [data]);

  const sentLine = smoothPath(sentPts);
  const readLine = smoothPath(readPts);
  const xOf = (i: number) => (data.length > 1 ? (i / (data.length - 1)) * 100 : 50);
  const fmt = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v));
  const hovered = hover !== null ? data[hover] : null;
  const summaryId = useId();
  const describe = (d: AreaPoint) =>
    `${formatLabel(d.date)}: ${d.sent.toLocaleString("pt-BR")} enviadas, ${d.read.toLocaleString("pt-BR")} lidas` +
    (d.replies !== undefined ? `, ${d.replies.toLocaleString("pt-BR")} respostas` : "") +
    `, ${d.failed.toLocaleString("pt-BR")} falhas`;

  // Teclado: setas percorrem os dias (mesma leitura da passagem do mouse); Home/End vão às pontas.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = data.length - 1;
    const cur = hover ?? last;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = Math.min(last, cur + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = Math.max(0, cur - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    else if (e.key === "Escape") { setHover(null); return; }
    if (next === null) return;
    e.preventDefault();
    setHover(next);
  };

  return (
    <div className="area-chart">
      <div className="area-chart__ticks" aria-hidden="true">
        {ticks.map((t) => <span key={t}>{fmt(t)}</span>)}
      </div>
      <div
        className="area-chart__plot"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - r.left) / r.width;
          setHover(Math.round(ratio * (data.length - 1)));
        }}
        onMouseLeave={() => setHover(null)}
        tabIndex={0}
        role="group"
        aria-roledescription="gráfico"
        aria-label="Envios no período. Use as setas para ver cada dia."
        aria-describedby={summaryId}
        onKeyDown={onKeyDown}
        onFocus={() => setHover((h) => h ?? data.length - 1)}
        onBlur={() => setHover(null)}
      >
        {/* Resumo completo para leitores de tela + anúncio do dia escolhido pelas setas */}
        <span id={summaryId} className="sr-only">{data.map(describe).join("; ")}</span>
        <span className="sr-only" aria-live="polite">{hovered ? describe(hovered) : ""}</span>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={gidSent} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--primary)", stopOpacity: 0.32 }} />
              <stop offset="100%" style={{ stopColor: "var(--primary)", stopOpacity: 0 }} />
            </linearGradient>
            <linearGradient id={gidRead} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--info)", stopOpacity: 0.3 }} />
              <stop offset="100%" style={{ stopColor: "var(--info)", stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          {[0, 0.5, 1].map((f) => (
            <line key={f} x1="0" x2={W} y1={6 + f * (H - 12)} y2={6 + f * (H - 12)} className="area-chart__grid" vectorEffect="non-scaling-stroke" />
          ))}
          <path className="area-chart__area" d={`${sentLine} L ${W} ${H} L 0 ${H} Z`} fill={`url(#${gidSent})`} />
          <path className="area-chart__area" d={`${readLine} L ${W} ${H} L 0 ${H} Z`} fill={`url(#${gidRead})`} />
          <path className="area-chart__line" d={sentLine} fill="none" style={{ stroke: "var(--primary)" }} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
          <path className="area-chart__line" d={readLine} fill="none" style={{ stroke: "var(--info)" }} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
        </svg>

        {/* Falhas: marcadores na base, maiores quanto mais falhas */}
        {data.map((d, i) =>
          d.failed > 0 ? (
            <span
              key={`f${i}`}
              className="area-chart__fail"
              style={{ left: `${xOf(i)}%`, width: 6 + Math.min(8, Math.log2(d.failed + 1) * 1.5), height: 6 + Math.min(8, Math.log2(d.failed + 1) * 1.5) }}
              aria-hidden="true"
            />
          ) : null
        )}

        {hovered && hover !== null && (
          <>
            <span className="area-chart__cursor" style={{ left: `${xOf(hover)}%` }} aria-hidden="true" />
            <span className="area-chart__dot" style={{ left: `${xOf(hover)}%`, bottom: `${(hovered.sent / maxVal) * 95 + 2.5}%`, background: "var(--primary)" }} aria-hidden="true" />
            <span className="area-chart__dot" style={{ left: `${xOf(hover)}%`, bottom: `${(hovered.read / maxVal) * 95 + 2.5}%`, background: "var(--info)" }} aria-hidden="true" />
            <div className={`area-chart__tooltip${xOf(hover) > 70 ? " area-chart__tooltip--left" : ""}`} style={{ left: `${xOf(hover)}%` }} aria-hidden="true">
              <strong>{formatLabel(hovered.date)}</strong>
              <span><i style={{ background: "var(--primary)" }} />{hovered.sent.toLocaleString("pt-BR")} enviadas</span>
              <span><i style={{ background: "var(--info)" }} />{hovered.read.toLocaleString("pt-BR")} lidas</span>
              {hovered.replies !== undefined && <span><i style={{ background: "var(--violet)" }} />{hovered.replies.toLocaleString("pt-BR")} respostas</span>}
              {hovered.failed > 0 && <span><i style={{ background: "var(--error)" }} />{hovered.failed.toLocaleString("pt-BR")} falhas</span>}
            </div>
          </>
        )}
      </div>
      <div className="area-chart__axis" aria-hidden="true">
        {data.map((d, i) => {
          const every = Math.ceil(data.length / 7);
          return i % every === 0 || i === data.length - 1 ? (
            <span key={i} style={{ left: `${xOf(i)}%` }}>{formatLabel(d.date)}</span>
          ) : null;
        })}
      </div>
    </div>
  );
}
