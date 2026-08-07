import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  // Dominio real da sales page. O valor anterior (sendinteligente.com.br,
  // herdado do openGraph.url) nao resolve, e com metadataBase ele passaria a
  // quebrar a URL absoluta do og:image.
  metadataBase: new URL("https://comercial.send.inteligentte.com.br"),
  title: "Send Inteligentte • Disparos no WhatsApp via API Oficial Meta Cloud v19",
  description:
    "Dispare campanhas no WhatsApp pela API Oficial da Meta. Templates homologados, opt-out automático para LGPD, links rastreáveis e integração via n8n e REST API.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "Send Inteligentte • WhatsApp Business Cloud API Oficial",
    description:
      "Plataforma de alta entregabilidade para automação e disparo de campanhas no WhatsApp pela API Oficial da Meta.",
    url: "https://comercial.send.inteligentte.com.br",
    siteName: "Send Inteligentte",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Send Inteligentte • WhatsApp Business Cloud API Oficial",
    description:
      "Disparo de campanhas no WhatsApp pela API Oficial da Meta, com métricas reais e opt-out automático.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>
        {children}
      </body>
    </html>
  );
}
