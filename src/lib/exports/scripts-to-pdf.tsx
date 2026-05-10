// ── Script Export → PDF ────────────────────────────────────────────────────
// Renders selected scripts as a single PDF using @react-pdf/renderer.
// Format mirrors the Google Doc template: top legend (Editing Direction
// blue / Filming Direction magenta), then one page per script with
// Format / Text Hook / Visual Hook / Audio Hook / Skript / CTA / Caption.

import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import type { Script } from "@/lib/types";

const COLOR_FILMING = "#d81b60"; // magenta
const COLOR_EDITING = "#1565c0"; // blue
const COLOR_TEXT = "#1a1a1a";
const COLOR_MUTED = "#666666";

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 56,
    fontSize: 11,
    fontFamily: "Helvetica",
    lineHeight: 1.45,
    color: COLOR_TEXT,
  },
  legend: {
    marginBottom: 6,
    fontSize: 10,
  },
  legendEditing: {
    color: COLOR_EDITING,
    fontFamily: "Helvetica-Bold",
  },
  legendFilming: {
    color: COLOR_FILMING,
    fontFamily: "Helvetica-Bold",
  },
  meta: {
    fontSize: 9,
    color: COLOR_MUTED,
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    marginBottom: 16,
    color: COLOR_TEXT,
  },
  fieldRow: {
    marginBottom: 8,
  },
  label: {
    fontFamily: "Helvetica-Bold",
    color: COLOR_TEXT,
  },
  bodyParagraph: {
    marginBottom: 6,
  },
  ctaBlock: {
    marginTop: 6,
    marginBottom: 12,
  },
  spacer: { height: 8 },
  caption: {
    marginTop: 14,
  },
  captionLabel: {
    color: COLOR_TEXT,
    marginBottom: 4,
  },
});

// Each <Text> needs a string — split paragraphs by blank lines so layout breaks
// naturally when long bodies overflow a page.
function paragraphs(s: string): string[] {
  return s
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

interface FieldRowProps {
  label: string;
  value: string;
  valueColor?: string;
}

function FieldRow({ label, value, valueColor }: FieldRowProps) {
  if (!value || !value.trim()) return null;
  return (
    <View style={styles.fieldRow}>
      <Text>
        <Text style={styles.label}>{label}: </Text>
        <Text style={valueColor ? { color: valueColor } : undefined}>{value}</Text>
      </Text>
    </View>
  );
}

function MultilineFieldRow({ label, value }: { label: string; value: string }) {
  if (!value || !value.trim()) return null;
  const parts = paragraphs(value);
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.label}>{label}:</Text>
      {parts.map((p, i) => (
        <Text key={i} style={styles.bodyParagraph}>{p}</Text>
      ))}
    </View>
  );
}

interface ScriptPageProps {
  script: Script;
  index: number;
  isFirst: boolean;
  legendMeta: { clientName: string; count: number; date: string };
}

function ScriptPage({ script, index, isFirst, legendMeta }: ScriptPageProps) {
  const headline = script.title?.trim() ? script.title.trim() : `Skript ${index}`;
  return (
    <Page size="A4" style={styles.page}>
      {/* Legend only on the first page so editor/filmer see the colour key
          once. Subsequent pages keep the colours but skip the header. */}
      {isFirst && (
        <>
          <View style={styles.legend}>
            <Text style={styles.legendEditing}>Editing Direction</Text>
            <Text style={styles.legendFilming}>Filming Direction</Text>
          </View>
          <Text style={styles.meta}>
            {legendMeta.clientName} · {legendMeta.count}{" "}
            {legendMeta.count === 1 ? "Skript" : "Skripte"} · Export {legendMeta.date}
          </Text>
        </>
      )}

      <Text style={styles.title}>{headline}</Text>

      <FieldRow label="Format" value={script.format || ""} valueColor={COLOR_FILMING} />
      <FieldRow label="Text Hook" value={script.textHook || ""} valueColor={COLOR_EDITING} />
      <FieldRow label="Visual Hook" value={script.visualHook || ""} valueColor={COLOR_FILMING} />
      <FieldRow label="Audio Hook" value={script.hook || ""} />
      <MultilineFieldRow label="Skript" value={script.body || ""} />
      <FieldRow label="CTA" value={script.cta || ""} />

      {script.caption && script.caption.trim() && (
        <View style={styles.caption}>
          <Text style={styles.captionLabel}>Videobeschreibung:</Text>
          {paragraphs(script.caption).map((p, i) => (
            <Text key={i} style={styles.bodyParagraph}>{p}</Text>
          ))}
        </View>
      )}
    </Page>
  );
}

export interface ScriptExportPdfOptions {
  clientName: string;
  scripts: Script[];
}

/**
 * Render the export to a PDF buffer ready to be uploaded or streamed.
 */
export async function renderScriptsToPdf({
  clientName,
  scripts,
}: ScriptExportPdfOptions): Promise<Buffer> {
  const date = new Date().toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const legendMeta = { clientName, count: scripts.length, date };

  const doc = (
    <Document title={`Skripte — ${clientName}`} author="sunxca">
      {scripts.map((s, i) => (
        <ScriptPage
          key={s.id}
          script={s}
          index={i + 1}
          isFirst={i === 0}
          legendMeta={legendMeta}
        />
      ))}
    </Document>
  );

  // pdf().toBuffer() actually returns a Node ReadableStream, not a Buffer.
  // We collect chunks into a single Buffer for the storage upload step.
  const stream = await pdf(doc).toBuffer();
  const chunks: Buffer[] = [];
  for await (const chunk of stream as unknown as AsyncIterable<Buffer | Uint8Array>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export function buildExportPdfFilename(clientName: string, count: number): string {
  const today = new Date().toISOString().slice(0, 10);
  const safe = clientName.replace(/[^a-zA-Z0-9äöüÄÖÜß\- ]/g, "").trim().replace(/\s+/g, "_");
  return `${safe}_${count}_Skripte_${today}.pdf`;
}
