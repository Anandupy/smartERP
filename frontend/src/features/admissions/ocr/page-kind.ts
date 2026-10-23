import { PAGE_MARKERS } from "./ssv-form-template";
import type { Token } from "./types";

const normalise = (text: string) =>
  text.toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Which page of the admission form this is, from the labels printed on it —
 * how a PDF of many forms is split into one form per student. Null for any
 * other page (a cover sheet, a blank page, an attached document).
 */
export function pageKind(page: {
  tokens: Pick<Token, "text">[];
}): "first" | "second" | null {
  const text = normalise(page.tokens.map((t) => t.text).join(" "));
  const first = PAGE_MARKERS.first.filter((key) => text.includes(key)).length;
  const second = PAGE_MARKERS.second.filter((key) => text.includes(key)).length;
  if (first >= 2 && first >= second) return "first";
  if (second >= 2) return "second";
  return null;
}
