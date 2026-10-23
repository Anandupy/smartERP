import "server-only";

import type { AdmissionBatchEvent } from "../schemas/admission-ocr.schema";
import { extractAdmissionForm } from "./extract-form";
import { digitBoxReader, pdfPages, type LoadedPage } from "./load-pages";
import { normaliseOcrResult } from "./normalise-result";
import { pageKind } from "./page-kind";

/**
 * Reads a PDF holding many filled admission forms — a bundle scanned in one
 * go at the office — and yields one result per student as soon as it is
 * read, so the review queue fills up while the rest is still being scanned.
 *
 * Always uses the offline reader: it has to look at every page anyway to
 * find where each student's form starts.
 */

export const MAX_BATCH_PAGES = 80;
const MIN_LABELS = 8;

export type BatchEvent = Exclude<AdmissionBatchEvent, { type: "error" }>;

export async function* readAdmissionBatch(
  pdf: Buffer,
  modelDir?: string,
): AsyncGenerator<BatchEvent> {
  const reader = digitBoxReader(modelDir);
  let current: { pages: LoadedPage[]; numbers: number[] } | null = null;
  let index = 0;
  const skippedPages: number[] = [];

  async function* finish(form: {
    pages: LoadedPage[];
    numbers: number[];
  }): AsyncGenerator<BatchEvent> {
    index++;
    try {
      const { result, labelsFound } = await extractAdmissionForm(
        form.pages,
        reader,
      );
      yield labelsFound < MIN_LABELS
        ? {
            type: "form",
            index,
            pages: form.numbers,
            error: "This doesn't look like a complete admission form.",
          }
        : {
            type: "form",
            index,
            pages: form.numbers,
            result: normaliseOcrResult(result),
          };
    } catch (error) {
      console.error("[admissions/ocr/batch] form", index, error);
      yield {
        type: "form",
        index,
        pages: form.numbers,
        error: "This form could not be read.",
      };
    }
  }

  let started = false;
  for await (const { page, number, total } of pdfPages(
    pdf,
    MAX_BATCH_PAGES,
    modelDir,
  )) {
    if (!started) {
      started = true;
      yield { type: "start", totalPages: total };
    }
    yield { type: "progress", page: number, totalPages: total };

    const kind = pageKind(page);
    if (kind === "first") {
      if (current) yield* finish(current);
      current = { pages: [page], numbers: [number] };
    } else if (kind === "second" && current && current.pages.length < 3) {
      current.pages.push(page);
      current.numbers.push(number);
    } else {
      // A cover sheet, a blank page, or a page 2 without its page 1.
      skippedPages.push(number);
    }
  }
  if (current) yield* finish(current);
  yield { type: "done", forms: index, skippedPages };
}
