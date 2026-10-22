import "server-only";

/**
 * Server-only public surface of the Admissions feature.
 *
 * `index.ts` is imported by client components, so anything that needs Node
 * (native OCR, file system, secrets) is exported from here instead and may be
 * imported only by route handlers. The `server-only` import turns an
 * accidental client import into a build error.
 */
export {
  readAdmissionForm,
  type AdmissionOcrEngine,
  type ReadAdmissionFormOptions,
  type ReadAdmissionFormResult,
} from "./ocr/read-admission-form";
export { isClaudeReadable } from "./ocr/claude-reader";
export type { UploadedForm } from "./ocr/load-pages";
export { AdmissionScanError } from "./ocr/scan-error";
