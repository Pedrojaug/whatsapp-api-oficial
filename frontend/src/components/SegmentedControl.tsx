import { useRef } from "react";

interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

/**
 * Grupo de opções exclusivas (padrão ARIA radiogroup): uma única parada de Tab no grupo,
 * setas e Home/End trocam a opção. Visual: .segmented / .segmented__option (index.css).
 */
export default function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel }: SegmentedControlProps<T>) {
  const groupRef = useRef<HTMLDivElement>(null);

  const select = (index: number) => {
    const next = options[(index + options.length) % options.length];
    onChange(next.value);
    groupRef.current?.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const current = Math.max(0, options.findIndex((o) => o.value === value));
    if (e.key === "ArrowRight" || e.key === "ArrowDown") select(current + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") select(current - 1);
    else if (e.key === "Home") select(0);
    else if (e.key === "End") select(options.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div ref={groupRef} className="segmented" role="radiogroup" aria-label={ariaLabel} onKeyDown={onKeyDown}>
      {options.map((o) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            data-value={o.value}
            className="segmented__option"
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
