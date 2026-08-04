import type { Metadata, Viewport } from "next";
import "../styles.css";

const title = "Send Inteligente | Disparos no WhatsApp pela API Oficial da Meta";
const description =
  "Plataforma de disparo em massa no WhatsApp pela API Oficial da Meta: listas segmentadas, templates aprovados, campanhas recorrentes, opt-out automático e métricas de entrega em tempo real.";

export const metadata: Metadata = {
  title,
  description,
  applicationName: "Send Inteligente",
  keywords: [
    "disparo em massa WhatsApp",
    "API Oficial WhatsApp",
    "WhatsApp Business API",
    "campanhas WhatsApp",
    "automação WhatsApp",
  ],
  openGraph: {
    title,
    description,
    type: "website",
    locale: "pt_BR",
    siteName: "Send Inteligente",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#050607",
  colorScheme: "dark",
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
