import { useId, useState } from "react";
import { Check } from "lucide-react";
import { formatBRL, formatUnitBRL, META_RATES_BRL } from "../utils/pricing";

// Calculadora de custo do Painel de Métricas.
// Tarifas e simulador eram dois blocos que repetiam as mesmas três categorias; agora a lista de
// tarifas É o seletor da simulação, e cada categoria mostra o total para a quantidade digitada,
// então dá para comparar sem trocar de opção.

type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";

const CATEGORIES: Array<{ key: TemplateCategory; label: string; use: string }> = [
  { key: "MARKETING", label: "Marketing", use: "Ofertas, promoções e novidades" },
  { key: "UTILITY", label: "Utilidade", use: "Pedido, entrega e avisos" },
  { key: "AUTHENTICATION", label: "Autenticação", use: "Códigos de verificação" },
];

const PRESETS = [1000, 5000, 10000, 50000];
const MAX_CONTACTS = 1_000_000;

const RULES = [
  "A Meta cobra só templates entregues; falhas não são cobradas.",
  "Responder o cliente dentro da janela de 24 h não gera cobrança.",
  "A fatura é debitada no cartão do Business Manager no fim do mês ou ao atingir o limite de cobrança.",
];

const formatCount = (n: number) => n.toLocaleString("pt-BR");
const formatPreset = (n: number) => `${formatCount(n / 1000)} mil`;

interface MetaPricingReferenceProps {
  /** Taxa de entrega real da conta no período (0–100); estima quantas mensagens serão cobradas. */
  deliveryRate?: number;
}

export default function MetaPricingReference({ deliveryRate }: MetaPricingReferenceProps) {
  const [category, setCategory] = useState<TemplateCategory>("MARKETING");
  const [contacts, setContacts] = useState(1000);
  const [draft, setDraft] = useState(formatCount(1000));
  const inputId = useId();
  const groupLabelId = useId();

  const rate = deliveryRate && deliveryRate > 0 ? Math.min(100, deliveryRate) : 100;
  const delivered = Math.round((contacts * rate) / 100);
  const failed = contacts - delivered;
  const totalFor = (c: TemplateCategory) => delivered * META_RATES_BRL[c];
  const selected = CATEGORIES.find((c) => c.key === category)!;

  const setQuantity = (n: number) => {
    const clamped = Math.max(1, Math.min(MAX_CONTACTS, Math.round(n)));
    setContacts(clamped);
    setDraft(formatCount(clamped));
  };

  // Teclado no grupo de categorias (radiogroup): setas trocam a opção.
  const onCategoryKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const i = CATEGORIES.findIndex((c) => c.key === category);
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = CATEGORIES[(i + delta + CATEGORIES.length) % CATEGORIES.length];
    setCategory(next.key);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-cat="${next.key}"]`)?.focus();
  };

  return (
    <div className="calc">
      <div className="calc__inputs">
        {/* Quantidade */}
        <div className="calc__qty">
          <label htmlFor={inputId} className="calc__step">Quantos contatos?</label>
          <div className="calc__qty-row">
            <input
              id={inputId}
              inputMode="numeric"
              autoComplete="off"
              value={draft}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "");
                setDraft(digits ? formatCount(Math.min(MAX_CONTACTS, parseInt(digits, 10))) : "");
                if (digits) setContacts(Math.max(1, Math.min(MAX_CONTACTS, parseInt(digits, 10))));
              }}
              onBlur={() => setDraft(formatCount(contacts))}
              className="field-input calc__qty-input"
            />
            <div className="calc__presets" role="group" aria-label="Quantidades comuns">
              {PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`pricing-sim__preset${contacts === n ? " is-active" : ""}`}
                  aria-pressed={contacts === n}
                  onClick={() => setQuantity(n)}
                >
                  {formatPreset(n)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Categoria: a própria lista de tarifas, com o total para a quantidade digitada */}
        <div>
          <span id={groupLabelId} className="calc__step">Categoria do template</span>
          <div className="calc__cats" role="radiogroup" aria-labelledby={groupLabelId} onKeyDown={onCategoryKey}>
            {CATEGORIES.map((c) => {
              const checked = c.key === category;
              return (
                <button
                  key={c.key}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  tabIndex={checked ? 0 : -1}
                  data-cat={c.key}
                  className={`calc-cat cat-chip--${c.key.toLowerCase()}`}
                  onClick={() => setCategory(c.key)}
                >
                  <span className="calc-cat__head">
                    <span className="calc-cat__name">{c.label}</span>
                    <span className="calc-cat__rate">{formatUnitBRL(META_RATES_BRL[c.key])}<small>/msg</small></span>
                  </span>
                  <span className="calc-cat__use">{c.use}</span>
                  <span className="calc-cat__total">{formatBRL(totalFor(c.key))}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Resultado */}
      <div className="calc__result" aria-live="polite">
        <span className="calc__result-label">Custo estimado · {selected.label}</span>
        <span className="calc__result-value">{formatBRL(totalFor(category))}</span>
        <dl className="calc__breakdown">
          <div>
            <dt>Entregues{rate < 100 ? ` (${rate}% de entrega)` : ""}</dt>
            <dd>≈ {formatCount(delivered)} × {formatUnitBRL(META_RATES_BRL[category])}</dd>
          </div>
          {failed > 0 && (
            <div>
              <dt>Falhas, sem custo</dt>
              <dd>≈ {formatCount(failed)}</dd>
            </div>
          )}
        </dl>
        <p className="calc__hint">Ao criar uma campanha ou disparo, o custo aparece calculado com o template e a lista escolhidos.</p>
      </div>

      {/* Regras de cobrança: fatos curtos, não cartões */}
      <ul className="calc__rules">
        {RULES.map((r) => (
          <li key={r}><Check size={14} aria-hidden="true" />{r}</li>
        ))}
        <li className="calc__rules-note">Valores de referência usados nas estimativas do painel; o valor final é o da fatura da Meta.</li>
      </ul>
    </div>
  );
}
