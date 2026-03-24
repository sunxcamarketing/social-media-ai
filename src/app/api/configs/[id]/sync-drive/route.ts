import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { readConfigs } from "@/lib/csv";
import { supabase } from "@/lib/supabase";
import { parseFolderIdFromUrl, fetchAllDocsFromFolder } from "@/lib/google-drive";
import { generateVoiceProfile, generateScriptStructure } from "@/lib/voice-profile";

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

    // Regenerate both profiles in parallel
    const clientName = config.name || config.configName || "Kunde";
    let voiceProfileGenerated = false;
    let scriptStructureGenerated = false;

    const [voiceResult, structureResult] = await Promise.allSettled([
      generateVoiceProfile(id, clientName),
      generateScriptStructure(id, clientName),
    ]);

    if (voiceResult.status === "fulfilled" && voiceResult.value) {
      voiceProfileGenerated = true;
    } else if (voiceResult.status === "rejected") {
      console.error("Voice profile generation failed:", voiceResult.reason);
    }

    if (structureResult.status === "fulfilled" && structureResult.value) {
      scriptStructureGenerated = true;
    } else if (structureResult.status === "rejected") {
      console.error("Script structure generation failed:", structureResult.reason);
    }

    return NextResponse.json({ imported, voiceProfileGenerated, scriptStructureGenerated });
  } catch (e) {
    console.error("sync-drive error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 500 },
    );
  }
}
