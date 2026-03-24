// ── Google Drive Integration ─────────────────────────────────────────────────
// Reads Google Docs and text files from a shared Drive folder using a Service Account.

import { google } from "googleapis";

/**
 * Create an authenticated Google Drive client using a service account.
 * Expects GOOGLE_SERVICE_ACCOUNT_KEY as a base64-encoded JSON key.
 */
export function getGoogleDriveClient() {
  const keyBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyBase64) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not set");

  const keyJson = JSON.parse(Buffer.from(keyBase64, "base64").toString("utf-8"));
  const auth = new google.auth.GoogleAuth({
    credentials: keyJson,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  return google.drive({ version: "v3", auth });
}

/**
 * Extract a folder ID from various Google Drive URL formats.
 * Supports: https://drive.google.com/drive/folders/<id>?...
 *           https://drive.google.com/drive/u/0/folders/<id>
 *           or just the raw folder ID.
 */
export function parseFolderIdFromUrl(url: string): string {
  const trimmed = url.trim();

  // Direct folder ID (no slashes)
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;

  // URL format
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];

  throw new Error(`Could not parse folder ID from: ${trimmed}`);
}

interface DriveDoc {
  fileId: string;
  name: string;
  mimeType: string;
}

/**
 * List Google Docs and .txt files in a folder.
 */
export async function listDocsInFolder(folderId: string): Promise<DriveDoc[]> {
  const drive = getGoogleDriveClient();

  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false and (mimeType = 'application/vnd.google-apps.document' or mimeType = 'text/plain')`,
    fields: "files(id, name, mimeType)",
    pageSize: 100,
  });

  return (res.data.files || []).map((f) => ({
    fileId: f.id!,
    name: f.name!,
    mimeType: f.mimeType!,
  }));
}

/**
 * Get the plain-text content of a file.
 * Google Docs are exported as plain text; .txt files are downloaded directly.
 */
export async function getDocContent(fileId: string, mimeType: string): Promise<string> {
  const drive = getGoogleDriveClient();

  if (mimeType === "application/vnd.google-apps.document") {
    const res = await drive.files.export({ fileId, mimeType: "text/plain" }, { responseType: "text" });
    return (res.data as string) || "";
  }

  // Plain text file
  const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "text" });
  return (res.data as string) || "";
}

/**
 * Fetch all documents from a folder with their content.
 * Content per file is capped at 5000 characters.
 */
export async function fetchAllDocsFromFolder(folderId: string): Promise<{ fileId: string; name: string; content: string }[]> {
  const docs = await listDocsInFolder(folderId);
  const results: { fileId: string; name: string; content: string }[] = [];

  for (const doc of docs) {
    try {
      const content = await getDocContent(doc.fileId, doc.mimeType);
      results.push({
        fileId: doc.fileId,
        name: doc.name,
        content: content.slice(0, 5000),
      });
    } catch (e) {
      console.error(`Failed to read Drive doc "${doc.name}":`, e);
    }
  }

  return results;
}
