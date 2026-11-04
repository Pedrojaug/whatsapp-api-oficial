import { useState, type ReactNode } from "react";
import "./PhoneSimulator.css";

interface Button {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "COPY_CODE" | string;
  text: string;
  url?: string;
  phoneNumber?: string;
}

interface PhoneSimulatorProps {
  headerFormat?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE";
  headerText?: string;
  mediaUrl?: string;
  bodyText: string;
  variables?: string[];
  footerText?: string;
  buttons?: Button[];
  /** Nome que o cliente vê no topo da conversa (nome da conta). */
  businessName?: string;
}

// Ícones no estilo Material, usados pelo WhatsApp no Android
const ICONS = {
  back: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
  video: "M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z",
  call: "M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z",
  more: "M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z",
  emoji: "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z",
  attach: "M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z",
  camera: "M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM9 2 7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z",
  mic: "M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z",
  reply: "M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z",
  link: "M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z",
  copy: "M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z",
  list: "M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z",
  image: "M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z",
  play: "M8 5v14l11-7z",
  lock: "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z",
  wifi: "M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z",
  signal: "M2 22h20V2z",
};

function Icon({ d }: { d: string }) {
  return (
    <svg className="wa-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}

// ─── Formatação do WhatsApp: *negrito*, _itálico_, ~tachado~, ```mono```, `código`, links ───
const EDGE_BEFORE = "(^|[\\s\\p{P}\\p{S}])";
const EDGE_AFTER = "(?=$|[\\s\\p{P}\\p{S}])";
const wrapped = (m: string) => {
  const e = m === "*" ? "\\*" : m; // no modo /u só se escapa o que é sintaxe
  return new RegExp(`${EDGE_BEFORE}${e}(?=[^${e}\\s])([^${e}\\n]*?[^${e}\\s])${e}${EDGE_AFTER}`, "u");
};

type InlineKind = "mono" | "code" | "link" | "bold" | "italic" | "strike";
const INLINE_RULES: { kind: InlineKind; re: RegExp }[] = [
  { kind: "mono", re: /()```([^\n]+?)```/u },
  { kind: "code", re: wrapped("`") },
  { kind: "link", re: /(^|\s)((?:https?:\/\/|www\.)\S*[^\s.,!?;:)])/u },
  { kind: "bold", re: wrapped("*") },
  { kind: "italic", re: wrapped("_") },
  { kind: "strike", re: wrapped("~") },
];

function parseInline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let n = 0;
  while (rest) {
    let best: { start: number; end: number; inner: string; kind: InlineKind } | null = null;
    for (const rule of INLINE_RULES) {
      const m = rule.re.exec(rest);
      if (!m) continue;
      const start = m.index + m[1].length;
      if (!best || start < best.start) best = { start, end: m.index + m[0].length, inner: m[2], kind: rule.kind };
    }
    if (!best) {
      out.push(rest);
      break;
    }
    if (best.start > 0) out.push(rest.slice(0, best.start));
    const key = `${keyBase}-${n++}`;
    const { inner } = best;
    switch (best.kind) {
      case "mono": out.push(<span key={key} className="wa-mono">{inner}</span>); break;
      case "code": out.push(<code key={key} className="wa-code">{inner}</code>); break;
      case "link": out.push(<span key={key} className="wa-link">{inner}</span>); break;
      case "bold": out.push(<strong key={key}>{parseInline(inner, key)}</strong>); break;
      case "italic": out.push(<em key={key}>{parseInline(inner, key)}</em>); break;
      case "strike": out.push(<s key={key}>{parseInline(inner, key)}</s>); break;
    }
    rest = rest.slice(best.end);
  }
  return out;
}

