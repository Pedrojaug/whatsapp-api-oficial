import Link from "next/link";
import { loginAdmin } from "@/app/admin/actions";
import { Brand } from "@/components/Brand";
import { ArrowLeftIcon } from "@/components/icons";

type AdminLoginProps = {
  hasError: boolean;
};

export function AdminLogin({ hasError }: AdminLoginProps) {
  return (
    <main className="admin-login-page">
      <header className="checkout-header">
        <Brand href="/" label="Área administrativa" />
        <Link className="secondary-button compact" href="/">
          <ArrowLeftIcon />
          Voltar
        </Link>
      </header>

      <section className="login-card">
        <span className="pill success">Acesso restrito</span>
        <h1>Entre para acessar o painel ADM.</h1>
        <p>Use seu login e senha administrativos para visualizar métricas, listas, templates e histórico de envios.</p>

        <form action={loginAdmin} className="admin-login-form">
          <label>
            Login
            <input name="username" type="text" autoComplete="username" placeholder="admin@empresa.com" required />
          </label>
          <label>
            Senha
            <input name="password" type="password" autoComplete="current-password" placeholder="Sua senha" required />
          </label>

          {hasError ? (
            <p className="form-error" role="alert">
              Login ou senha inválidos. Confira os dados e tente novamente.
            </p>
          ) : null}

          <button className="primary-button full-width" type="submit">
            Acessar painel
          </button>
        </form>
      </section>
    </main>
  );
}
