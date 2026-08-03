import Link from "next/link";

type BrandProps = {
  href?: string;
  label?: string;
  centered?: boolean;
};

export function Brand({ href = "/", label = "por Inteligente Lab", centered = false }: BrandProps) {
  return (
    <Link className={`brand${centered ? " centered-brand" : ""}`} href={href} aria-label="Send Inteligente">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
        </svg>
      </span>
      <span>
        <strong>
          Send <em>Inteligente</em>
        </strong>
        <small>{label}</small>
      </span>
    </Link>
  );
}