const MULTILINE_MONO = /(```(?:(?!```)[\s\S])*\n(?:(?!```)[\s\S])*```)/;

/** Corpo em blocos (linhas, citações, listas); `tail` entra no fim da última linha. */
function renderFormatted(text: string, tail: ReactNode): ReactNode[] {
  const segments = text.split(MULTILINE_MONO).filter((s) => s !== "");
  const blocks: { kind: "line" | "mono"; text: string }[] = [];
  segments.forEach((seg, i) => {
    if (MULTILINE_MONO.test(seg) && seg.startsWith("```")) {
      blocks.push({ kind: "mono", text: seg.slice(3, -3) });
      return;
    }
    let s = seg;
    if (i > 0 && s.startsWith("\n")) s = s.slice(1);
    if (i < segments.length - 1 && s.endsWith("\n")) s = s.slice(0, -1);
    if (s === "" && i > 0 && i < segments.length - 1) return;
    s.split("\n").forEach((line) => blocks.push({ kind: "line", text: line }));
  });

  return blocks.map((block, i) => {
    const key = `b${i}`;
    const end = i === blocks.length - 1 ? tail : null;
    if (block.kind === "mono") {
      return <div key={key} className="wa-mono wa-mono-block">{block.text}{end}</div>;
    }
    const line = block.text;
    const quote = /^> ?(.*)$/.exec(line);
    if (quote) return <div key={key} className="wa-line wa-quote">{parseInline(quote[1], key)}{end}</div>;
    const bullet = /^[-*•] (.*)$/.exec(line);
    if (bullet) {
      return (
        <div key={key} className="wa-line wa-li">
          <span className="wa-li__mark" aria-hidden="true">•</span>
          <span>{parseInline(bullet[1], key)}{end}</span>
        </div>
      );
    }
    const numbered = /^(\d{1,3})\. (.*)$/.exec(line);
    if (numbered) {
      return (
        <div key={key} className="wa-line wa-li">
          <span className="wa-li__mark">{numbered[1]}.</span>
          <span>{parseInline(numbered[2], key)}{end}</span>
        </div>
      );
    }
    return <div key={key} className="wa-line">{line ? parseInline(line, key) : " "}{end}</div>;
  });
}

const BUTTON_ICON: Record<string, string> = {
  QUICK_REPLY: ICONS.reply,
  URL: ICONS.link,
  PHONE_NUMBER: ICONS.call,
  COPY_CODE: ICONS.copy,
};

function getFileName(url: string) {
  if (!url || url.startsWith("blob:") || url.startsWith("data:")) return "documento.pdf";
  const last = url.split("?")[0].split("/").pop();
  try {
    return last ? decodeURIComponent(last) : "documento.pdf";
  } catch {
    return last || "documento.pdf";
  }
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export default function PhoneSimulator({
  headerFormat = "NONE",
  headerText = "",
  mediaUrl = "",
  bodyText = "",
  variables = [],
  footerText = "",
  buttons = [],
  businessName = "Sua empresa",
}: PhoneSimulatorProps) {
  const [time] = useState(() =>
    new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );

  const body = variables.reduce(
    (text, val, idx) => text.split(`{{${idx + 1}}}`).join(val || `{{${idx + 1}}}`),
    bodyText
  );

  const hasMedia = headerFormat === "IMAGE" || headerFormat === "VIDEO" || headerFormat === "DOCUMENT";
  const hasButtons = buttons.length > 0;
  // O WhatsApp mostra até 3 botões; com mais, exibe 2 e "Ver todas as opções"
  const visibleButtons = buttons.length > 3 ? buttons.slice(0, 2) : buttons;
  const spacer = <span className="wa-spacer" aria-hidden="true" />;
  const timeOnMedia = hasMedia && headerFormat !== "DOCUMENT" && !body && !footerText;

  const fileName = getFileName(mediaUrl);
  const fileExt = (fileName.split(".").pop() || "pdf").slice(0, 4).toUpperCase();

  return (
    <figure className="wa-phone" aria-label="Prévia da mensagem como o cliente verá no WhatsApp" style={{ margin: 0 }}>
      <div className="wa-screen">
        <div className="wa-status" aria-hidden="true">
          <span>{time}</span>
          <span className="wa-status__camera" />
          <span className="wa-status__icons">
            <svg viewBox="0 0 24 24"><path d={ICONS.wifi} /></svg>
            <svg viewBox="0 0 24 24"><path d={ICONS.signal} /></svg>
            <span className="wa-status__battery" />
          </span>
        </div>

        <div className="wa-header">
          <span className="wa-header__back" aria-hidden="true">
            <Icon d={ICONS.back} />
            <span className="wa-avatar">{getInitials(businessName)}</span>
          </span>
          <span className="wa-header__info">
            <span className="wa-header__name">{businessName}</span>
            <span className="wa-header__sub">Conta comercial</span>
          </span>
          <span className="wa-header__actions" aria-hidden="true">
            <Icon d={ICONS.video} />
            <Icon d={ICONS.call} />
            <Icon d={ICONS.more} />
          </span>
        </div>

        <div className="wa-chat" tabIndex={0} role="region" aria-label="Conversa">
          <span className="wa-chip">Hoje</span>
          <span className="wa-chip wa-chip--notice">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS.lock} /></svg>
            Esta empresa usa um serviço seguro da Meta para gerenciar esta conversa. Toque para saber mais.
          </span>

          <div
            className={[
              "wa-bubble",
              hasMedia || hasButtons ? "wa-bubble--wide" : "",
              hasMedia ? "wa-bubble--has-media" : "",
            ].join(" ")}
          >
            <svg className="wa-bubble__tail" viewBox="0 0 8 13" aria-hidden="true">
              <path d="M1.533 3.568 8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568z" />
            </svg>

            <div className="wa-bubble__content">
              {headerFormat === "IMAGE" && (
                <div className={`wa-media${mediaUrl ? " wa-media--loaded" : ""}`}>
                  {mediaUrl ? (
                    <img src={mediaUrl} alt="Imagem do cabeçalho" />
                  ) : (
                    <span className="wa-media__placeholder" role="img" aria-label="Imagem do cabeçalho">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS.image} /></svg>
                    </span>
                  )}
                </div>
              )}

              {headerFormat === "VIDEO" && (
                <div className={`wa-media${mediaUrl ? " wa-media--loaded" : ""}`} aria-label="Vídeo do cabeçalho" role="img">
                  {mediaUrl && <video src={mediaUrl} muted playsInline preload="metadata" aria-hidden="true" />}
                  <span className="wa-media__play" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d={ICONS.play} /></svg>
                  </span>
                  <span className="wa-media__duration" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d={ICONS.video} /></svg>
                    0:15
                  </span>
                </div>
              )}

              {headerFormat === "DOCUMENT" && (
                <div className="wa-doc">
                  <span className="wa-doc__icon" aria-hidden="true">{fileExt}</span>
                  <span className="wa-doc__info">
                    <span className="wa-doc__name">{fileName}</span>
                    <span className="wa-doc__meta">{fileExt} • 1 página</span>
                  </span>
                </div>
              )}

              {headerFormat === "TEXT" && headerText && (
                <div className="wa-bubble__title">{parseInline(headerText, "h")}</div>
              )}

              {body ? (
                <div className="wa-bubble__text">{renderFormatted(body, footerText ? null : spacer)}</div>
              ) : !hasMedia ? (
                <div className="wa-bubble__text wa-bubble__text--placeholder">
                  Escreva o corpo da mensagem...{footerText ? null : spacer}
                </div>
              ) : null}

              {footerText && (
                <div className="wa-bubble__footer">
                  {footerText}
                  {spacer}
                </div>
              )}

              <span className={`wa-time${timeOnMedia ? " wa-time--on-media" : ""}`}>{time}</span>
            </div>

            {hasButtons && (
              <div className="wa-buttons">
                {visibleButtons.map((btn, idx) => (
                  <div key={idx} className="wa-button">
                    {BUTTON_ICON[btn.type] && (
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d={BUTTON_ICON[btn.type]} /></svg>
                    )}
                    {btn.text || "Botão"}
                  </div>
                ))}
                {buttons.length > 3 && (
                  <div className="wa-button">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS.list} /></svg>
                    Ver todas as opções
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="wa-composer" aria-hidden="true">
          <span className="wa-composer__field">
            <Icon d={ICONS.emoji} />
            <span className="wa-composer__placeholder">Mensagem</span>
            <span style={{ display: "inline-flex", transform: "rotate(-45deg)" }}><Icon d={ICONS.attach} /></span>
            <Icon d={ICONS.camera} />
          </span>
          <span className="wa-composer__mic"><Icon d={ICONS.mic} /></span>
        </div>
        <div className="wa-home-bar" aria-hidden="true" />
      </div>
    </figure>
  );
}
