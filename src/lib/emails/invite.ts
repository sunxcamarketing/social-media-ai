import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "info@contact.sunxca.com";
const FROM_NAME = "SUNXCA";

interface SendInviteEmailOptions {
  to: string;
  verifyUrl: string;
  inviterName?: string;
}

function renderInviteHtml(verifyUrl: string, inviterName: string): string {
  const FONT_STACK = "'Geist','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
  const OCEAN = "#202345";
  const RED = "#D42E35";
  const CREAM = "#FDFBF7";
  const WARM_WHITE = "#FAF8F5";

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dein Zugang zu SUNXCA</title>
</head>
<body style="margin:0;padding:0;background:${WARM_WHITE};font-family:${FONT_STACK};font-weight:300;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${WARM_WHITE};padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;">
          <tr>
            <td align="center" style="padding:0 0 32px 0;">
              <div style="font-family:${FONT_STACK};font-size:26px;letter-spacing:3px;color:${OCEAN};font-weight:500;">SUN<span style="color:${RED};">×</span>CA</div>
            </td>
          </tr>
          <tr>
            <td style="background:${CREAM};border-radius:16px;padding:48px 40px;">
              <h1 style="margin:0 0 24px 0;font-family:${FONT_STACK};font-size:24px;color:${OCEAN};font-weight:600;letter-spacing:-0.01em;">Dein Zugang zu SUNXCA</h1>
              <p style="margin:0 0 32px 0;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:${OCEAN};font-weight:300;">
                ${inviterName} hat dich zu deinem persönlichen Content-Bereich eingeladen. Hier findest du deine Strategie, Skripte, Ideen und Audits — alles an einem Ort.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 32px auto;">
                <tr>
                  <td style="border-radius:999px;background:${OCEAN};">
                    <a href="${verifyUrl}" style="display:inline-block;padding:14px 36px;font-family:${FONT_STACK};font-size:15px;color:#ffffff;text-decoration:none;font-weight:500;letter-spacing:0.02em;">Zugang aktivieren</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-family:${FONT_STACK};font-size:13px;line-height:1.6;color:${OCEAN};opacity:0.6;font-weight:300;">
                Klick auf den Button oben, um dein Konto zu aktivieren. Der Link ist 24 Stunden gültig.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 0 0 0;font-family:${FONT_STACK};font-size:12px;color:${OCEAN};opacity:0.5;line-height:1.6;font-weight:300;letter-spacing:0.05em;">
              SUNXCA — Social Media Agentur<br>
              Wenn du diese Einladung nicht erwartest, ignorier diese Mail.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendInviteEmail({
  to,
  verifyUrl,
  inviterName = "Aysun",
}: SendInviteEmailOptions): Promise<void> {
  const { error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to,
    subject: "Dein Zugang zu SUNXCA",
    html: renderInviteHtml(verifyUrl, inviterName),
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
