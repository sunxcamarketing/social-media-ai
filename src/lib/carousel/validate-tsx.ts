// Validates that a TSX snippet (post-sanitize) is parseable JSX. We use
// @babel/parser with the same plugins the in-iframe Babel-standalone uses
// at runtime, so anything that parses here will render in the preview.
//
// The carousel TSX is wrapped in an IIFE-ish setup at runtime (helpers +
// `function Carousel`), so we wrap it in a pseudo module before parsing
// to give the parser a valid top-level context.

import { parse } from "@babel/parser";

export interface TsxValidationOk {
  ok: true;
}
export interface TsxValidationFail {
  ok: false;
  error: string;
  line?: number;
  column?: number;
}
export type TsxValidationResult = TsxValidationOk | TsxValidationFail;

export function validateTsx(code: string): TsxValidationResult {
  try {
    parse(code, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
      errorRecovery: false,
      // The runtime wraps everything in an IIFE so top-level `return Carousel;`
      // is allowed. Mirror that here.
      allowReturnOutsideFunction: true,
    });
    return { ok: true };
  } catch (err) {
    const e = err as { message?: string; loc?: { line: number; column: number } };
    const line = e.loc?.line;
    const column = e.loc?.column;
    const where = line !== undefined ? ` (Zeile ${line}${column !== undefined ? `:${column}` : ""})` : "";
    return {
      ok: false,
      error: `${e.message || "Parse failed"}${where}`,
      line,
      column,
    };
  }
}
