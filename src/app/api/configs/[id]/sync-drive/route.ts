import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { readConfigs } from "@/lib/csv";
import { supabase } from "@/lib/supabase";
import { parseFolderIdFromUrl, fetchAllDocsFromFolder } from "@/lib/google-drive";
import { generateVoiceProfile } from "@/lib/voice-profile";

export const maxDuration = 300;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const configs = await readConfigs();
    const config = configs.find((c) => c.id === id);
    if (!config) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    const folderUrl = config.googleDriveFolder || (config as unknown as Record<string, string>).google_drive_folder;
    if (!folderUrl) {
      return NextResponse.json({ error: "No Google Drive folder configured" }, { status: 400 });
    }

    let folderId: string;
    try {
      folderId = parseFolderIdFromUrl(folderUrl);
    } catch {
      return NextResponse.json({ error: "Invalid Google Drive folder URL" }, { status: 400 });
    }

    // Fetch documents from Drive
    const docs = await fetchAllDocsFromFolder(folderId);
    if (docs.length === 0) {
      return NextResponse.json({ error: "No documents found in folder. Make sure the folder is shared with the service account." }, { status: 400 });
    }

    let imported = 0;

    for (const doc of docs) {
      const sourceId = `gdrive:${doc.fileId}`;

      try {
        // Check if a training script with this source_id already exists for this client
        const { data: existing } = await supabase
          .from("training_scripts")
          .select("id")
          .eq("client_id", id)
          .eq("source_id", sourceId)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("training_scripts")
            .update({
              script: doc.content,
              audio_hook: "",
              text_hook: "",
              visual_hook: "",
              cta: "",
              format: "Drive Import",
            })
            .eq("id", existing.id);
        } else {
          await supabase.from("training_scripts").insert({
            id: uuid(),
            client_id: id,
            format: "Drive Import",
            text_hook: "",
            visual_hook: "",
            audio_hook: "",
            script: doc.content,
            cta: "",
            source_id: sourceId,
            created_at: new Date().toISOString(),
          });
        }
        imported++;
      } catch (e) {
        console.error(`Failed to upsert training script for "${doc.name}":`, e);
      }
    }

    // Regenerate voice profile
    let voiceProfileGenerated = false;
    try {
      const profile = await generateVoiceProfile(id, config.name || config.configName || "Kunde");
      voiceProfileGenerated = !!profile;
    } catch (e) {
      console.error("Voice profile generation failed:", e);
    }

    return NextResponse.json({ imported, voiceProfileGenerated });
  } catch (e) {
    console.error("sync-drive error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 500 },
    );
  }
}
