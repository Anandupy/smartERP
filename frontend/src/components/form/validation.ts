import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { getFieldErrors } from "@/lib";

/**
 * Bridge server-side validation (a normalized `ApiError` with `fieldErrors`)
 * into React Hook Form field errors. Returns `true` if any field error was
 * applied so callers can decide whether to also surface a global toast.
 */
export function applyServerFieldErrors<TFieldValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TFieldValues>,
): boolean {
  const fieldErrors = getFieldErrors(error);
  if (!fieldErrors || fieldErrors.length === 0) return false;

  for (const fieldError of fieldErrors) {
    setError(fieldError.field as Path<TFieldValues>, {
      type: "server",
      message: fieldError.message,
    });
  }
  return true;
}
