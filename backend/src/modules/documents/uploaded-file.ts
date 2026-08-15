/**
 * The subset of a Multer file object this module actually needs.
 *
 * Declared locally rather than depending on the global `Express.Multer.File`
 * augmentation, which requires `@types/multer` — not a dependency of this
 * project. `FileInterceptor` populates an object that structurally satisfies
 * this at runtime regardless.
 */
export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
