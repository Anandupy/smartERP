import "server-only";

import type { AdmissionOcrResult } from "../schemas/admission-ocr.schema";
import { readWithClaude } from "./claude-reader";
import { extractAdmissionForm } from "./extract-form";
import { digitBoxReader, loadFormPages, type UploadedForm } from "./load-pages";
import { normaliseOcrResult } from "./normalise-result";
import { OfflineOcrUnavailableError } from "./paddle-ocr";
import { AdmissionScanError } from "./scan-error";

export type AdmissionOcrEngine = "auto" | "offline" | "claude";

export interface ReadAdmissionFormOptions {
  engine: AdmissionOcrEngine;
  anthropicApiKey?: string;
  modelDir?: string;
}

export interface ReadAdmissionFormResult {
  result: AdmissionOcrResult;
  /** Which reader produced the result. */
  engine: "offline" | "claude";
  /** Shown to the clerk, e.g. why Claude was not used. */
  notices: string[];
}

/** Fewer printed labels than this and the upload is not the school's form. */
const MIN_LABELS = 8;

async function readOffline(
  files: UploadedForm[],
  modelDir?: string,
): Promise<AdmissionOcrResult> {
  let pages;
  try {
    pages = await loadFormPages(files, modelDir);
  } catch (error) {
    if (error instanceof OfflineOcrUnavailableError) {
      console.error("[admissions/ocr]", error.message);
      throw new AdmissionScanError(
        503,
        "Offline form scanning is not installed on the server.",
      );
    }
    console.error("[admissions/ocr] could not open upload:", error);
    throw new AdmissionScanError(
      422,
      "The file could not be opened. Upload a JPG, PNG or PDF of the form.",
    );
  }

  const { result, labelsFound } = await extractAdmissionForm(
    pages,
    digitBoxReader(modelDir),
  );
  if (labelsFound < MIN_LABELS) {
    throw new AdmissionScanError(
      422,
      "This doesn't look like the Shree Siddhi Vinayagar admission form. Upload a clear, straight photo or scan of the whole page.",
    );
  }
  return result;
}

/**
 * Reads a filled admission form with the configured engine:
 *
 * - `offline` — the free PaddleOCR reader for the school's own form; nothing
 *   leaves the server.
 * - `claude` — Claude vision; requires `ANTHROPIC_API_KEY`.
 * - `auto` — Claude when a key is set, else offline. If the Claude *service*
 *   fails (outage, rate limit, bad key), the offline reader reads the same
 *   form instead and the clerk is told.
 */
export async function readAdmissionForm(
  files: UploadedForm[],
  options: ReadAdmissionFormOptions,
): Promise<ReadAdmissionFormResult> {
  const notices: string[] = [];
  const useClaude =
    options.engine === "claude" ||
    (options.engine === "auto" && Boolean(options.anthropicApiKey));

  if (useClaude) {
    if (!options.anthropicApiKey) {
      throw new AdmissionScanError(
        503,
        "Claude form scanning is selected but ANTHROPIC_API_KEY is not set.",
      );
    }
    try {
      const result = await readWithClaude(files, options.anthropicApiKey);
      if (result.uncertainFields.includes("not_an_admission_form")) {
        throw new AdmissionScanError(
          422,
          "This doesn't look like an admission form.",
        );
      }
      return { result: normaliseOcrResult(result), engine: "claude", notices };
    } catch (error) {
      if (
        !(error instanceof AdmissionScanError) ||
        !error.serviceFailure ||
        options.engine !== "auto"
      )
        throw error;
      notices.push(
        `${error.message} The form was read with the offline scanner instead.`,
      );
    }
  }

  const result = await readOffline(files, options.modelDir);
  return { result: normaliseOcrResult(result), engine: "offline", notices };
}
