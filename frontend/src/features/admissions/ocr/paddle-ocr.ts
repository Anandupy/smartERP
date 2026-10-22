import "server-only";

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import * as ort from "onnxruntime-node";
import sharp from "sharp";

import type { Box, Token } from "./types";

/**
 * A small, dependency-light PaddleOCR (PP-OCRv4) pipeline: DB text detection
 * followed by CRNN/CTC recognition, both run locally with ONNX Runtime. No
 * network access — the model files ship in the `@gutenye/ocr-models` package
 * (Apache-2.0 PaddleOCR weights) or a folder named by
 * `ADMISSION_OCR_MODEL_DIR`.
 *
 * Recognition decodes against the multilingual PP-OCRv4 dictionary but only
 * lets printable ASCII win at each step, so a smudge can never come back as a
 * CJK character on an English admission form.
 */

/** An RGB image held in memory, 3 bytes per pixel. */
export interface RgbImage {
  data: Buffer;
  width: number;
  height: number;
}

const DETECT_MAX_SIDE = 1600;
const DETECT_THRESHOLD = 0.3;
const BOX_SCORE_THRESHOLD = 0.6;
const UNCLIP_RATIO = 1.6;
const REC_HEIGHT = 48;
const MAX_IMAGE_SIDE = 2400;

const DET_MEAN = [0.485, 0.456, 0.406];
const DET_STD = [0.229, 0.224, 0.225];

interface Models {
  detection: ort.InferenceSession;
  recognition: ort.InferenceSession;
  /** dictionary[i] is the character for model class i + 1 (class 0 is blank). */
  dictionary: string[];
  /** Model class indices allowed to be emitted (printable ASCII). */
  allowed: Int32Array;
  /** Model class indices for the digits 0–9 only. */
  digits: Int32Array;
}

let modelsPromise: Promise<Models> | null = null;

function defaultModelDir(): string {
  return path.join(
    process.cwd(),
    "node_modules",
    "@gutenye",
    "ocr-models",
    "assets",
  );
}

async function loadModels(modelDir: string): Promise<Models> {
  const files = {
    detection: path.join(modelDir, "ch_PP-OCRv4_det_infer.onnx"),
    recognition: path.join(modelDir, "ch_PP-OCRv4_rec_infer.onnx"),
    dictionary: path.join(modelDir, "ppocr_keys_v1.txt"),
  };
  for (const file of Object.values(files)) {
    if (!existsSync(file)) {
      throw new OfflineOcrUnavailableError(
        `Offline OCR model file not found: ${file}. Run "pnpm install" in frontend/, or set ADMISSION_OCR_MODEL_DIR.`,
      );
    }
  }

  const options: ort.InferenceSession.SessionOptions = {
    graphOptimizationLevel: "all",
  };
  const [detection, recognition, dictionaryText] = await Promise.all([
    ort.InferenceSession.create(files.detection, options),
    ort.InferenceSession.create(files.recognition, options),
    readFile(files.dictionary, "utf8"),
  ]);

  const dictionary = [
    ...dictionaryText
      .split(/\r?\n/)
      .filter((line, i, all) => i < all.length - 1 || line !== ""),
    " ",
  ];
  const allowed: number[] = [];
  dictionary.forEach((char, index) => {
    const code = char.codePointAt(0) ?? 0;
    if (char.length === 1 && code >= 0x20 && code <= 0x7e)
      allowed.push(index + 1);
  });

  const digits = dictionary
    .map((char, index) => (/^[0-9]$/.test(char) ? index + 1 : -1))
    .filter((index) => index > 0);

  return {
    detection,
    recognition,
    dictionary,
    allowed: Int32Array.from(allowed),
    digits: Int32Array.from(digits),
  };
}

/** Loads the models once per server process. */
export function getOcrModels(modelDir?: string): Promise<Models> {
  modelsPromise ??= loadModels(modelDir || defaultModelDir()).catch(
    (error: unknown) => {
      modelsPromise = null;
      throw error;
    },
  );
  return modelsPromise;
}

export class OfflineOcrUnavailableError extends Error {
  override name = "OfflineOcrUnavailableError";
}

