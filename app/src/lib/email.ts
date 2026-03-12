import { Resend } from "resend";

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
  return new Resend(apiKey);
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

interface SendAuditReportParams {
  to: string;
  firstName: string;
  username: string;
  pdfBuffer: Buffer;
}

export async function sendAuditReport({ to, firstName, username, pdfBuffer }: SendAuditReportParams) {
  const html = buildEmailHTML(firstName, username);

  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: `SUNXCA <${FROM_EMAIL}>`,
    to,
    subject: `Dein Instagram Strategie-Scan — @${username}`,
    html,
    attachments: [
      {
        filename: `strategie-scan-${username}.pdf`,
        content: pdfBuffer,
      },
    ],
  });

  if (error) {
    throw new Error(`Email send failed: ${error.message}`);
  }
}

function buildEmailHTML(firstName: string, username: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF8F5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="padding:0 0 32px 0;text-align:center;">
              <span style="font-size:22px;font-weight:300;color:#202345;letter-spacing:0.5px;">Sun<span style="color:#D42E35;">x</span>ca</span>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td style="background-color:#FFFFFF;border-radius:16px;padding:40px 36px;border:1px solid rgba(32,35,69,0.05);">

              <!-- Greeting -->
              <p style="margin:0 0 8px 0;font-size:22px;font-weight:300;color:#202345;line-height:1.3;">
                Hallo ${firstName},
              </p>
              <p style="margin:0 0 28px 0;font-size:15px;font-weight:300;color:rgba(32,35,69,0.55);line-height:1.6;">
                dein persönlicher Instagram Strategie-Scan für <strong style="color:#202345;font-weight:500;">@${username}</strong> ist fertig.
              </p>

              <!-- Divider -->
              <div style="height:1px;background-color:rgba(32,35,69,0.06);margin:0 0 28px 0;"></div>

              <!-- What's inside -->
              <p style="margin:0 0 16px 0;font-size:13px;font-weight:500;color:rgba(32,35,69,0.35);letter-spacing:1.5px;text-transform:uppercase;">
                Was drin ist
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
                <tr>
                  <td style="padding:8px 0;font-size:15px;font-weight:300;color:rgba(32,35,69,0.65);line-height:1.5;">
                    <span style="color:#F2C8D2;margin-right:10px;">&#9679;</span> Profil-Überblick &amp; Performance-Analyse
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;font-size:15px;font-weight:300;color:rgba(32,35,69,0.65);line-height:1.5;">
                    <span style="color:#F2C8D2;margin-right:10px;">&#9679;</span> Stärken &amp; Verbesserungspotenzial
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;font-size:15px;font-weight:300;color:rgba(32,35,69,0.65);line-height:1.5;">
                    <span style="color:#F2C8D2;margin-right:10px;">&#9679;</span> Content-Analyse deiner Reels
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;font-size:15px;font-weight:300;color:rgba(32,35,69,0.65);line-height:1.5;">
                    <span style="color:#F2C8D2;margin-right:10px;">&#9679;</span> 3 Sofort-Maßnahmen für mehr Reichweite
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;font-size:15px;font-weight:300;color:rgba(32,35,69,0.65);line-height:1.5;">
                    <span style="color:#F2C8D2;margin-right:10px;">&#9679;</span> Wachstumsprognose (3–6 Monate)
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 28px 0;font-size:15px;font-weight:300;color:rgba(32,35,69,0.55);line-height:1.6;">
                Die vollständige Analyse findest du im angehängten PDF.
              </p>

              <!-- Divider -->
              <div style="height:1px;background-color:rgba(32,35,69,0.06);margin:0 0 28px 0;"></div>

              <!-- CTA -->
              <p style="margin:0 0 8px 0;font-size:17px;font-weight:300;color:#202345;line-height:1.4;">
                Bereit für den nächsten Schritt?
              </p>
              <p style="margin:0 0 24px 0;font-size:15px;font-weight:300;color:rgba(32,35,69,0.55);line-height:1.6;">
                Lass uns gemeinsam eine Content-Strategie bauen, die zu dir und deiner Marke passt.
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#202345;border-radius:50px;text-align:center;">
                    <a href="#" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:500;color:#FFFFFF;text-decoration:none;letter-spacing:0.3px;">
                      Kostenloses Strategiegespräch buchen
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:32px 0 0 0;text-align:center;">
              <p style="margin:0;font-size:12px;font-weight:300;color:rgba(32,35,69,0.25);">
                &copy; ${new Date().getFullYear()} SUNXCA &middot; Instagram Growth
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
