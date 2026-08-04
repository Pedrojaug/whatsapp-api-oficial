import Link from "next/link";
import { Brand } from "@/components/Brand";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <Brand />
          <p>
            Plataforma de disparo e automação de mensagens no WhatsApp pela API Oficial da Meta, feita para operações
            comerciais que precisam de escala sem abrir mão de conformidade.
          </p>
        </div>

        <nav className="footer-nav" aria-label="Navegação do rodapé">
          <div>
            <strong>Produto</strong>
            <a href="#como-funciona">Como funciona</a>
            <a href="#recursos">Recursos</a>
            <a href="#planos">Planos</a>
            <a href="#duvidas">Dúvidas</a>
          </div>
          <div>
            <strong>Legal</strong>
            <a href="/politica-de-privacidade.html">Política de Privacidade</a>
            <a href="/termos-e-condicoes.html">Termos e Condições</a>
          </div>
          <div>
            <strong>Acesso</strong>
            <Link href="/checkout?plano=trimestral">Assinar</Link>
            <Link href="/admin">Área ADM</Link>
          </div>
        </nav>
      </div>

      <div className="footer-base">
        <span>© {year} Send Inteligente · Inteligente Lab</span>
        <span className="footer-note">
          WhatsApp é uma marca da Meta Platforms, Inc. Este produto não é afiliado nem endossado pela Meta.
        </span>
      </div>
    </footer>
  );
}
