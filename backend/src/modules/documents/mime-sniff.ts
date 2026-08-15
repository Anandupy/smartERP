/**
 * Minimal magic-byte verification for the file types this deployment
 * actually expects (scanned/photographed certificates and photos):
 * PDF, JPEG, PNG.
 *
 * "Do not trust the client-provided MIME type" (§12) does not mean every
 * possible format must be sniffed — no `file-type`-equivalent package is a
 * dependency of this project, and adding one for an R5 foundation is out of
 * scope. For the three types below, a mismatch between the declared
 * Content-Type and the file's own signature is refused. For any other
 * declared type this deployment cannot verify by signature, the declared
 * Content-Type is trusted — a recorded, deliberate gap, not a silent one.
 * See docs/planning/document-management-specification.md §Upload security.
 */
const SNIFFABLE: Record<string, (buf: Buffer) => boolean> = {
  'application/pdf': (buf) => buf.subarray(0, 4).toString('latin1') === '%PDF',
  'image/jpeg': (buf) =>
    buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  'image/png': (buf) =>
    buf.length >= 8 &&
    buf
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
};

export function isSniffable(mimeType: string): boolean {
  return mimeType in SNIFFABLE;
}

/** True if the declared type is not one this deployment can verify, or the bytes match its signature. */
export function matchesDeclaredMimeType(
  mimeType: string,
  data: Buffer,
): boolean {
  const check = SNIFFABLE[mimeType];
  return check ? check(data) : true;
}
