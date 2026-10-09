import { useId, useState } from "react";
import { Send, Activity, BarChart3, MessageSquare } from "lucide-react";
import SegmentedControl from "./SegmentedControl";
import { formatBRL, formatUSD, formatUnitBRL, formatUnitUSD, META_RATES_BRL, META_RATES_USD } from "../utils/pricing";

// Referência de cobrança da Meta no Painel de Métricas: tarifas, simulador e regras.
// Mesmo visual do restante do painel (tokens, .segmented, .stat-list, .cat-chip).

type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";

const CATEGORIES: Array<{ key: TemplateCategory; label: string; use: string }> = [
  { key: "MARKETING", label: "Marketing", use: "Ofertas, promoções e novidades" },
  { key: "UTILITY", label: "Utilidade", use: "Pedido, entrega e avisos" },
  { key: "AUTHENTICATION", label: "Autenticação", use: "Códigos de verificação" },
];

const PRESETS = [500, 1000, 2500, 5000, 10000, 25000];

const RULES = [
  { icon: Send, title: "Cobrança por template entregue", text: "Mensagens que falham não são cobradas." },
  { icon: MessageSquare, title: "Atendimento sem custo", text: "Responder o cliente dentro da janela de 24 h não gera cobrança." },
  { icon: BarChart3, title: "Fatura da Meta", text: "Debitada no cartão do Business Manager no fim do mês ou ao atingir o limite de cobrança." },
  { icon: Activity, title: "Valores de referência", text: "As estimativas usam esta tabela; o valor final é o da fatura da Meta." },
];

const formatCount = (n: number) => n.toLocaleString("pt-BR");

export default function MetaPricingReference() {
  const [category, setCategory] = useState<TemplateCategory>("MARKETING");
  const [contacts, setContacts] = useState(1000);
  const inputId = useId();
  const rangeId = useId();

  const unitBrl = META_RATES_BRL[category];
  const unitUsd = META_RATES_USD[category];
  const totalBrl = contacts * unitBrl;
  const totalUsd = contacts * unitUsd;

  return (
    <div className="pricing-ref">
      {/* Tarifas por categoria */}
      <section className="pricing-ref__block" aria-labelledby="pricing-rates-title">
        <h3 id="pricing-rates-title" className="pricing-ref__title">Tarifa por mensagem</h3>
        <dl className="stat-list">
          {CATEGORIES.map((c) => (
            <div key={c.key}>
              <dt className="pricing-ref__rate-label">
                <span className={`cat-chip cat-chip--${c.key.toLowerCase()}`}>{c.label}</span>
                <span className="pricing-ref__use">{c.use}</span>
              </dt>
              <dd>
                {formatUnitBRL(META_RATES_BRL[c.key])}
                <small> · {formatUnitUSD(META_RATES_USD[c.key])}</small>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Simulador */}
      <section className="pricing-ref__block" aria-labelledby="pricing-sim-title">
        <h3 id="pricing-sim-title" className="pricing-ref__title">Simular um disparo</h3>

        <SegmentedControl
          ariaLabel="Categoria do template"
          value={category}
          onChange={setCategory}
          options={CATEGORIES.map((c) => ({ value: c.key, label: c.label }))}
        />

        <div className="pricing-sim__qty">
          <label htmlFor={inputId} className="field-label">Contatos</label>
          <input
            id={inputId}
            type="number"
            min={1}
            max={1000000}
            step={100}
            value={contacts}
            onChange={(e) => setContacts(Math.max(1, Math.min(1000000, parseInt(e.target.value, 10) || 1)))}
            className="field-input pricing-sim__input"
          />
        </div>
        <input
          id={rangeId}
          type="range"
          min={100}
          max={50000}
          step={100}
          value={Math.min(contacts, 50000)}
          onChange={(e) => setContacts(parseInt(e.target.value, 10))}
          className="pricing-sim__range"
          aria-label="Quantidade de contatos"
        />
        <div className="pricing-sim__presets">
          {PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              className={`pricing-sim__preset${contacts === n ? " is-active" : ""}`}
              aria-pressed={contacts === n}
              onClick={() => setContacts(n)}
            >
              {n >= 1000 ? `${n / 1000} mil` : n}
            </button>
          ))}
        </div>

        <div className="pricing-sim__result" aria-live="polite">
          <span className="pricing-sim__result-label">{formatCount(contacts)} mensagens entregues</span>
          <span className="pricing-sim__result-value">{formatBRL(totalBrl)}</span>
          <span className="pricing-sim__result-sub">{formatUSD(totalUsd)} · {formatUnitBRL(unitBrl)} cada</span>
        </div>
      </section>

      {/* Regras de cobrança */}
      <section className="pricing-ref__rules" aria-label="Regras de cobrança da Meta">
        {RULES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="pricing-rule">
            <span className="pricing-rule__icon" aria-hidden="true"><Icon size={15} /></span>
            <div>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
