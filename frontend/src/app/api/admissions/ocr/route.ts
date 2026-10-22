import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/config/env";
import {
  admissionOcrSchema,
  type AdmissionOcrResponse,
  type AdmissionOcrResult,
} from "@/features/admissions/schemas/admission-ocr.schema";

/**
 * `POST /api/admissions/ocr` — reads a photo or scan of a filled paper
 * admission form with Claude vision and returns the fields for the New
 * Admission form to pre-fill. Nothing is saved: the clerk reviews the filled
 * form and submits it as usual.
 *
 * - The Anthropic key is server-only (`ANTHROPIC_API_KEY` in `.env.local`).
 * - The caller must hold a valid CampusFlow session; the bearer token is
 *   checked against the backend's `GET /auth/me` before any model call.
 * - On any failure the route returns an error — it never substitutes sample
 *   data for an unreadable form.
 */

export const runtime = "nodejs";

const MODEL = "claude-opus-5-5";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

const SYSTEM_PROMPT = `You read photos and scans of filled school admission forms (often handwritten, often photographed on a phone and shared on WhatsApp) and transcribe them into the given JSON schema.

Rules:
- Transcribe only what is written on the form. If a field is blank, crossed out, missing from this form, or you cannot read it, return "" (or false for yes/no fields). Never guess or invent a value.
- If you had to make a judgement call reading a field (ambiguous digit, smudged letter), still return your best reading but add the field's name to uncertainFields.
- Names: split the student's name into first, middle (usually the father's name on Indian forms) and last name / surname, in Title Case.
- Dates: convert the date of birth to YYYY-MM-DD. Indian forms write DD/MM/YYYY.
- Aadhaar: 12 digits, no spaces. Mobile numbers: 10 digits without +91 or a leading 0. PIN code: 6 digits.
- masterLabels: copy the gender, religion, caste, category, mother tongue, blood group, disability type and the class/standard applied for exactly as written or ticked on the form (e.g. "Female", "Hindu", "OBC", "Marathi", "B+", "Std 1").
- Ticked checkboxes for bus/transport and hostel set transportRequired / hostelRequired.
- If the image is not an admission form, return every field empty and put "not_an_admission_form" in uncertainFields.`;

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** True when the backend accepts the caller's bearer token. */
async function isAuthenticated(authorization: string | null): Promise<boolean> {
  if (!authorization?.startsWith("Bearer ")) return false;
  try {
    const res = await fetch(
      `${env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "")}/${env.NEXT_PUBLIC_API_VERSION}/auth/me`,
      { headers: { Authorization: authorization }, cache: "no-store" },
    );
    return res.ok;
  } catch {
    return false;
  }
}

const digits = (value: string) => value.replace(/\D/g, "");

/** Keeps a value only if it matches the expected digit shape; otherwise blank. */
function cleanDigits(value: string, length: number): string {
  let d = digits(value);
  if (length === 10 && d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (length === 10 && d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d.length === length ? d : "";
}

function cleanDob(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return "";
  const date = new Date(`${value.trim()}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date > new Date() ? "" : value.trim();
}

/**
 * Normalises the shapes the backend validates, so a misread digit becomes a
 * blank field the clerk notices — not a value the save then rejects.
 */
function normalise(result: AdmissionOcrResult): AdmissionOcrResult {
  const uncertain = new Set(result.uncertainFields);
  const check = (field: string, raw: string, cleaned: string) => {
    if (raw.trim() && !cleaned) uncertain.add(field);
    return cleaned;
  };

  return {
    ...result,
    student: {
      ...result.student,
      dob: check("dob", result.student.dob, cleanDob(result.student.dob)),
      aadhaarNo: check(
        "aadhaarNo",
        result.student.aadhaarNo,
        cleanDigits(result.student.aadhaarNo, 12),
      ),
    },
    contact: {
      ...result.contact,
      primaryMobile: check(
        "primaryMobile",
        result.contact.primaryMobile,
        cleanDigits(result.contact.primaryMobile, 10),
      ),
      alternateMobile: check(
        "alternateMobile",
        result.contact.alternateMobile,
        cleanDigits(result.contact.alternateMobile, 10),
      ),
      primaryEmail: result.contact.primaryEmail.trim().toLowerCase(),
    },
    address: {
      ...result.address,
      pincode: check("pincode", result.address.pincode, cleanDigits(result.address.pincode, 6)),
    },
    parents: {
      ...result.parents,
      fatherMobile: cleanDigits(result.parents.fatherMobile, 10),
      motherMobile: cleanDigits(result.parents.motherMobile, 10),
    },
    uncertainFields: [...uncertain],
  };
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req.headers.get("authorization")))) {
    return errorResponse(401, "Your session has expired. Sign in again to scan forms.");
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return errorResponse(
      503,
      "Form scanning is not set up. Add ANTHROPIC_API_KEY to frontend/.env.local and restart the server.",
    );
  }

  let file: File | null = null;
  try {
    const formData = await req.formData();
    const entry = formData.get("file");
    file = entry instanceof File ? entry : null;
  } catch {
    return errorResponse(400, "Upload the form as multipart/form-data with a 'file' field.");
  }

  if (!file || file.size === 0) return errorResponse(400, "No file was uploaded.");
  if (file.size > MAX_FILE_BYTES) {
    return errorResponse(413, "The file is larger than 10 MB. Send a smaller photo or scan.");
  }

  const isPdf = file.type === "application/pdf";
  const isImage = (IMAGE_TYPES as readonly string[]).includes(file.type);
  if (!isPdf && !isImage) {
    return errorResponse(415, "Upload a JPG, PNG, WebP or PDF of the admission form.");
  }

  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const source: Anthropic.Beta.BetaContentBlockParam = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
    : { type: "image", source: { type: "base64", media_type: file.type as ImageType, data } };

  const client = new Anthropic();

  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      output_config: { effort: "high", format: betaZodOutputFormat(admissionOcrSchema) },
      messages: [
        {
          role: "user",
          content: [source, { type: "text", text: "Transcribe this admission form." }],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return errorResponse(422, "This file could not be read as an admission form.");
    }
    if (!response.parsed_output) {
      return errorResponse(502, "The form could not be read. Try a clearer, straighter photo.");
    }

    const result = normalise(response.parsed_output);
    if (result.uncertainFields.includes("not_an_admission_form")) {
      return errorResponse(422, "This doesn't look like an admission form.");
    }

    return NextResponse.json<AdmissionOcrResponse>({ result });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("[admissions/ocr] Anthropic rejected ANTHROPIC_API_KEY");
      return errorResponse(503, "Form scanning is misconfigured (invalid API key).");
    }
    if (error instanceof Anthropic.RateLimitError) {
      return errorResponse(429, "Too many scans at once. Wait a minute and try again.");
    }
    if (error instanceof Anthropic.BadRequestError) {
      console.error("[admissions/ocr] bad request:", error.message);
      return errorResponse(422, "The file could not be processed. Try a JPG or PNG photo.");
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`[admissions/ocr] API error ${error.status}:`, error.message);
      return errorResponse(502, "The scanning service is unavailable. Try again shortly.");
    }
    console.error("[admissions/ocr] unexpected error:", error);
    return errorResponse(500, "Something went wrong while reading the form.");
  }
}
