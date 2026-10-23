import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

import {
  admissionOcrSchema,
  type AdmissionOcrResult,
} from "../schemas/admission-ocr.schema";
import type { UploadedForm } from "./load-pages";
import { AdmissionScanError } from "./scan-error";

/**
 * Reads an admission form with Claude vision — the optional upgrade over the
 * offline reader: better on messy handwriting and works for any form layout.
 * Only used when `ANTHROPIC_API_KEY` is configured.
 */

const MODEL = "claude-opus-5-5";
const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

const SYSTEM_PROMPT = `You read photos and scans of filled school admission forms (often handwritten, often photographed on a phone and shared on WhatsApp) and transcribe them into the given JSON schema. A form may arrive as several images, one per page.

Rules:
- Transcribe only what is written on the form. If a field is blank, crossed out, missing from this form, or you cannot read it, return "" (or false for yes/no fields). Never guess or invent a value.
- If you had to make a judgement call reading a field (ambiguous digit, smudged letter), still return your best reading but add the field's name to uncertainFields.
- Names: split the student's name into first, middle (usually the father's name on Indian forms) and last name / surname, in Title Case.
- Dates: convert the date of birth to YYYY-MM-DD. Indian forms write DD/MM/YYYY.
- Aadhaar: 12 digits, no spaces. Mobile numbers: 10 digits without +91 or a leading 0. PIN code: 6 digits.
- masterLabels: copy the gender, religion, caste, category, mother tongue, blood group, disability type, the class/standard applied for and the ticked admission source exactly as written or ticked on the form (e.g. "Female", "Hindu", "OBC", "Marathi", "B+", "Std 1", "Walk-in").
- Ticked checkboxes for bus/transport and hostel set transportRequired / hostelRequired.
- If the images are not an admission form, return every field empty and put "not_an_admission_form" in uncertainFields.`;

export function isClaudeReadable(file: UploadedForm): boolean {
  return (
    file.type === "application/pdf" ||
    (IMAGE_TYPES as readonly string[]).includes(file.type)
  );
}

export async function readWithClaude(
  files: UploadedForm[],
  apiKey: string,
): Promise<AdmissionOcrResult> {
  const client = new Anthropic({ apiKey });
  const sources: Anthropic.Beta.BetaContentBlockParam[] = files.map((file) => {
    const data = file.bytes.toString("base64");
    return file.type === "application/pdf"
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data },
        }
      : {
          type: "image",
          source: { type: "base64", media_type: file.type as ImageType, data },
        };
  });

  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      output_config: {
        effort: "high",
        format: betaZodOutputFormat(admissionOcrSchema),
      },
      messages: [
        {
          role: "user",
          content: [
            ...sources,
            { type: "text", text: "Transcribe this admission form." },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      throw new AdmissionScanError(
        422,
        "This file could not be read as an admission form.",
      );
    }
    if (!response.parsed_output) {
      throw new AdmissionScanError(
        502,
        "The form could not be read. Try a clearer, straighter photo.",
      );
    }
    return response.parsed_output;
  } catch (error) {
    if (error instanceof AdmissionScanError) throw error;
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("[admissions/ocr] Anthropic rejected ANTHROPIC_API_KEY");
      throw new AdmissionScanError(
        503,
        "Claude form scanning is misconfigured (invalid API key).",
        true,
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new AdmissionScanError(
        429,
        "Too many scans at once. Wait a minute and try again.",
        true,
      );
    }
    if (error instanceof Anthropic.BadRequestError) {
      console.error("[admissions/ocr] bad request:", error.message);
      throw new AdmissionScanError(
        422,
        "The file could not be processed. Try a JPG or PNG photo.",
      );
    }
    if (error instanceof Anthropic.APIError) {
      console.error(
        `[admissions/ocr] API error ${error.status}:`,
        error.message,
      );
      throw new AdmissionScanError(
        502,
        "The Claude scanning service is unavailable.",
        true,
      );
    }
    if (error instanceof Anthropic.APIConnectionError) {
      throw new AdmissionScanError(
        502,
        "Could not reach the Claude scanning service.",
        true,
      );
    }
    throw error;
  }
}
