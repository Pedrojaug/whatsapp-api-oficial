import { AdminSidebar } from "@/components/AdminSidebar";
import { RefreshIcon } from "@/components/icons";

export function AdminDashboard() {
  return (
    <main className="admin-shell">
      <AdminSidebar active="metrics" />

      <section className="admin-content">
        <header className="admin-topbar">
          <div>
            <h1>Painel de Métricas</h1>
            <p>Visão geral dos disparos efetuados pela conta WhatsApp Inteligente Lab.</p>
          </div>
          <button className="secondary-button compact" type="button">
            <RefreshIcon />
            Atualizar dados
          </button>
        </header>

        <section className="admin-filter" aria-label="Filtros do dashboard">
          <button className="is-selected" type="button">
            Últimos 7 dias
          </button>
          <button type="button">Hoje</button>
          <button type="button">Ontem</button>
          <button type="button">Últimos 30 dias</button>
          <button type="button">Personalizado</button>
        </section>

        <section className="metrics-grid" aria-label="Indicadores">
          <article className="metric-card">
            <span>Total disparado</span>
            <strong>31</strong>
          </article>
          <article className="metric-card purple">
            <span>Enviado</span>
            <strong>18</strong>
          </article>
          <article className="metric-card cyan">
            <span>Entregue</span>
            <strong>14</strong>
          </article>
          <article className="metric-card green">
            <span>Lido</span>
            <strong>3</strong>
          </article>
          <article className="metric-card red">
            <span>Falhas</span>
            <strong>6</strong>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="panel funnel-panel">
            <div className="panel-title">
              <h2>Funil de Entrega</h2>
              <span>Últimos 7 dias</span>
            </div>
            <div className="funnel-row">
              <div>
                <strong>Taxa de leitura</strong>
                <span>10%</span>
              </div>
              <div className="progress-track green">
                <span style={{ width: "10%" }} />
              </div>
            </div>
            <div className="funnel-row">
              <div>
                <strong>Taxa de entrega</strong>
                <span>55%</span>
              </div>
              <div className="progress-track cyan">
                <span style={{ width: "55%" }} />
              </div>
            </div>
          </article>

          <article className="panel chart-panel">
            <div className="panel-title">
              <h2>Histórico de Envio Diário</h2>
              <div className="legend">
                <span>
                  <i className="dot green" />
                  Enviados
                </span>
                <span>
                  <i className="dot cyan" />
                  Lidos
                </span>
                <span>
                  <i className="dot red" />
                  Falhas
                </span>
              </div>
            </div>
            <div className="bar-chart" aria-label="Gráfico de envios diários">
              <div className="bar-day">
                <span className="stack paid" style={{ height: "12%" }} />
                <small>8 jun.</small>
              </div>
              <div className="bar-day">
                <span className="stack paid" style={{ height: "70%" }} />
                <span className="stack leads" style={{ height: "14%" }} />
                <span className="stack failed" style={{ height: "25%" }} />
                <small>12 jun.</small>
              </div>
              <div className="bar-day">
                <span className="stack paid" style={{ height: "8%" }} />
                <small>15 jun.</small>
              </div>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
