import Link from "next/link";

type BrandProps = {
  href?: string;
  label?: string;
};

export function Brand({ href = "/", label }: BrandProps) {
  return (
    <Link className="brand" href={href}>
      <span className="brand-logo" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 2L11 13" />
          <path d="M22 2L15 22L11 13L2 9L22 2Z" />
        </svg>
      </span>
      <span className="brand-text">
        Send Inteligentte
        {label ? <small className="brand-sub-label"> • {label}</small> : null}
      </span>
    </Link>
  );
}
