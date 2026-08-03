import Link from "next/link";
import { logoutAdmin } from "@/app/admin/actions";
import { Brand } from "@/components/Brand";
import { ChartIcon, ListIcon, MessageIcon } from "@/components/icons";

type AdminSidebarProps = {
  active: "metrics" | "content";
};

export function AdminSidebar({ active }: AdminSidebarProps) {
  return (
    <aside className="sidebar" aria-label="Navegação administrativa">
      <Brand href="/admin" />

      <div className="account-card">
        <span className="eyebrow">Conta ativa</span>
        <button className="select-button" type="button" aria-label="Selecionar conta">
          WhatsApp Inteligente Lab
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      <nav className="nav-list" aria-label="Seções administrativas">
        <Link className={active === "metrics" ? "active" : ""} href="/admin">
          <ChartIcon />
          Métricas
        </Link>
        <Link className={active === "content" ? "active" : ""} href="/admin/conteudo">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M8 13h8" />
            <path d="M8 17h5" />
          </svg>
          Conteúdo da Home
        </Link>
        <Link href="/admin">
          <MessageIcon />
          Chat / Atendimento
        </Link>
        <Link href="/admin">
          <ListIcon />
          Listas de Contatos
        </Link>
      </nav>

      <div className="sidebar-footer">
        <div className="operator">
          <span className="avatar">PH</span>
          <span>
            <strong>Pedro Sales</strong>
            <small>admin@inteligentelab.com</small>
          </span>
        </div>
        <form action={logoutAdmin}>
          <button className="ghost-button full-width" type="submit">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 17 5 12l5-5" />
              <path d="M5 12h14" />
            </svg>
            Sair da área ADM
          </button>
        </form>
      </div>
    </aside>
  );
}