/** Decodes any image (JPG/PNG/WebP, EXIF-rotated) to RGB, capped in size. */
export async function decodeImage(input: Buffer): Promise<RgbImage> {
  const { data, info } = await sharp(input, { failOn: "none" })
    .rotate()
    .resize({
      width: MAX_IMAGE_SIDE,
      height: MAX_IMAGE_SIDE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** A grayscale copy for checkbox ink measurement. */
export async function toGray(image: RgbImage): Promise<Uint8Array> {
  const gray = await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: 3 },
  })
    .grayscale()
    .raw()
    .toBuffer();
  return new Uint8Array(gray.buffer, gray.byteOffset, gray.length);
}

/** Fraction of dark (< 128) pixels inside `box` of a grayscale image. */
export function inkRatio(
  gray: Uint8Array,
  width: number,
  height: number,
  box: Box,
): number {
  const x0 = Math.max(0, Math.floor(box.x0));
  const y0 = Math.max(0, Math.floor(box.y0));
  const x1 = Math.min(width, Math.ceil(box.x1));
  const y1 = Math.min(height, Math.ceil(box.y1));
  if (x1 <= x0 || y1 <= y0) return 0;
  let dark = 0;
  for (let y = y0; y < y1; y++) {
    const row = y * width;
    for (let x = x0; x < x1; x++) if (gray[row + x] < 128) dark++;
  }
  return dark / ((x1 - x0) * (y1 - y0));
}

async function resizeRaw(
  image: RgbImage,
  width: number,
  height: number,
): Promise<Buffer> {
  return sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: 3 },
  })
    .resize(width, height, { fit: "fill" })
    .raw()
    .toBuffer();
}

/** HWC RGB bytes → CHW BGR float tensor, normalised per channel. */
function toTensor(
  rgb: Buffer,
  width: number,
  height: number,
  mean: number[],
  std: number[],
) {
  const plane = width * height;
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    const r = rgb[i * 3] / 255;
    const g = rgb[i * 3 + 1] / 255;
    const b = rgb[i * 3 + 2] / 255;
    out[i] = (b - mean[0]) / std[0];
    out[plane + i] = (g - mean[1]) / std[1];
    out[2 * plane + i] = (r - mean[2]) / std[2];
  }
  return new ort.Tensor("float32", out, [1, 3, height, width]);
}

/** DB text detection: returns one box per text region, in image pixels. */
async function detect(models: Models, image: RgbImage): Promise<Box[]> {
  const scale = Math.min(
    1,
    DETECT_MAX_SIDE / Math.max(image.width, image.height),
  );
  const width = Math.max(32, Math.ceil((image.width * scale) / 32) * 32);
  const height = Math.max(32, Math.ceil((image.height * scale) / 32) * 32);
  const input = toTensor(
    await resizeRaw(image, width, height),
    width,
    height,
    DET_MEAN,
    DET_STD,
  );

  const outputs = await models.detection.run({
    [models.detection.inputNames[0]]: input,
  });
  const prob = outputs[models.detection.outputNames[0]].data as Float32Array;

  // Connected components over the thresholded probability map.
  const visited = new Uint8Array(width * height);
  const stack = new Int32Array(width * height);
  const boxes: Box[] = [];
  const sx = image.width / width;
  const sy = image.height / height;

  for (let start = 0; start < prob.length; start++) {
    if (visited[start] || prob[start] <= DETECT_THRESHOLD) continue;
    let top = 0;
    stack[top++] = start;
    visited[start] = 1;
    let minX = width,
      minY = height,
      maxX = 0,
      maxY = 0,
      sum = 0,
      count = 0;
    while (top > 0) {
      const p = stack[--top];
      const x = p % width;
      const y = (p - x) / width;
      sum += prob[p];
      count++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const neighbours = [p - 1, p + 1, p - width, p + width];
      for (let n = 0; n < 4; n++) {
        const q = neighbours[n];
        if (q < 0 || q >= prob.length || visited[q]) continue;
        if ((n === 0 && x === 0) || (n === 1 && x === width - 1)) continue;
        if (prob[q] <= DETECT_THRESHOLD) continue;
        visited[q] = 1;
        stack[top++] = q;
      }
    }
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    if (h < 3 || w < 3 || sum / count < BOX_SCORE_THRESHOLD) continue;
    // DB predicts a shrunk text kernel; grow it back ("unclip").
    const d = (w * h * UNCLIP_RATIO) / (2 * (w + h));
    boxes.push({
      x0: Math.max(0, (minX - d) * sx),
      y0: Math.max(0, (minY - d) * sy),
      x1: Math.min(image.width, (maxX + 1 + d) * sx),
      y1: Math.min(image.height, (maxY + 1 + d) * sy),
    });
  }
  return boxes;
}

