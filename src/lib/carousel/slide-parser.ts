// Surgical slide parser for Carousel TSX.
//
// Splits the existing TSX into a list of slide blocks plus their start/end
// offsets in the original string. We keep offsets so we can do byte-exact
// splicing — replacing one slide leaves all surrounding text (helpers,
// constants, separators, whitespace, comments) absolutely untouched.

export interface SlideBlock {
  /** 0-based index in slide order. */
  index: number;
  /** Inclusive start offset in the source TSX (points at the leading "<"). */
  start: number;
  /** Exclusive end offset (one past the closing ">"). */
  end: number;
  /** The full `<section ...>...</section>` substring. */
  source: string;
}

/**
 * Walks the TSX string, locates every top-level `<section className="…slide…">`
 * block, and tracks nested `<section>`/`</section>` to find each slide's true
 * close tag. Returns blocks in source order, exact byte offsets included.
 *
 * Robustness notes:
 * - Allows single, double, or backtick quotes around className.
 * - Tolerates additional class names alongside "slide" (e.g. "slide grid-pattern").
 * - Handles `<section>` nested INSIDE a slide by counting depth.
 * - Bails gracefully if a slide has no closing tag — caller can detect via
 *   `end === source.length` and decide what to do.
 */
export function findSlideBlocks(tsx: string): SlideBlock[] {
  const blocks: SlideBlock[] = [];

  // Match every <section …> tag. We then test if its className contains
  // "slide" as a whole word. Using a manual scan instead of one big regex
  // keeps it deterministic on weird whitespace.
  const openTagRe = /<section\b([^>]*)>/g;
  const classNameRe = /className\s*=\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/;

  let m: RegExpExecArray | null;
  let slideOrderIndex = 0;
  while ((m = openTagRe.exec(tsx)) !== null) {
    const tagStart = m.index;
    const tagAttrs = m[1] || "";
    const cls = classNameRe.exec(tagAttrs);
    if (!cls) continue;
    const className = (cls[1] || cls[2] || cls[3] || "").trim();
    if (!/\bslide\b/.test(className)) continue;

    // Found a slide opening tag — walk forward and balance <section>/</section>
    // pairs to find the matching close.
    let depth = 1;
    let cursor = openTagRe.lastIndex;
    let closeEnd = -1;
    const balanceRe = /<\/?section\b[^>]*>/g;
    balanceRe.lastIndex = cursor;
    let bm: RegExpExecArray | null;
    while ((bm = balanceRe.exec(tsx)) !== null) {
      cursor = bm.index;
      const isClose = bm[0].startsWith("</");
      if (isClose) {
        depth--;
        if (depth === 0) {
          closeEnd = balanceRe.lastIndex;
          break;
        }
      } else {
        depth++;
      }
    }

    if (closeEnd === -1) {
      // Unbalanced slide — return what we have so the caller can decide.
      break;
    }

    blocks.push({
      index: slideOrderIndex++,
      start: tagStart,
      end: closeEnd,
      source: tsx.slice(tagStart, closeEnd),
    });

    // Resume the outer scan after this slide's close so we don't re-enter
    // the same slide and treat its inner sections as new slides.
    openTagRe.lastIndex = closeEnd;
  }

  return blocks;
}

/**
 * Replaces specific slides in the source TSX with new TSX. Every other slide
 * — and every byte outside of slide blocks (helpers, whitespace, JSX wrapper)
 * — is preserved exactly. Returns null if any requested index doesn't exist.
 */
export function replaceSlides(
  tsx: string,
  changes: Array<{ index: number; tsx: string }>,
): { ok: true; tsx: string; replaced: number[] } | { ok: false; error: string } {
  const blocks = findSlideBlocks(tsx);
  if (blocks.length === 0) {
    return { ok: false, error: "Konnte keine <section className=\"slide\"> Blöcke im aktuellen Code finden." };
  }

  // Validate all indices exist before mutating anything.
  for (const c of changes) {
    if (!Number.isInteger(c.index) || c.index < 0 || c.index >= blocks.length) {
      return {
        ok: false,
        error: `Slide-Index ${c.index} existiert nicht. Es gibt ${blocks.length} Slides (Indizes 0..${blocks.length - 1}).`,
      };
    }
    if (typeof c.tsx !== "string" || !c.tsx.includes("<section")) {
      return {
        ok: false,
        error: `Slide ${c.index}: tsx muss ein vollständiger <section className="slide">…</section> Block sein.`,
      };
    }
  }

  // Sort changes by descending source-position so earlier replacements don't
  // shift the offsets of later ones.
  const sorted = [...changes].sort((a, b) => blocks[b.index].start - blocks[a.index].start);

  let next = tsx;
  const replaced: number[] = [];
  for (const c of sorted) {
    const block = blocks[c.index];
    next = next.slice(0, block.start) + c.tsx.trim() + next.slice(block.end);
    replaced.push(c.index);
  }

  return { ok: true, tsx: next, replaced: replaced.sort((a, b) => a - b) };
}
