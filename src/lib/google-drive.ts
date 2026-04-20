// ── Google Drive Integration ─────────────────────────────────────────────────
// Reads Google Docs, Sheets, and text files from a shared Drive folder.
// Recursively searches subfolders (e.g. "Woche 1", "Woche 2", ...).

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

interface DriveFile {
  fileId: string;
  name: string;
  mimeType: string;
  folderPath: string; // e.g. "Woche 1" for context
}

const SUPPORTED_MIME_TYPES = [
  "application/vnd.google-apps.document",      // Google Docs
  "application/vnd.google-apps.spreadsheet",   // Google Sheets
  "text/plain",                                 // .txt files
];

const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

/**
 * Recursively list all supported files in a folder and its subfolders.
 * Max depth of 3 to prevent infinite loops.
 */
async function listFilesRecursive(
  drive: ReturnType<typeof google.drive>,
  folderId: string,
  folderPath: string,
  depth: number = 0,
): Promise<DriveFile[]> {
  if (depth > 3) return [];

  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType)",
    pageSize: 200,
  });

  const files: DriveFile[] = [];
  const subfolders: { id: string; name: string }[] = [];

  for (const f of res.data.files || []) {
    if (f.mimeType === FOLDER_MIME_TYPE) {
      subfolders.push({ id: f.id!, name: f.name! });
    } else if (SUPPORTED_MIME_TYPES.includes(f.mimeType!)) {
      files.push({
        fileId: f.id!,
        name: f.name!,
        mimeType: f.mimeType!,
        folderPath,
      });
    }
  }

  // Recurse into subfolders
  for (const sub of subfolders) {
    const subPath = folderPath ? `${folderPath}/${sub.name}` : sub.name;
    const subFiles = await listFilesRecursive(drive, sub.id, subPath, depth + 1);
    files.push(...subFiles);
  }

  return files;
}

/**
 * Get the plain-text content of a file.
 * Google Docs → export as plain text
 * Google Sheets → export as CSV (tab-separated for readability)
 * .txt → download directly
 */
export async function getDocContent(fileId: string, mimeType: string): Promise<string> {
  const drive = getGoogleDriveClient();

  if (mimeType === "application/vnd.google-apps.document") {
    const res = await drive.files.export({ fileId, mimeType: "text/plain" }, { responseType: "text" });
    return (res.data as string) || "";
  }

  if (mimeType === "application/vnd.google-apps.spreadsheet") {
    // Export as TSV (tab-separated) — more readable than CSV for script content
    const res = await drive.files.export(
      { fileId, mimeType: "text/tab-separated-values" },
      { responseType: "text" },
    );
    return (res.data as string) || "";
  }

  // Plain text file
  const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "text" });
  return (res.data as string) || "";
}

/**
 * Fetch all documents from a folder (recursively) with their content.
 * Searches subfolders like "Woche 1", "Woche 2", etc.
 * Content per file is capped at 8000 characters.
 */
export async function fetchAllDocsFromFolder(folderId: string): Promise<{ fileId: string; name: string; folderPath: string; content: string }[]> {
  const drive = getGoogleDriveClient();
  const files = await listFilesRecursive(drive, folderId, "", 0);
  const results: { fileId: string; name: string; folderPath: string; content: string }[] = [];

  for (const file of files) {
    try {
      const content = await getDocContent(file.fileId, file.mimeType);
      if (content.trim()) {
        results.push({
          fileId: file.fileId,
          name: file.folderPath ? `${file.folderPath}/${file.name}` : file.name,
          folderPath: file.folderPath,
          content: content.slice(0, 8000),
        });
      }
    } catch (e) {
      console.error(`Failed to read Drive file "${file.name}" in "${file.folderPath}":`, e);
    }
  }

  return results;
}
