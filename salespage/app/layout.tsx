import type { Metadata } from "next";
import "@/styles.css";

export const metadata: Metadata = {
  title: "Send Inteligentte • Disparos no WhatsApp via API Oficial Meta Cloud v19",
  description:
    "Dispare campanhas no WhatsApp com 0% de risco de banimento de chip. Integração nativa com Meta Cloud API v19, encurtador de links rastreável e n8n.",
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
      "Plataforma de alta entregabilidade para automação e disparo de mensagens no WhatsApp sem risco de banimento.",
    url: "https://sendinteligente.com.br",
    siteName: "Send Inteligentte",
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
