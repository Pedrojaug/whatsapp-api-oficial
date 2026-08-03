import Link from "next/link";
import { updateHomeContent } from "@/app/admin/actions";
import { AdminSidebar } from "@/components/AdminSidebar";
import type { SiteContent } from "@/lib/site-content";

type AdminContentEditorProps = {
  content: SiteContent;
  wasSaved: boolean;
};

function fixedFields(items: string[], fallbackCount: number) {
  const fields = [...items];

  while (fields.length < fallbackCount) {
    fields.push("");
  }

  return fields.slice(0, fallbackCount);
}

export function AdminContentEditor({ content, wasSaved }: AdminContentEditorProps) {
  const proofItems = fixedFields(content.proofItems, 3);
  const inclusions = fixedFields(content.inclusions, 4);

  return (
    <main className="admin-shell">
      <AdminSidebar active="content" />

      <section className="admin-content">
        <header className="admin-topbar">
          <div>
            <h1>Conteúdo da Home</h1>
            <p>Edite os textos comerciais da página inicial para campanhas, ofertas e anúncios.</p>
          </div>
          <Link className="secondary-button compact" href="/" target="_blank">
            Ver página
          </Link>
        </header>

        {wasSaved ? (
          <div className="success-alert" role="status">
            Conteúdo salvo. A página inicial já está usando os novos textos.
          </div>
        ) : null}

        <form action={updateHomeContent} className="content-editor">
          <section className="editor-panel">
            <div className="panel-title compact-title">
              <h2>Hero e publicidade</h2>
              <span>Primeiro bloco da página</span>
            </div>

            <div className="editor-grid">
              <label>
                Chamada promocional
                <input name="announcement" defaultValue={content.announcement} placeholder="Ex: Black Friday para WhatsApp" />
              </label>
              <label>
                Selo acima do título
                <input name="heroBadge" defaultValue={content.heroBadge} required />
              </label>
              <label className="full-field">
                Título principal
                <textarea name="heroTitle" defaultValue={content.heroTitle} rows={3} required />
              </label>
              <label className="full-field">
                Descrição
                <textarea name="heroDescription" defaultValue={content.heroDescription} rows={4} required />
              </label>
              <label>
                CTA principal
                <input name="primaryCta" defaultValue={content.primaryCta} required />
              </label>
              <label>
                CTA secundário
                <input name="secondaryCta" defaultValue={content.secondaryCta} required />
              </label>
            </div>
          </section>

          <section className="editor-panel">
            <div className="panel-title compact-title">
              <h2>Prova e prévia</h2>
              <span>Chips e simulação do painel</span>
            </div>

            <div className="editor-grid">
              {proofItems.map((item, index) => (
                <label key={`proof-${index}`}>
                  Chip {index + 1}
                  <input name="proofItems" defaultValue={item} required />
                </label>
              ))}
              <label className="full-field">
                Campanha exibida na prévia
                <input name="previewCampaign" defaultValue={content.previewCampaign} required />
              </label>
              <label className="full-field">
                Mensagem do template
                <textarea name="templateMessage" defaultValue={content.templateMessage} rows={4} required />
              </label>
            </div>
          </section>

          <section className="editor-panel">
            <div className="panel-title compact-title">
              <h2>Bloco da oferta</h2>
              <span>Texto próximo aos planos</span>
            </div>

            <div className="editor-grid">
              <label>
                Selo da oferta
                <input name="offerKicker" defaultValue={content.offerKicker} required />
              </label>
              <label className="full-field">
                Título da oferta
                <textarea name="offerTitle" defaultValue={content.offerTitle} rows={3} required />
              </label>
              <label className="full-field">
                Descrição da oferta
                <textarea name="offerDescription" defaultValue={content.offerDescription} rows={4} required />
              </label>
              {inclusions.map((item, index) => (
                <label key={`inclusion-${index}`}>
                  Item incluso {index + 1}
                  <input name="inclusions" defaultValue={item} required />
                </label>
              ))}
            </div>
          </section>

          <div className="editor-actions">
            <Link className="secondary-button" href="/admin">
              Voltar para métricas
            </Link>
            <button className="primary-button" type="submit">
              Salvar conteúdo da home
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
