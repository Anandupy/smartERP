import { NextResponse, type NextRequest } from "next/server";

import { serverEnv } from "@/config/server-env";
import { readAdmissionBatch } from "@/features/admissions/server";

import { isAuthenticated } from "../session";

/**
 * `POST /api/admissions/ocr/batch` — reads one PDF holding many filled
 * admission forms (a bundle scanned at the office) and streams one result per
 * student as newline-delimited JSON (`BatchEvent`s), so the review queue
 * fills in while the rest of the PDF is still being read. Nothing is saved:
 * the clerk reviews each student and saves from the queue.
 */

export const runtime = "nodejs";

const MAX_BYTES = 40 * 1024 * 1024;

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req.headers.get("authorization")))) {
    return errorResponse(
      401,
      "Your session has expired. Sign in again to scan forms.",
    );
  }

  let file: File | null = null;
  try {
    const entry = (await req.formData()).get("file");
    file = entry instanceof File ? entry : null;
  } catch {
    return errorResponse(
      400,
      "Upload the PDF as multipart/form-data with a 'file' field.",
    );
  }
  if (!file || file.size === 0)
    return errorResponse(400, "No file was uploaded.");
  if (file.type !== "application/pdf") {
    return errorResponse(
      415,
      "Bulk entry reads one PDF containing all the forms.",
    );
  }
  if (file.size > MAX_BYTES) {
    return errorResponse(
      413,
      "The PDF is larger than 40 MB. Split it into smaller bundles.",
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const encoder = new TextEncoder();
  const events = readAdmissionBatch(bytes, serverEnv.ADMISSION_OCR_MODEL_DIR);

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await events.next();
        if (done) return controller.close();
        controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      } catch (error) {
        console.error("[admissions/ocr/batch]", error);
        controller.enqueue(
          encoder.encode(
            `${JSON.stringify({ type: "error", error: "The PDF could not be read." })}\n`,
          ),
        );
        controller.close();
      }
    },
    async cancel() {
      // The clerk left the page: stop reading the rest of the PDF.
      await events.return(undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
