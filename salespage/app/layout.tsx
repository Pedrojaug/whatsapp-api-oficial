import type { Metadata } from "next";
import "../styles.css";

export const metadata: Metadata = {
  title: "Send Inteligente | Disparos pela API Oficial da Meta",
  description:
    "Plataforma para disparos no WhatsApp pela API Oficial da Meta, com checkout Asaas e boas-vindas automatizadas.",
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
