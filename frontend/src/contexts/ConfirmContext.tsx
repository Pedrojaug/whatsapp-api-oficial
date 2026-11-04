import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ConfirmContext, type ConfirmFn, type ConfirmOptions } from "./confirmContextValue";

interface PendingConfirm extends ConfirmOptions {
  id: number;
  resolve: (confirmed: boolean) => void;
}

/**
 * Substitui window.confirm/prompt por um diálogo da marca, acessível (alertdialog, foco preso,
 * Esc cancela, foco devolvido ao gatilho). Uso: `if (!(await confirm({ ... }))) return;`
 */
export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const pendingRef = useRef<PendingConfirm | null>(null);
  const nextIdRef = useRef(0);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      // Um diálogo por vez: se outro pedido chegar, o anterior conta como cancelado.
      pendingRef.current?.resolve(false);
      nextIdRef.current += 1;
      const next = { ...options, id: nextIdRef.current, resolve };
      pendingRef.current = next;
      setPending(next);
    });
  }, []);

  const close = useCallback((confirmed: boolean) => {
    pendingRef.current?.resolve(confirmed);
    pendingRef.current = null;
    setPending(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && <ConfirmDialog key={pending.id} options={pending} onClose={close} />}
    </ConfirmContext.Provider>
  );
};

function ConfirmDialog({ options, onClose }: { options: ConfirmOptions; onClose: (confirmed: boolean) => void }) {
  const titleId = useId();
  const descriptionId = useId();
  const inputId = useId();
  const [typed, setTyped] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isDanger = options.tone === "danger";
  const canConfirm = !options.requireText || typed.trim() === options.requireText;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Foco inicial no campo de digitação, se houver; senão em Cancelar, que é o padrão seguro.
    (options.requireText ? inputRef.current : cancelRef.current)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose(false);
        return;
      }
      if (e.key !== "Tab" || !cardRef.current) return;
      const focusable = Array.from(
        cardRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled])")
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
    // onClose vem de useCallback estável no provider, então o efeito roda só na abertura.
  }, [options.requireText, onClose]);

  return createPortal(
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose(false);
      }}
    >
      <div
        ref={cardRef}
        className="modal-card modal-card--sm confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={options.description ? descriptionId : undefined}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canConfirm) onClose(true);
          }}
        >
          <div className="modal-header">
            <h2 id={titleId} className="modal-header__title">{options.title}</h2>
          </div>

          {(options.description || options.requireText) && (
            <div className="modal-body">
              {options.description && (
                <div id={descriptionId} className="confirm-dialog__description">{options.description}</div>
              )}
              {options.requireText && (
                <div className="field">
                  <label htmlFor={inputId} className="field-label">
                    Digite <strong>{options.requireText}</strong> para confirmar
                  </label>
                  <input
                    ref={inputRef}
                    id={inputId}
                    className="field-input"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              )}
            </div>
          )}

          <div className="modal-footer">
            <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={() => onClose(false)}>
              {options.cancelLabel ?? "Cancelar"}
            </button>
            <button type="submit" className={`btn ${isDanger ? "btn-danger" : "btn-primary"}`} disabled={!canConfirm}>
              {options.confirmLabel ?? "Confirmar"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
