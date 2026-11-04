import { createContext, type ReactNode } from "react";

export interface ConfirmOptions {
  title: string;
  /** Consequência da ação, em linguagem direta. Aceita "\n" para quebrar linha. */
  description?: ReactNode;
  /** Verbo explícito ("Excluir lista"), nunca "OK". */
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  /** Exige digitar este texto exato para liberar o botão. Use em ações irreversíveis de alto impacto. */
  requireText?: string;
}

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<ConfirmFn | undefined>(undefined);
