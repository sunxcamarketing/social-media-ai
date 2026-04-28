import { Resend } from "resend";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "info@contact.sunxca.com";
const FROM_NAME = "SUNXCA";

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set");
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

interface SendInviteEmailOptions {
  to: string;
  verifyUrl: string;
  inviterName?: string;
}

function renderInviteHtml(verifyUrl: string, inviterName: string): string {
  const FONT_STACK = "'Geist','Inter','Helvetica Neue',Helvetica,Arial,sans-serif";
  const OCEAN = "#202345";
  const RED = "#D42E35";
  const WARM_WHITE = "#FAF8F5";

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dein Zugang zu SUNXCA</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
  body, table, td, p, h1, a { font-family: ${FONT_STACK}; }
</style>
</head>
<body style="margin:0;padding:0;background:${WARM_WHITE};font-family:${FONT_STACK};font-weight:300;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${WARM_WHITE};padding:48px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;">
          <tr>
            <td align="center" style="padding:0 0 40px 0;">
              <h1 style="margin:0;font-family:${FONT_STACK};font-size:24px;letter-spacing:0.3em;color:${OCEAN};font-weight:300;text-transform:uppercase;padding-left:0.3em;">Sun<span style="color:${RED};">x</span>ca</h1>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:20px;padding:80px 56px;">
              <h2 style="margin:0 0 28px 0;font-family:${FONT_STACK};font-size:22px;color:${OCEAN};font-weight:500;letter-spacing:-0.01em;line-height:1.3;">Dein Zugang zu SUNXCA</h2>
              <p style="margin:0 0 56px 0;font-family:${FONT_STACK};font-size:15px;line-height:1.7;color:${OCEAN};font-weight:300;">
                ${inviterName} hat dich zu deinem persönlichen Content-Bereich eingeladen. Hier findest du deine Strategie, Skripte, Ideen und Audits — alles an einem Ort.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 56px auto;">
                <tr>
                  <td style="border-radius:999px;background:${OCEAN};">
                    <a href="${verifyUrl}" style="display:inline-block;padding:16px 44px;font-family:${FONT_STACK};font-size:15px;color:#ffffff;text-decoration:none;font-weight:500;">Zugang aktivieren</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-family:${FONT_STACK};font-size:13px;line-height:1.7;color:${OCEAN};opacity:0.55;font-weight:300;">
                Klick auf den Button oben, um dein Konto zu aktivieren. Der Link ist 24 Stunden gültig.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:32px 0 0 0;font-family:${FONT_STACK};font-size:12px;color:${OCEAN};opacity:0.45;line-height:1.7;font-weight:300;">
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
  const { error } = await getResend().emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to,
    subject: "Dein Zugang zu SUNXCA",
    html: renderInviteHtml(verifyUrl, inviterName),
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
