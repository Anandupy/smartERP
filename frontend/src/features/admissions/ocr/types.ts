/** An axis-aligned box in page units (PDF points × scale, or image pixels). */
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** One run of text on a page — a PDF text item or an OCR'd text region. */
export interface Token extends Box {
  text: string;
  /** Recognition confidence, 0..1. Always 1 for a PDF text layer. */
  score: number;
}

/**
 * One page of an uploaded admission form, reduced to positioned text.
 *
 * `text-layer` pages come from a digital PDF and are exact; `ocr` pages were
 * read from pixels, so their text may be wrong and ticks must be found by
 * looking at the ink inside the checkbox (`checkboxInk`).
 */
export interface FormPage {
  width: number;
  height: number;
  source: "text-layer" | "ocr";
  tokens: Token[];
  /**
   * Ink inside the checkbox printed just left of an option word (0..1), or
   * null when no checkbox is found there. OCR pages only.
   */
  checkboxInk?: (word: Box) => number | null;
}

export const boxHeight = (box: Box) => box.y1 - box.y0;
export const boxWidth = (box: Box) => box.x1 - box.x0;
export const centerX = (box: Box) => (box.x0 + box.x1) / 2;
export const centerY = (box: Box) => (box.y0 + box.y1) / 2;
