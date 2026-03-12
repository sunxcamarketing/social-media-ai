import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Font } from "@react-pdf/renderer";

// ── Colors ──
const ocean = "#202345";
const blush = "#F2C8D2";
const warmWhite = "#FAF8F5";
const oceanLight = "rgba(32,35,69,0.55)";
const oceanFaint = "rgba(32,35,69,0.35)";

// ── Styles ──
const s = StyleSheet.create({
  page: { paddingVertical: 50, paddingHorizontal: 50, backgroundColor: "#FFFFFF", fontFamily: "Helvetica" },
  // Cover
  coverPage: { paddingVertical: 50, paddingHorizontal: 50, backgroundColor: warmWhite, fontFamily: "Helvetica", justifyContent: "center", alignItems: "center" },
  coverBrand: { fontSize: 28, fontWeight: 300, color: ocean, letterSpacing: 1, marginBottom: 60 },
  coverTitle: { fontSize: 32, fontWeight: 300, color: ocean, marginBottom: 12, textAlign: "center" },
  coverUsername: { fontSize: 18, color: oceanLight, marginBottom: 8, textAlign: "center" },
  coverDate: { fontSize: 12, color: oceanFaint, textAlign: "center" },
  coverLine: { width: 60, height: 2, backgroundColor: blush, marginVertical: 30 },
  // Stats bar
  statsRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 30, paddingVertical: 16, paddingHorizontal: 12, backgroundColor: warmWhite, borderRadius: 8 },
  statBox: { alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: 700, color: ocean, fontFamily: "Helvetica-Bold" },
  statLabel: { fontSize: 9, color: oceanFaint, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.5 },
  // Content
  sectionTitle: { fontSize: 16, fontWeight: 700, color: ocean, fontFamily: "Helvetica-Bold", marginTop: 24, marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1.5, borderBottomColor: blush },
  paragraph: { fontSize: 10.5, color: ocean, lineHeight: 1.65, marginBottom: 8, fontWeight: 300 },
  bulletRow: { flexDirection: "row", marginBottom: 6, paddingLeft: 4 },
  bulletDot: { fontSize: 10.5, color: blush, marginRight: 8, marginTop: 1 },
  bulletText: { fontSize: 10.5, color: ocean, lineHeight: 1.65, flex: 1, fontWeight: 300 },
  numberedNum: { fontSize: 10.5, color: blush, marginRight: 8, marginTop: 1, fontFamily: "Helvetica-Bold", width: 16 },
  // CTA page
  ctaPage: { paddingVertical: 50, paddingHorizontal: 50, backgroundColor: ocean, fontFamily: "Helvetica", justifyContent: "center", alignItems: "center" },
  ctaTitle: { fontSize: 26, fontWeight: 300, color: "#FFFFFF", marginBottom: 16, textAlign: "center" },
  ctaText: { fontSize: 13, color: "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 1.6, marginBottom: 30, maxWidth: 380 },
  ctaButton: { backgroundColor: "#FFFFFF", borderRadius: 50, paddingVertical: 14, paddingHorizontal: 36 },
  ctaButtonText: { fontSize: 12, fontWeight: 700, color: ocean, fontFamily: "Helvetica-Bold", letterSpacing: 0.3 },
  ctaFooter: { marginTop: 50, fontSize: 10, color: "rgba(255,255,255,0.25)" },
  // Footer
  pageFooter: { position: "absolute", bottom: 30, left: 50, right: 50, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 8, color: oceanFaint },
});

// ── Parse markdown into renderable blocks ──
interface Block {
  type: "heading" | "paragraph" | "bullet" | "numbered" | "empty";
  text: string;
  num?: string;
}

function parseMarkdown(markdown: string): Block[] {
  const lines = markdown.split("\n");
  const blocks: Block[] = [];

  for (const line of lines) {
    if (line.startsWith("## ") || line.startsWith("### ")) {
      blocks.push({ type: "heading", text: line.replace(/^#{2,3}\s+/, "") });
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      blocks.push({ type: "bullet", text: line.slice(2) });
    } else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1] || "";
      blocks.push({ type: "numbered", text: line.replace(/^\d+\.\s*/, ""), num });
    } else if (line.trim() === "") {
      blocks.push({ type: "empty", text: "" });
    } else {
      blocks.push({ type: "paragraph", text: line });
    }
  }

  return blocks;
}

function stripBold(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, "$1");
}

