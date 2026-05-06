// One-shot preview send. Renders the "Deine Skripte sind ready" email
// addressed to Roman but ships it to Aysun's inbox so she can confirm
// the design before we wire up the in-app trigger.
//
// Run: `node scripts/send-scripts-ready-preview.mjs`

import "dotenv/config";
import { Resend } from "resend";

const PREVIEW_TO = "roman.decker@yahoo.com";
const CLIENT_NAME = "Roman Decker";
const LOGIN_URL = "https://app.sunxca.com/portal/scripts";
const SCRIPT_COUNT = 6;

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "info@contact.sunxca.com";
const FROM_NAME = "SUNXCA";

const FONT_STACK = "'Geist','Inter','Helvetica Neue',Helvetica,Arial,sans-serif";
const OCEAN = "#202345";
const RED = "#D42E35";
const WARM_WHITE = "#FAF8F5";

const countLine = SCRIPT_COUNT > 0
  ? `<strong style="color:${OCEAN};font-weight:500;">${SCRIPT_COUNT} neue Skripte</strong> warten auf dich.`
  : `Deine neuen Skripte warten auf dich.`;

const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Deine Skripte sind ready</title>
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
              <p style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:13px;line-height:1.5;color:${OCEAN};font-weight:500;letter-spacing:0.18em;text-transform:uppercase;opacity:0.55;">
                Update für ${CLIENT_NAME}
              </p>
              <h2 style="margin:0 0 28px 0;font-family:${FONT_STACK};font-size:26px;color:${OCEAN};font-weight:500;letter-spacing:-0.01em;line-height:1.25;">Deine Skripte sind <span style="color:${RED};">ready</span>.</h2>
              <p style="margin:0 0 56px 0;font-family:${FONT_STACK};font-size:15px;line-height:1.7;color:${OCEAN};font-weight:300;">
                Hi ${CLIENT_NAME.split(" ")[0]}, ${countLine}
                Log dich kurz in deinen Bereich ein, schau sie dir an, gib Feedback wenn was nicht passt — und dann ab vor die Kamera.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 56px auto;">
                <tr>
                  <td style="border-radius:999px;background:${OCEAN};">
                    <a href="${LOGIN_URL}" style="display:inline-block;padding:16px 44px;font-family:${FONT_STACK};font-size:15px;color:#ffffff;text-decoration:none;font-weight:500;">Skripte ansehen</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-family:${FONT_STACK};font-size:13px;line-height:1.7;color:${OCEAN};opacity:0.55;font-weight:300;">
                Falls der Button nicht klappt, kopier diesen Link in den Browser:<br>
                <a href="${LOGIN_URL}" style="color:${OCEAN};opacity:0.75;word-break:break-all;">${LOGIN_URL}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:32px 0 0 0;font-family:${FONT_STACK};font-size:12px;color:${OCEAN};opacity:0.45;line-height:1.7;font-weight:300;">
              SUNXCA — Social Media Agentur<br>
              Du bekommst diese Mail, weil dein Manager neue Skripte für dich freigegeben hat.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.error("RESEND_API_KEY not set");
  process.exit(1);
}

const resend = new Resend(apiKey);
const { data, error } = await resend.emails.send({
  from: `${FROM_NAME} <${FROM_EMAIL}>`,
  to: PREVIEW_TO,
  subject: "Deine Skripte sind ready",
  html,
});

if (error) {
  console.error("Send failed:", error);
  process.exit(1);
}
console.log(`Preview sent to ${PREVIEW_TO}. Resend id: ${data?.id || "(unknown)"}`);
