// One-shot final send: ships the carousel tutorial to Anna + Roman.
// Re-uses the exact rendering of the preview script — only the recipient
// list and subject (no [Preview] tag) differ.

import "dotenv/config";
import { Resend } from "resend";

const RECIPIENTS = [
  { email: "annaherbst.business@gmail.com", clientName: "Anna Herbst" },
  { email: "roman.decker@yahoo.com", clientName: "Roman Decker" },
];

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "info@contact.sunxca.com";
const FROM_NAME = "SUNXCA";
const FONT_STACK = "'Geist','Inter','Helvetica Neue',Helvetica,Arial,sans-serif";
const OCEAN = "#202345";
const RED = "#D42E35";
const WARM_WHITE = "#FAF8F5";
const BLUSH = "#F2C8D2";
const BLUSH_LIGHT = "#f9e4e9";

const SHOT = "https://jtkcitvfopwgvjjkzwub.supabase.co/storage/v1/object/public/images/tutorial/carousel";
const LOGIN_URL = "https://app.sunxca.com/portal/karussell";

const STEPS = [
  { title: "Login & Karussell-Tab öffnen", body: 'Logge dich in deinen Bereich ein. In der Sidebar links findest du jetzt einen neuen Eintrag „Karussell". Click drauf.', screenshotUrl: `${SHOT}/step-1-sidebar.png` },
  { title: "Thema eingeben", body: 'Im Eingabefeld unten: schreib in 1-2 Sätzen, was der Carousel vermitteln soll. Beispiel: „Warum 90% aller Content-Creator nach 6 Monaten aufhören — und wie AI das verhindert."', screenshotUrl: `${SHOT}/step-2-thema.png` },
  { title: "Optional: bestehendes Skript als Quelle", body: 'Click „Aus Skript / Idee" → wähl ein vorhandenes Skript oder eine Idee aus deiner Liste. Der Inhalt wird als Brief vorbefüllt — du sparst dir das Tippen.', screenshotUrl: `${SHOT}/step-3-picker.png` },
  { title: "Style Guide wählen", body: "Aus dem Dropdown oben den Style Guide auswählen — das fixiert Schriften, Farben und Layout-Look. Einmal aussuchen, alle deine Karussells sehen dann gleich aus.", screenshotUrl: `${SHOT}/step-4-styleguide.png` },
  { title: "Karussell starten", body: 'Click „Karussell starten". Dauert 30-60 Sekunden, du siehst live wie der Code entsteht und auf der rechten Seite die Slides erscheinen.', screenshotUrl: `${SHOT}/step-5-starten.png` },
  { title: "Im Chat anpassen", body: 'Du kannst unten im Chat schreiben was geändert werden soll: „Slide 2 kürzer", „mein Handle als Footer in alle Slides", oder zieh einfach ein Foto rein — dann wird es eingebaut.', screenshotUrl: `${SHOT}/step-6-chat.png` },
  { title: "Als PNG exportieren", body: 'Oben rechts „Alle als PNG" klicken → du bekommst eine Datei pro Slide. Direkt zu Instagram hochladen, fertig.', screenshotUrl: `${SHOT}/step-7-export.png` },
];

function renderStep(idx, step) {
  const visual = step.screenshotUrl
    ? `<tr><td colspan="2" style="padding:18px 0 0 0;"><img src="${step.screenshotUrl}" alt="Schritt ${idx + 1}" width="544" style="display:block;width:100%;max-width:100%;height:auto;border-radius:12px;border:1px solid ${OCEAN}10;" /></td></tr>`
    : `<tr><td colspan="2" style="padding:18px 0 0 0;"><div style="background:${BLUSH_LIGHT};border:1px dashed ${BLUSH};border-radius:12px;padding:32px 16px;text-align:center;font-size:11px;color:${OCEAN}80;letter-spacing:0.1em;text-transform:uppercase;">[ Screenshot zu Schritt ${idx + 1} ]</div></td></tr>`;
  return `<tr><td style="padding:32px 0 8px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="vertical-align:top;width:48px;padding-right:16px;">
          <div style="width:36px;height:36px;border-radius:50%;background:${OCEAN};color:#ffffff;text-align:center;line-height:36px;font-family:${FONT_STACK};font-size:14px;font-weight:600;">${idx + 1}</div>
        </td>
        <td style="vertical-align:top;">
          <h3 style="margin:0 0 8px 0;font-family:${FONT_STACK};font-size:17px;color:${OCEAN};font-weight:500;letter-spacing:-0.005em;line-height:1.35;">${step.title}</h3>
          <p style="margin:0;font-family:${FONT_STACK};font-size:14px;line-height:1.65;color:${OCEAN};opacity:0.75;font-weight:300;">${step.body}</p>
        </td>
      </tr>
      ${visual}
    </table>
  </td></tr>`;
}

