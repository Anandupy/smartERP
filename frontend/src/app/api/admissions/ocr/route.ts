import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/config/env";
import { serverEnv } from "@/config/server-env";
import type { AdmissionOcrResponse } from "@/features/admissions";
import {
  AdmissionScanError,
  readAdmissionForm,
  type UploadedForm,
} from "@/features/admissions/server";

/**
 * `POST /api/admissions/ocr` — reads one filled paper admission form (a PDF,
 * or up to 3 photos — one per page) and returns the fields for the New
 * Admission form to pre-fill. Nothing is saved: the clerk reviews and submits.
 *
 * The engine is chosen by `ADMISSION_OCR_ENGINE` (see `config/server-env.ts`):
 * the free offline reader by default, Claude vision when `ANTHROPIC_API_KEY`
 * is set. The caller must hold a valid CampusFlow session, checked against
 * the backend's `GET /auth/me`. On failure the route returns an error — it
 * never substitutes sample data for an unreadable form.
 */

export const runtime = "nodejs";

const MAX_FILES = 3;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

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

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req.headers.get("authorization")))) {
    return errorResponse(
      401,
      "Your session has expired. Sign in again to scan forms.",
    );
  }

  let entries: File[];
  try {
    const formData = await req.formData();
    entries = formData
      .getAll("file")
      .filter((entry): entry is File => entry instanceof File);
  } catch {
    return errorResponse(
      400,
      "Upload the form as multipart/form-data with 'file' fields.",
    );
  }

  if (entries.length === 0 || entries.every((file) => file.size === 0)) {
    return errorResponse(400, "No file was uploaded.");
  }
  if (entries.length > MAX_FILES) {
    return errorResponse(
      400,
      `Upload at most ${MAX_FILES} files: one PDF, or one photo per page.`,
    );
  }
  for (const file of entries) {
    if (file.size > MAX_FILE_BYTES) {
      return errorResponse(
        413,
        `${file.name || "A file"} is larger than 10 MB. Send a smaller photo or scan.`,
      );
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return errorResponse(
        415,
        "Upload a JPG, PNG, WebP or PDF of the admission form.",
      );
    }
  }

  const files: UploadedForm[] = await Promise.all(
    entries.map(async (file) => ({
      name: file.name,
      type: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
    })),
  );

  try {
    const { result, engine, notices } = await readAdmissionForm(files, {
      engine: serverEnv.ADMISSION_OCR_ENGINE,
      anthropicApiKey: serverEnv.ANTHROPIC_API_KEY,
      modelDir: serverEnv.ADMISSION_OCR_MODEL_DIR,
    });
    return NextResponse.json<AdmissionOcrResponse>({ result, engine, notices });
  } catch (error) {
    if (error instanceof AdmissionScanError)
      return errorResponse(error.status, error.message);
    console.error("[admissions/ocr] unexpected error:", error);
    return errorResponse(500, "Something went wrong while reading the form.");
  }
}