// ── PDF Document Component ──
interface AuditPDFProps {
  report: string;
  profile: {
    username: string;
    followers: number;
    reelsCount30d: number;
    avgViews30d: number;
  };
}

function AuditPDF({ report, profile }: AuditPDFProps) {
  const blocks = parseMarkdown(report);
  const today = new Date().toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });

  return React.createElement(
    Document,
    null,
    // Cover page
    React.createElement(
      Page,
      { size: "A4", style: s.coverPage },
      React.createElement(Text, { style: s.coverBrand }, "SUNXCA"),
      React.createElement(View, { style: s.coverLine }),
      React.createElement(Text, { style: s.coverTitle }, "Instagram Strategie-Scan"),
      React.createElement(Text, { style: s.coverUsername }, `@${profile.username}`),
      React.createElement(Text, { style: s.coverDate }, today)
    ),
    // Report pages
    React.createElement(
      Page,
      { size: "A4", style: s.page, wrap: true },
      // Stats bar
      React.createElement(
        View,
        { style: s.statsRow },
        React.createElement(
          View,
          { style: s.statBox },
          React.createElement(Text, { style: s.statValue }, profile.followers?.toLocaleString() || "—"),
          React.createElement(Text, { style: s.statLabel }, "Follower")
        ),
        React.createElement(
          View,
          { style: s.statBox },
          React.createElement(Text, { style: s.statValue }, String(profile.reelsCount30d)),
          React.createElement(Text, { style: s.statLabel }, "Reels (30 Tage)")
        ),
        React.createElement(
          View,
          { style: s.statBox },
          React.createElement(Text, { style: s.statValue }, profile.avgViews30d?.toLocaleString() || "—"),
          React.createElement(Text, { style: s.statLabel }, "Ø Views")
        )
      ),
      // Report content
      ...blocks.map((block, i) => {
        switch (block.type) {
          case "heading":
            return React.createElement(Text, { key: i, style: s.sectionTitle }, stripBold(block.text));
          case "bullet":
            return React.createElement(
              View,
              { key: i, style: s.bulletRow },
              React.createElement(Text, { style: s.bulletDot }, "●"),
              React.createElement(Text, { style: s.bulletText }, stripBold(block.text))
            );
          case "numbered":
            return React.createElement(
              View,
              { key: i, style: s.bulletRow },
              React.createElement(Text, { style: s.numberedNum }, `${block.num}.`),
              React.createElement(Text, { style: s.bulletText }, stripBold(block.text))
            );
          case "empty":
            return React.createElement(View, { key: i, style: { height: 6 } });
          default:
            return React.createElement(Text, { key: i, style: s.paragraph }, stripBold(block.text));
        }
      }),
      // Page footer
      React.createElement(
        View,
        { style: s.pageFooter, fixed: true },
        React.createElement(Text, { style: s.footerText }, "SUNXCA — Instagram Strategie-Scan"),
        React.createElement(Text, { style: s.footerText }, `@${profile.username}`)
      )
    ),
    // CTA page
    React.createElement(
      Page,
      { size: "A4", style: s.ctaPage },
      React.createElement(Text, { style: s.ctaTitle }, "Bereit für den\nnächsten Schritt?"),
      React.createElement(
        Text,
        { style: s.ctaText },
        "Lass uns gemeinsam eine Content-Strategie bauen, die zu dir und deiner Marke passt."
      ),
      React.createElement(
        View,
        { style: s.ctaButton },
        React.createElement(Text, { style: s.ctaButtonText }, "Strategiegespräch buchen")
      ),
      React.createElement(Text, { style: s.ctaFooter }, `© ${new Date().getFullYear()} SUNXCA`)
    )
  );
}

// ── Export: Generate PDF Buffer ──
export async function generateAuditPDF(
  report: string,
  profile: { username: string; followers: number; reelsCount30d: number; avgViews30d: number }
): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = React.createElement(AuditPDF, { report, profile }) as any;
  const buffer = await renderToBuffer(doc);
  return Buffer.from(buffer);
}
