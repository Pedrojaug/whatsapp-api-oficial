import { SalesLanding } from "@/components/SalesLanding";
import { getSiteContent } from "@/lib/site-content";

// Era "force-dynamic", que forçava SSR a cada request para conteúdo que muda
// raramente. Com ISR a página é servida do cache e revalidada a cada hora.
export const revalidate = 3600;

export default async function Home() {
  const content = await getSiteContent();

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: (content.faqs ?? []).map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <SalesLanding content={content} />
    </>
  );
}
