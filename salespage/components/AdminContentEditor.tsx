import Link from "next/link";
import { updateHomeContent } from "@/app/admin/actions";
import { AdminSidebar } from "@/components/AdminSidebar";
import type { FaqItem, Metric, SiteContent, Testimonial } from "@/lib/site-content";

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

function fixedRows<T>(items: T[], fallbackCount: number, empty: T) {
  const rows = [...items];

  while (rows.length < fallbackCount) {
    rows.push(empty);
  }

  return rows.slice(0, fallbackCount);
}

export function AdminContentEditor({ content, wasSaved }: AdminContentEditorProps) {
  const proofItems = fixedFields(content.proofItems, 3);
  const inclusions = fixedFields(content.inclusions, 4);
  const metrics = fixedRows<Metric>(content.metrics, 4, { value: "", label: "" });
  const testimonials = fixedRows<Testimonial>(content.testimonials, 3, { quote: "", author: "", role: "" });
  const faq = fixedRows<FaqItem>(content.faq, 6, { question: "", answer: "" });

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

            <p className="editor-hint">
              No título principal, envolva um trecho com <code>*asteriscos*</code> para destacá-lo em verde. Ex.:{" "}
              <code>Dispare *sem arriscar o seu número*.</code> Deixe a chamada promocional em branco para esconder a
              barra do topo.
            </p>

            <div className="editor-grid">
              <label>
                Chamada promocional (barra do topo)
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
              <h2>Números de prova social</h2>
              <span>Faixa logo abaixo do hero</span>
            </div>

            <p className="editor-hint">
              Publique apenas números que você consegue sustentar. Enquanto estiverem como <code>[NÚMERO]</code>, a
              faixa segue visível na página — troque antes de divulgar o link.
            </p>

            <div className="editor-grid">
              <label className="full-field">
                Título da faixa
                <input name="socialProofLabel" defaultValue={content.socialProofLabel} required />
              </label>

              {metrics.map((metric, index) => (
                <div className="editor-row is-pair" key={`metric-${index}`}>
                  <label>
                    Número {index + 1}
                    <input name="value" defaultValue={metric.value} placeholder="Ex: 1,2 mi" />
                  </label>
                  <label>
                    Legenda {index + 1}
                    <input name="label" defaultValue={metric.label} placeholder="Ex: mensagens entregues por mês" />
                  </label>
                </div>
              ))}
            </div>
          </section>

          <section className="editor-panel">
            <div className="panel-title compact-title">
              <h2>Depoimentos</h2>
              <span>Três cards de clientes</span>
            </div>

            <p className="editor-hint">
              Use depoimentos reais e autorizados pelo cliente. Deixe os três campos de um depoimento em branco para
              cair no texto padrão.
            </p>

            <div className="editor-grid">
              {testimonials.map((testimonial, index) => (
                <div className="editor-row is-stack" key={`testimonial-${index}`}>
                  <label>
                    Depoimento {index + 1}
                    <textarea name="quote" defaultValue={testimonial.quote} rows={3} />
                  </label>
                  <div className="editor-row is-pair">
                    <label>
                      Nome
                      <input name="author" defaultValue={testimonial.author} placeholder="Ex: Ana Souza" />
                    </label>
                    <label>
                      Cargo e empresa
                      <input name="role" defaultValue={testimonial.role} placeholder="Ex: Head de Vendas · Empresa X" />
                    </label>
                  </div>
                </div>
              ))}
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
              <label className="full-field">
                Compromisso / garantia (deixe em branco para esconder o bloco)
                <textarea name="guarantee" defaultValue={content.guarantee} rows={3} />
              </label>
            </div>
          </section>

          <section className="editor-panel">
            <div className="panel-title compact-title">
              <h2>Dúvidas frequentes</h2>
              <span>Objeções antes da compra</span>
            </div>

            <div className="editor-grid">
              {faq.map((item, index) => (
                <div className="editor-row is-stack" key={`faq-${index}`}>
                  <label>
                    Pergunta {index + 1}
                    <input name="question" defaultValue={item.question} />
                  </label>
                  <label>
                    Resposta {index + 1}
                    <textarea name="answer" defaultValue={item.answer} rows={3} />
                  </label>
                </div>
              ))}
            </div>
          </section>

          <section className="editor-panel">
            <div className="panel-title compact-title">
              <h2>Chamada final</h2>
              <span>Último bloco antes do rodapé</span>
            </div>

            <div className="editor-grid">
              <label className="full-field">
                Título da chamada final
                <textarea name="finalCtaTitle" defaultValue={content.finalCtaTitle} rows={2} required />
              </label>
              <label className="full-field">
                Descrição da chamada final
                <textarea name="finalCtaDescription" defaultValue={content.finalCtaDescription} rows={3} required />
              </label>
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
