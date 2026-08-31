import Link from "next/link";

type BrandProps = {
  href?: string;
  label?: string;
  className?: string;
};

export function BrandIcon({ size = 32 }: { size?: number }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 105" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, display: "block" }}
    >
      {/* Balão de mensagem oficial */}
      <path 
        d="M24 6 H76 C86 6 94 14 94 24 V64 C94 74 86 82 76 82 H48 C44 82 40 85 38 88 L34 93 C31 97 25 96 23 92 C21 88 21 85 21 82 H24 C14 82 6 74 6 64 V24 C6 14 14 6 24 6 Z" 
        stroke="#00c26b" 
        strokeWidth="8" 
        strokeLinejoin="round"
        fill="none"
      />
      {/* 3 Linhas horizontais */}
      <rect x="22" y="26" width="46" height="7.5" rx="3.75" fill="#00c26b" />
      <rect x="22" y="42" width="34" height="7.5" rx="3.75" fill="#00c26b" />
      <rect x="22" y="58" width="20" height="7.5" rx="3.75" fill="#00c26b" />
      {/* S na cauda */}
      <path
        d="M34 76 C30 76 26 78 26 83 C26 87 31 89 35 91 C39 93 42 95 42 100 C42 104 36 107 30 107 C24 107 20 103 20 98"
        stroke="#00c26b"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function Brand({ href = "/", label, className = "" }: BrandProps) {
  return (
    <Link className={`brand-link ${className}`} href={href}>
      <BrandIcon size={32} />
      <span className="brand-logotype">
        <span className="brand-send">Send</span>
        <span className="brand-inteligentte">Inteligentte</span>
        {label ? <small className="brand-sub-label"> • {label}</small> : null}
      </span>
    </Link>
  );
}

export default Brand;