/** Runs the recognition model on one crop, scaled to the model's 48px height. */
async function runRecognition(
  models: Models,
  image: RgbImage,
  box: Box,
  padTo = 0,
) {
  const left = Math.max(0, Math.floor(box.x0));
  const top = Math.max(0, Math.floor(box.y0));
  const cropW = Math.min(image.width, Math.ceil(box.x1)) - left;
  const cropH = Math.min(image.height, Math.ceil(box.y1)) - top;
  if (cropW < 4 || cropH < 4) return null;

  const scaledW = Math.max(8, Math.round((REC_HEIGHT * cropW) / cropH));
  const width = Math.min(2400, Math.max(16, padTo, scaledW));
  const pad = Math.max(0, width - scaledW);
  const rgb = await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: 3 },
  })
    .extract({ left, top, width: cropW, height: cropH })
    .resize(scaledW, REC_HEIGHT, { fit: "fill" })
    .extend({
      left: Math.floor(pad / 2),
      right: Math.ceil(pad / 2),
      background: { r: 255, g: 255, b: 255 },
    })
    .raw()
    .toBuffer();
  const input = toTensor(
    rgb,
    width,
    REC_HEIGHT,
    [0.5, 0.5, 0.5],
    [0.5, 0.5, 0.5],
  );

  const outputs = await models.recognition.run({
    [models.recognition.inputNames[0]]: input,
  });
  const output = outputs[models.recognition.outputNames[0]];
  const [, steps, classes] = output.dims as number[];
  return { probs: output.data as Float32Array, steps, classes };
}

/** Greedy CTC decoding, letting only printable ASCII win at each step. */
function decode(
  models: Models,
  probs: Float32Array,
  steps: number,
  classes: number,
) {
  let text = "";
  let confidence = 1;
  let emitted = 0;
  let previous = -1;
  for (let t = 0; t < steps; t++) {
    const row = t * classes;
    let best = 0;
    let bestProb = probs[row];
    for (const index of models.allowed) {
      if (probs[row + index] > bestProb) {
        bestProb = probs[row + index];
        best = index;
      }
    }
    if (best !== 0 && best !== previous) {
      text += models.dictionary[best - 1];
      if (models.dictionary[best - 1] !== " ")
        confidence = Math.min(confidence, bestProb);
      emitted++;
    }
    previous = best;
  }
  // The weakest character decides: one doubtful letter is enough to make the
  // clerk check the field.
  return {
    text: text.replace(/\s+/g, " ").trim(),
    score: emitted ? confidence : 0,
  };
}

/** CRNN recognition of one cropped text region. */
async function recognize(
  models: Models,
  image: RgbImage,
  box: Box,
): Promise<Token | null> {
  const run = await runRecognition(models, image, box);
  if (!run) return null;
  const { text, score } = decode(models, run.probs, run.steps, run.classes);
  return text ? { ...box, text, score } : null;
}

/** Letters a handwritten digit is commonly read as. */
const DIGIT_LOOKALIKES: Record<string, string> = {
  o: "0",
  O: "0",
  D: "0",
  Q: "0",
  l: "1",
  I: "1",
  i: "1",
  "|": "1",
  "/": "1",
  z: "2",
  Z: "2",
  s: "5",
  S: "5",
  b: "6",
  G: "6",
  T: "7",
  B: "8",
  g: "9",
  q: "9",
  A: "4",
};

/** Detects and reads every text region on the image. */
export async function ocrImage(
  image: RgbImage,
  modelDir?: string,
): Promise<Token[]> {
  const models = await getOcrModels(modelDir);
  const boxes = await detect(models, image);
  const tokens: Token[] = [];
  for (const box of boxes) {
    const token = await recognize(models, image, box);
    if (token) tokens.push(token);
  }
  return tokens;
}