function html(clientName) {
  const stepsHtml = STEPS.map((s, i) => renderStep(i, s)).join("\n");
  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Neu: Karussells selber bauen</title>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${WARM_WHITE};font-family:${FONT_STACK};font-weight:300;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${WARM_WHITE};padding:48px 20px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="max-width:640px;">
        <tr><td align="center" style="padding:0 0 36px 0;">
          <h1 style="margin:0;font-family:${FONT_STACK};font-size:24px;letter-spacing:0.3em;color:${OCEAN};font-weight:300;text-transform:uppercase;padding-left:0.3em;">Sun<span style="color:${RED};">x</span>ca</h1>
        </td></tr>
        <tr><td style="background:#ffffff;border-radius:20px;padding:56px 48px;">
          <p style="margin:0 0 12px 0;font-size:13px;line-height:1.5;color:${OCEAN};font-weight:500;letter-spacing:0.18em;text-transform:uppercase;opacity:0.55;">Neues Tool für ${clientName}</p>
          <h2 style="margin:0 0 20px 0;font-size:28px;color:${OCEAN};font-weight:500;letter-spacing:-0.01em;line-height:1.2;">Bau dir deine Karussells <span style="color:${RED};">jetzt selber</span>.</h2>
          <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:${OCEAN};font-weight:300;">Hi ${clientName.split(" ")[0]}, dein Bereich hat einen neuen Tab — <strong style="font-weight:500;">Karussell</strong>. Damit kannst du fertige Instagram-Karussells in unserem Look generieren, im Chat anpassen und als PNGs runterladen. <strong style="font-weight:500;">10 pro Monat</strong> sind in deinem Paket drin.</p>
          <p style="margin:0 0 32px 0;font-size:15px;line-height:1.7;color:${OCEAN};font-weight:300;">Hier die Schritt-für-Schritt-Anleitung:</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid ${OCEAN}15;">${stepsHtml}</table>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:48px auto 12px auto;">
            <tr><td style="border-radius:999px;background:${OCEAN};">
              <a href="${LOGIN_URL}" style="display:inline-block;padding:16px 44px;font-size:15px;color:#ffffff;text-decoration:none;font-weight:500;">Jetzt loslegen</a>
            </td></tr>
          </table>
          <p style="margin:0;text-align:center;font-size:12px;line-height:1.6;color:${OCEAN};opacity:0.5;font-weight:300;">${LOGIN_URL}</p>
          <div style="margin-top:48px;padding:20px 24px;background:${WARM_WHITE};border-radius:12px;">
            <p style="margin:0 0 10px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${OCEAN};font-weight:600;opacity:0.55;">Drei Tipps</p>
            <ul style="margin:0;padding:0 0 0 18px;font-size:14px;line-height:1.75;color:${OCEAN};font-weight:300;">
              <li>Den Quota-Counter siehst du oben rechts — sobald du nahe an 10 bist, melde ich mich für die nächste Stufe.</li>
              <li>Wenn ein Karussell mal nicht rendert, click „Auto-Reparieren" — das fixt 95% der Fälle ohne dass du was tun musst.</li>
              <li>Foto rein? Einfach ins Chat-Feld ziehen oder über das Büroklammer-Icon hochladen — wird in das richtige Slide eingebaut.</li>
            </ul>
          </div>
        </td></tr>
        <tr><td align="center" style="padding:32px 0 0 0;font-size:12px;color:${OCEAN};opacity:0.45;line-height:1.7;font-weight:300;">
          SUNXCA — Social Media Agentur<br>Fragen? Antworte einfach auf diese Mail.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) { console.error("RESEND_API_KEY not set"); process.exit(1); }
const resend = new Resend(apiKey);

for (const r of RECIPIENTS) {
  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: r.email,
    subject: "Neu: Karussells selber bauen",
    html: html(r.clientName),
  });
  if (error) {
    console.error(`Send to ${r.email} failed:`, error);
  } else {
    console.log(`Sent to ${r.email} → ${data?.id || "(unknown)"}`);
  }
}
