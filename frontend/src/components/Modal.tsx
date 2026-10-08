import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  /** Ícone opcional ao lado do título. */
  icon?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** Botões de ação; ficam no rodapé (.modal-footer). */
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** Envolve corpo e rodapé num <form>, para Enter enviar e os botões type="submit" funcionarem. */
  onSubmit?: (e: React.FormEvent) => void;
  bodyClassName?: string;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal do design system: .modal-overlay + .modal-card, renderizado no <body> via portal.
 * Acessível: role="dialog", aria-modal, título ligado por aria-labelledby, foco preso dentro,
 * Esc e clique fora fecham, e o foco volta para quem abriu.
 */
export default function Modal({ open, onClose, title, icon, size = "md", footer, children, onSubmit, bodyClassName }: ModalProps) {
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  // O efeito de foco roda só ao abrir; a ref mantém o onClose mais recente sem reabrir o efeito.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const card = cardRef.current;
    // Foco no primeiro campo do formulário; se não houver, no próprio diálogo.
    const firstField = card?.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled]), textarea:not([disabled])");
    (firstField ?? card)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      // Só o diálogo do topo responde ao teclado (ex.: uma confirmação aberta sobre este modal).
      const openDialogs = document.querySelectorAll('[aria-modal="true"]');
      if (openDialogs[openDialogs.length - 1] !== cardRef.current) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !cardRef.current) return;
      const focusable = Array.from(cardRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
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
  }, [open]);

  if (!open) return null;

  const sizeClass = size === "md" ? "" : ` modal-card--${size}`;
  const inner = (
    <>
      <div className={`modal-body${bodyClassName ? ` ${bodyClassName}` : ""}`}>{children}</div>
      {footer && <div className="modal-footer">{footer}</div>}
    </>
  );

  return createPortal(
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={cardRef}
        className={`modal-card${sizeClass}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-header">
          <h2 id={titleId} className="modal-header__title modal-header__title--with-icon">
            {icon}
            {title}
          </h2>
          <button type="button" className="modal-header__close" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        {onSubmit ? <form onSubmit={onSubmit} className="modal-form">{inner}</form> : inner}
      </div>
    </div>,
    document.body
  );
}