/**
 * Bounding box of the dark pixels inside `box`, ignoring rows and columns
 * that are mostly dark (a box's own border or rounded corner leaking in), or
 * null when the cell is blank.
 */
function inkBounds(gray: Uint8Array, imageWidth: number, box: Box): Box | null {
  const bx0 = Math.floor(box.x0);
  const by0 = Math.floor(box.y0);
  const w = Math.ceil(box.x1) - bx0;
  const h = Math.ceil(box.y1) - by0;
  if (w <= 0 || h <= 0) return null;
  const dark = (x: number, y: number) =>
    gray[(by0 + y) * imageWidth + bx0 + x] < 140;
  const rowCount = new Array<number>(h).fill(0);
  const colCount = new Array<number>(w).fill(0);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (dark(x, y)) {
        rowCount[y]++;
        colCount[x]++;
      }
  const borderRow = rowCount.map((n) => n > w * 0.6);
  const borderCol = colCount.map((n) => n > h * 0.6);

  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (let y = 0; y < h; y++) {
    if (borderRow[y]) continue;
    for (let x = 0; x < w; x++) {
      if (borderCol[x] || !dark(x, y)) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (!Number.isFinite(x0) || (x1 - x0 + 1) * (y1 - y0 + 1) < 12) return null;
  return { x0: bx0 + x0, y0: by0 + y0, x1: bx0 + x1 + 1, y1: by0 + y1 + 1 };
}

/**
 * Squeezes out the empty columns between glyphs, leaving a small fixed gap:
 * digits from separate boxes then read like one written number instead of
 * characters scattered across a wide strip.
 */
function compactColumns(
  image: RgbImage,
  gray: Uint8Array,
  gapFactor: number,
): RgbImage | null {
  const { width, height } = image;
  const inked: boolean[] = [];
  let top = height;
  let bottom = 0;
  for (let x = 0; x < width; x++) {
    let any = false;
    for (let y = 0; y < height; y++) {
      if (gray[y * width + x] < 140) {
        any = true;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
    inked.push(any);
  }
  if (bottom < top) return null;
  const gap = Math.max(3, Math.round((bottom - top + 1) * gapFactor));

  // White margins either side: the model misreads text that touches the edge.
  const columns: number[] = new Array<number>(gap * 2).fill(-1);
  let blank = 0;
  for (let x = 0; x < width; x++) {
    if (inked[x]) {
      if (columns.length > gap * 2 && blank > 0)
        for (let g = 0; g < Math.min(blank, gap); g++) columns.push(-1);
      columns.push(x);
      blank = 0;
    } else blank++;
  }
  if (columns.length === gap * 2) return null;
  columns.push(...new Array<number>(gap * 2).fill(-1));

  const out = Buffer.alloc(columns.length * height * 3, 255);
  columns.forEach((src, dst) => {
    if (src < 0) return;
    for (let y = 0; y < height; y++) {
      const from = (y * width + src) * 3;
      const to = (y * columns.length + dst) * 3;
      out[to] = image.data[from];
      out[to + 1] = image.data[from + 1];
      out[to + 2] = image.data[from + 2];
    }
  });
  return { data: out, width: columns.length, height };
}

/** Vertical border columns of a row of boxes: [start, end) column ranges. */
function findBorderColumns(
  gray: Uint8Array,
  width: number,
  region: Box,
  imageWidth: number,
) {
  const x0 = Math.max(0, Math.floor(region.x0));
  const x1 = Math.min(width, Math.ceil(region.x1));
  const y0 = Math.max(0, Math.floor(region.y0));
  const y1 = Math.ceil(region.y1);
  const runs: number[] = [];
  for (let x = x0; x < x1; x++) {
    let best = 0;
    let run = 0;
    for (let y = y0; y < y1; y++) {
      if (gray[y * imageWidth + x] < 140) {
        run++;
        if (run > best) best = run;
      } else run = 0;
    }
    runs.push(best);
  }
  const tallest = Math.max(0, ...runs);
  const lines: { start: number; end: number }[] = [];
  runs.forEach((run, i) => {
    if (run < tallest * 0.8) return;
    const x = x0 + i;
    const last = lines.at(-1);
    if (last && x - last.end <= 2) last.end = x + 1;
    else lines.push({ start: x, end: x + 1 });
  });
  return { tallest, lines };
}

/**
 * Reads handwritten digits written one per box (DOB, Aadhaar, mobile, PIN).
 * Finds the row of boxes inside `region`, paints the box borders white so
 * only the handwriting is left, and reads the row as one line — the model
 * reads digits far better in a sequence than one at a time. Returns null when
 * no row of boxes is found, so the caller can fall back to plain line OCR.
 */
export async function readDigitBoxes(
  image: RgbImage,
  gray: Uint8Array,
  region: Box,
  /** Whether a reading has the right shape for the field (e.g. 12 digits). */
  isValid: (digits: string) => boolean,
  modelDir?: string,
): Promise<{ digits: string; score: number } | null> {
  const models = await getOcrModels(modelDir);
  const { tallest, lines } = findBorderColumns(
    gray,
    image.width,
    region,
    image.width,
  );
  if (tallest < 12 || lines.length < 3) return null;

  // Vertical extent of the boxes: the longest unbroken dark run down a border
  // column (text above or a rule below the boxes is not part of that run).
  const top = Math.max(0, Math.floor(region.y0));
  const bottom = Math.min(image.height, Math.ceil(region.y1));
  let boxTop = 0;
  let boxBottom = 0;
  for (const line of lines) {
    const x = Math.floor((line.start + line.end - 1) / 2);
    let runStart = -1;
    for (let y = top; y <= bottom; y++) {
      const isDark = y < bottom && gray[y * image.width + x] < 140;
      if (isDark && runStart < 0) runStart = y;
      if (!isDark && runStart >= 0) {
        if (y - runStart > boxBottom - boxTop) {
          boxTop = runStart;
          boxBottom = y - 1;
        }
        runStart = -1;
      }
    }
  }
  const boxH = boxBottom - boxTop;
  if (boxH < 10) return null;

  // Crop the row, then whiten border columns (±1px) and border rows.
  const left = Math.max(0, lines[0].start - 2);
  const right = Math.min(image.width, (lines.at(-1)?.end ?? left) + 2);
  const cropTop = Math.max(0, boxTop - 2);
  const cropBottom = Math.min(image.height, boxBottom + 3);
  const w = right - left;
  const h = cropBottom - cropTop;
  if (w < 8 || h < 8) return null;

  const isBorderCol = new Uint8Array(w);
  for (const line of lines)
    for (let x = line.start - 2; x < line.end + 2; x++)
      if (x - left >= 0 && x - left < w) isBorderCol[x - left] = 1;

  const data = Buffer.alloc(w * h * 3, 255);
  for (let y = 0; y < h; y++) {
    const srcY = cropTop + y;
    let darkInRow = 0;
    for (let x = 0; x < w; x++)
      if (gray[srcY * image.width + left + x] < 140) darkInRow++;
    // Horizontal box edges: rows dark across most of the row, or the box's top/bottom few pixels.
    const edgeRow = darkInRow > w * 0.35 || y < 4 || y >= h - 4;
    if (edgeRow) continue;
    for (let x = 0; x < w; x++) {
      if (isBorderCol[x]) continue;
      const src = (srcY * image.width + left + x) * 3;
      data[(y * w + x) * 3] = image.data[src];
      data[(y * w + x) * 3 + 1] = image.data[src + 1];
      data[(y * w + x) * 3 + 2] = image.data[src + 2];
    }
  }

  const whitened: RgbImage = { data, width: w, height: h };
  const whitenedGray = await toGray(whitened);

  // The model is sensitive to spacing, so read a few layouts of the same
  // digits and keep the most confident reading with a valid shape; a reading
  // that is never valid comes back with its confidence halved.
  const variants = [
    whitened,
    compactColumns(whitened, whitenedGray, 0.35),
    compactColumns(whitened, whitenedGray, 0.8),
  ];
  let best: { digits: string; score: number } | null = null;
  for (const variant of variants) {
    if (!variant) continue;
    const reading = await readLine(models, variant);
    if (!reading) continue;
    const candidate = isValid(reading.digits)
      ? reading
      : { digits: reading.digits, score: reading.score * 0.5 };
    if (!best || candidate.score > best.score) best = candidate;
  }
  return best;
}

/** Reads a cleaned strip of digits as one line, mapping digit lookalikes. */
async function readLine(models: Models, strip: RgbImage) {
  const ink = inkBounds(await toGray(strip), strip.width, {
    x0: 0,
    y0: 0,
    x1: strip.width,
    y1: strip.height,
  });
  if (!ink) return null;
  const margin = (ink.y1 - ink.y0) * 0.3;
  const run = await runRecognition(models, strip, {
    x0: Math.max(0, ink.x0 - margin * 2),
    y0: Math.max(0, ink.y0 - margin),
    x1: Math.min(strip.width, ink.x1 + margin * 2),
    y1: Math.min(strip.height, ink.y1 + margin),
  });
  if (!run) return null;
  const { text, score } = decode(models, run.probs, run.steps, run.classes);
  const digits = [...text]
    .map((char) => (/[0-9]/.test(char) ? char : (DIGIT_LOOKALIKES[char] ?? "")))
    .join("");
  return digits ? { digits, score } : null;
}

/**
 * Ink inside the checkbox printed just left of an option word, or null when
 * no checkbox is there. A checkbox is two vertical borders joined by top and
 * bottom edges — letters never are — and the option's own box is the
 * rightmost one between a little left of the word and the word's end (OCR
 * boxes often start at the checkbox, or even before it).
 */
export function checkboxInk(
  gray: Uint8Array,
  width: number,
  height: number,
  word: Box,
): number | null {
  const h = word.y1 - word.y0;
  const cy = (word.y0 + word.y1) / 2;
  const top = Math.max(0, Math.floor(cy - h * 0.7));
  const bottom = Math.min(height, Math.ceil(cy + h * 0.7));
  // Word ends are estimated from character widths, so allow some slack.
  const right = Math.min(width - 1, Math.floor(word.x1 + h * 0.8));
  const left = Math.max(0, Math.floor(word.x0 - h * 2.2));
  const isDark = (x: number, y: number) => gray[y * width + x] < 150;

  // Clusters of adjacent columns holding a tall dark run, right to left.
  const clusters: { min: number; max: number }[] = [];
  for (let x = right; x >= left; x--) {
    let run = 0;
    let best = 0;
    for (let y = top; y < bottom; y++) {
      run = isDark(x, y) ? run + 1 : 0;
      if (run > best) best = run;
    }
    if (best < h * 0.4) continue;
    const last = clusters.at(-1);
    if (last && last.min - x <= 2) last.min = x;
    else clusters.push({ min: x, max: x });
  }

  const edgeDark = (y: number, x0: number, x1: number) => {
    let dark = 0;
    for (let x = x0; x <= x1; x++) if (isDark(x, y)) dark++;
    return dark / (x1 - x0 + 1);
  };

  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      // Try both ends of the right cluster: a tick stroke can sit beside the border.
      for (const r of [clusters[i].min, clusters[i].max]) {
        const l = clusters[j].max;
        const side = r - l;
        if (side < h * 0.35 || side > h * 1.3) continue;
        let boxTop = -1;
        let boxBottom = -1;
        for (let y = top; y < bottom; y++) {
          if (isDark(l, y)) {
            if (boxTop < 0) boxTop = y;
            boxBottom = y;
          }
        }
        if (boxTop < 0 || boxBottom - boxTop < side * 0.6) continue;
        // Rounded corners end the side borders a pixel or two short of the edge.
        const hasEdge = (y: number) =>
          [-2, -1, 0, 1, 2].some(
            (k) => y + k >= 0 && y + k < height && edgeDark(y + k, l, r) >= 0.7,
          );
        if (!hasEdge(boxTop) || !hasEdge(boxBottom)) continue;
        const inset = side * 0.25;
        return inkRatio(gray, width, height, {
          x0: l + inset,
          y0: boxTop + inset,
          x1: r - inset,
          y1: boxBottom - inset,
        });
      }
    }
  }
  return null;
}
