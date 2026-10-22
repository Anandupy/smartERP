/**
 * A form-scanning failure with the HTTP status and message the route returns.
 * `serviceFailure` marks problems with the Claude service itself (not the
 * file), which the offline reader can step in for under `auto`.
 */
export class AdmissionScanError extends Error {
  override name = "AdmissionScanError";

  constructor(
    readonly status: number,
    message: string,
    readonly serviceFailure = false,
  ) {
    super(message);
  }
}
