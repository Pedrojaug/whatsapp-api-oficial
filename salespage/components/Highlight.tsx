import { Fragment } from "react";

/**
 * Converte trechos marcados com *asteriscos* em destaque visual.
 * Mantém o campo editável no admin como texto simples.
 */
export function Highlight({ text }: { text: string }) {
  const parts = text.split(/\*([^*]+)\*/g);

  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <em className="hl" key={index}>
            {part}
          </em>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}
