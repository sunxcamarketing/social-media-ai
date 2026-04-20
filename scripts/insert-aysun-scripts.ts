import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: configs, error: cErr } = await supabase
    .from("configs")
    .select("id, name, configName, company");
  if (cErr) throw cErr;

  const match = (configs || []).find((c) => {
    const hay = `${c.name ?? ""} ${c.configName ?? ""} ${c.company ?? ""}`.toLowerCase();
    return hay.includes("aysun") || hay.includes("sunxca") || hay.includes("sun x ca");
  });
  if (!match) {
    console.error("No client matching 'aysun' found. Available configs:");
    console.table(configs);
    process.exit(1);
  }
  console.log(`Matched client: id=${match.id} name=${match.name} configName=${match.configName}`);

  const shortScript = `Ich hatte genau das, was sich alle wünschen. Berühmte Kunden, Videodrehs, Ergebnisse die funktioniert haben. Und ich stand trotzdem immer wieder kurz davor, alles hinzuschmeißen.

Zwei Jahre lang habe ich eine Social Media Agentur geführt. Alles Done-for-You. Ich hatte das System, die Strategie, war bei jedem Dreh dabei.

Das Problem war nicht die Arbeit. Das Problem war dieses eine Ding, das kein System der Welt lösen kann: Vor der Kamera stand nicht ich. Da stand der Kunde. Und wenn der Kunde nicht er selbst ist, wenn die Energie nicht stimmt, dann performt der Content nicht. Egal wie gut alles dahinter aufgebaut ist.

Immer wieder kurz vorm Aufhören. Immer wieder weitergemacht. Was dann passiert ist, erzähle ich in Teil 2.`;

  const longScript = `Ich hatte genau das, was sich alle wünschen. Berühmte Kunden, Videodrehs, Ergebnisse die wirklich funktioniert haben. Und ich stand trotzdem immer wieder kurz davor, alles hinzuschmeißen.

Zwei Jahre lang habe ich eine Social Media Agentur geführt. Alles Done-for-You. Ich habe die Strategie gebaut, die Skripte geschrieben, war bei den Drehs dabei, habe die Zahlen analysiert. Ich kannte das Handwerk. Und die Resultate haben das gezeigt.

Aber es gab dieses eine Ding, das kein System der Welt lösen kann. Ich habe lange gebraucht, bis ich es so klar benennen konnte. Vor der Kamera stand nicht ich. Da stand der Kunde. Und wenn der Kunde nicht wirklich er selbst ist, wenn man merkt dass er eine Rolle spielt statt er selbst zu sein, dann stimmt der Content nicht. Nicht ein bisschen. Egal wie gut das System dahinter war, egal wie stark die Strategie.

Authentizität kann man nicht outsourcen. Was das in der Praxis bedeutet, wenn du jeden Tag für den Content deiner Kunden verantwortlich bist und weißt: das Problem liegt nicht bei dir, und du kannst es trotzdem nicht lösen. Das zehrt aus. Kein einzelner Burnout-Moment, kein dramatischer Tag an dem alles zusammengebrochen ist. Nur dieses Muster, immer wieder, kurz vorm Aufhören. Und dann doch weitergemacht, weil ich den Job wirklich geliebt habe.

Ich war ausgebrannt von etwas das ich liebte. Das war das Widersprüchlichste an der ganzen Sache.

Was dann passiert ist und welche Entscheidung ich getroffen habe, kommt in Teil 2. Schreib in die Kommentare ob du das kennst: Liebst du deinen Job, aber irgendetwas stimmt trotzdem nicht.`;

  const body = `── KURZ (30-40 Sek) ──\n[TEXT-HOOK auf Screen]: "Traumjob. Trotzdem ausgebrannt."\n\n${shortScript}\n\n── LANG (60+ Sek) ──\n[TEXT-HOOK auf Screen]: "Traumjob. Trotzdem ausgebrannt."\n\n${longScript}`;

  const row = {
    id: randomUUID(),
    client_id: match.id,
    title: "Warum mich mein Traumjob ausgebrannt hat",
    pillar: "",
    content_type: "",
    format: "Reel",
    hook: "Ich hatte genau das, was sich alle wünschen. Berühmte Kunden, Videodrehs, Ergebnisse die funktioniert haben. Und ich stand trotzdem immer wieder kurz davor, alles hinzuschmeißen.",
    hook_pattern: "",
    text_hook: "Traumjob. Trotzdem ausgebrannt.",
    body,
    cta: "",
    status: "entwurf",
    source: "manual",
    shot_list: "",
    pattern_type: "STORY",
    post_type: "",
    anchor_ref: "",
    cta_type: "",
    funnel_stage: "",
    created_at: new Date().toISOString().split("T")[0],
  };

  const { data, error } = await supabase.from("scripts").insert(row).select().single();
  if (error) {
    console.error("Insert failed:", error);
    process.exit(1);
  }
  console.log(`Inserted script id=${data.id} title="${data.title}" for client=${match.id}`);
}

main();
