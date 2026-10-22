import "server-only";

import path from "node:path";
import { pathToFileURL } from "node:url";

import { createCanvas } from "@napi-rs/canvas";

import {
  checkboxInk,
  decodeImage,
  ocrImage,
  readDigitBoxes,
  toGray,
  type RgbImage,
} from "./paddle-ocr";
import { LABELS } from "./ssv-form-template";
import type { Box, FormPage, Token } from "./types";

/** An uploaded file, already read into memory. */
export interface UploadedForm {
  name: string;
  type: string;
  bytes: Buffer;
}

/** A page plus what the offline reader needs to look at its pixels. */
export interface LoadedPage extends FormPage {
  image?: RgbImage;
  gray?: Uint8Array;
}

/** PDF pages are rendered at this many pixels per point for OCR (~200 dpi). */
const RENDER_SCALE = 200 / 72;
/** A text layer with fewer printed labels than this is treated as a scan. */
const MIN_TEXT_LAYER_LABELS = 6;

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let pdfjsPromise: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
      path.join(
        process.cwd(),
        "node_modules",
        "pdfjs-dist",
        "legacy",
        "build",
        "pdf.worker.mjs",
      ),
    ).href;
    return pdfjs;
  });
  return pdfjsPromise;
}

const normalise = (text: string) =>
  text.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** How many of the form's printed labels appear in a page's text. */
function countLabels(tokens: Token[]): number {
  const keys = Object.values(LABELS).map((label) => label.key);
  const text = normalise(tokens.map((t) => t.text).join(" "));
  return keys.filter((key) => key.length >= 6 && text.includes(key)).length;
}

async function ocrPage(
  image: RgbImage,
  modelDir?: string,
): Promise<LoadedPage> {
  const [tokens, gray] = await Promise.all([
    ocrImage(image, modelDir),
    toGray(image),
  ]);
  return {
    width: image.width,
    height: image.height,
    source: "ocr",
    tokens,
    image,
    gray,
    checkboxInk: (word: Box) =>
      checkboxInk(gray, image.width, image.height, word),
  };
}

async function loadPdf(
  bytes: Buffer,
  modelDir?: string,
): Promise<LoadedPage[]> {
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: false,
  });
  const doc = await task.promise;

  const pages: LoadedPage[] = [];
  try {
    for (let number = 1; number <= Math.min(doc.numPages, 4); number++) {
      const page = await doc.getPage(number);
      const viewport = page.getViewport({ scale: RENDER_SCALE });

      // 1. A digital PDF: read the text layer directly — exact and instant.
      const content = await page.getTextContent();
      const tokens: Token[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const [, , c, d, e, f] = pdfjs.Util.transform(
          viewport.transform,
          item.transform,
        );
        const fontHeight = Math.hypot(c, d);
        tokens.push({
          text: item.str,
          x0: e,
          x1: e + item.width * RENDER_SCALE,
          y0: f - fontHeight * 0.85,
          y1: f + fontHeight * 0.2,
          score: 1,
        });
      }
      if (countLabels(tokens) >= MIN_TEXT_LAYER_LABELS) {
        pages.push({
          width: viewport.width,
          height: viewport.height,
          source: "text-layer",
          tokens,
        });
        continue;
      }

      // 2. A scanned PDF: render the page and OCR it.
      const canvas = createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height),
      );
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;
      const image = await decodeImage(canvas.toBuffer("image/png"));
      pages.push(await ocrPage(image, modelDir));
    }
  } finally {
    await task.destroy();
  }
  return pages;
}

/** Turns uploaded files (one PDF, or photos of each page) into form pages. */
export async function loadFormPages(
  files: UploadedForm[],
  modelDir?: string,
): Promise<LoadedPage[]> {
  const pages: LoadedPage[] = [];
  for (const file of files) {
    if (file.type === "application/pdf")
      pages.push(...(await loadPdf(file.bytes, modelDir)));
    else pages.push(await ocrPage(await decodeImage(file.bytes), modelDir));
  }
  return pages;
}

/** Reads boxed digits on an OCR page with the PaddleOCR digit-box reader. */
export function digitBoxReader(modelDir?: string) {
  return async (
    page: FormPage,
    region: Box,
    isValid: (digits: string) => boolean,
  ) => {
    const loaded = page as LoadedPage;
    if (!loaded.image || !loaded.gray) return null;
    return readDigitBoxes(loaded.image, loaded.gray, region, isValid, modelDir);
  };
}
