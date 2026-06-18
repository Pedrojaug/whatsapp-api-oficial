import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM = process.env.RESEND_FROM || "onboarding@resend.dev";

// Use the first FRONTEND_URL value for email links
const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")[0]
  .trim()
  .replace(/\/$/, "");

export async function sendVerificationEmail(to: string, name: string, token: string) {
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY não configurado — e-mail de verificação não enviado.");
    return;
  }
  const url = `${FRONTEND_URL}/verify-email?token=${token}`;
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Confirme seu e-mail — Send Inteligentte",
    html: emailTemplate({
      title: "Confirme seu e-mail",
      body: `Olá${name ? `, ${name}` : ""}! Clique no botão abaixo para confirmar seu endereço de e-mail e ativar sua conta no Send Inteligentte.`,
      buttonText: "Confirmar e-mail",
      buttonUrl: url,
      footer: "Este link expira em 24 horas. Se você não criou uma conta, ignore este e-mail.",
    }),
  });
}

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY não configurado — e-mail de redefinição não enviado.");
    return;
  }
  const url = `${FRONTEND_URL}/reset-password?token=${token}`;
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Redefinição de senha — Send Inteligentte",
    html: emailTemplate({
      title: "Redefina sua senha",
      body: `Olá${name ? `, ${name}` : ""}! Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha.`,
      buttonText: "Redefinir senha",
      buttonUrl: url,
      footer: "Este link expira em 1 hora. Se você não solicitou a redefinição, ignore este e-mail — sua senha permanece a mesma.",
    }),
  });
}

function emailTemplate({ title, body, buttonText, buttonUrl, footer }: {
  title: string;
  body: string;
  buttonText: string;
  buttonUrl: string;
  footer: string;
}) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#111;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
        <tr>
          <td style="padding:32px 36px 0;text-align:center;">
            <span style="font-size:1.6rem;font-weight:800;color:#e8eaed;">Send</span>
            <span style="font-size:1.6rem;font-weight:800;background:linear-gradient(135deg,#00c26b,#00e5a0);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Inteligentte</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 36px 8px;">
            <h1 style="margin:0 0 12px;color:#e8eaed;font-size:1.3rem;font-weight:700;">${title}</h1>
            <p style="margin:0 0 28px;color:rgba(255,255,255,0.55);font-size:0.9rem;line-height:1.6;">${body}</p>
            <a href="${buttonUrl}" style="display:inline-block;padding:13px 28px;background:linear-gradient(135deg,#00c26b,#00a85c);color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:0.92rem;">${buttonText}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 36px 32px;">
            <p style="margin:0;color:rgba(255,255,255,0.25);font-size:0.78rem;line-height:1.5;">${footer}</p>
            <p style="margin:16px 0 0;color:rgba(255,255,255,0.15);font-size:0.75rem;">Ou copie e cole este link: <span style="color:rgba(0,194,107,0.7);">${buttonUrl}</span></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
