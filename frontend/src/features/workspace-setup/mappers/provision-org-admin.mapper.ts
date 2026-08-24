import type { Path, UseFormSetError } from "react-hook-form";

import { getFieldErrors } from "@/lib";

import type { ProvisionOrgAdminFormValues } from "../schemas/provision-org-admin.schema";
import type { CreateOrgAdminRequest } from "../types/provision-org-admin.dto";

/** Form values → `POST /users` body. Blank `organizationId` is omitted, not sent as `""`. */
export function toCreateOrgAdminRequest(
  values: ProvisionOrgAdminFormValues,
): CreateOrgAdminRequest {
  const organizationId = values.organizationId.trim();
  return {
    fullName: values.fullName.trim(),
    username: values.username.trim(),
    email: values.email.trim(),
    phone: values.phoneCountryCode.trim() + values.phoneNumber.trim(),
    password: values.password,
    role: "ORG_ADMIN",
    ...(organizationId ? { organizationId } : {}),
  };
}

/**
 * Server-side field errors → form errors, same job as the platform's
 * `applyServerFieldErrors` except for one wire field that has no matching
 * form field: `CreateUserDto.phone` is a single string, but this form splits
 * it into `phoneCountryCode`/`phoneNumber` (see the schema). A bare
 * `setError("phone", …)` would bind to nothing rendered and the message would
 * silently vanish, so a `phone` field error is redirected to `phoneNumber`
 * with the same combined-format message the client-side check already uses.
 */
export function applyProvisionOrgAdminFieldErrors(
  error: unknown,
  setError: UseFormSetError<ProvisionOrgAdminFormValues>,
): boolean {
  const fieldErrors = getFieldErrors(error);
  if (!fieldErrors || fieldErrors.length === 0) return false;

  for (const fieldError of fieldErrors) {
    if (fieldError.field === "phone") {
      setError("phoneNumber", {
        type: "server",
        message: "Enter a valid phone number, including the country code",
      });
      continue;
    }
    setError(fieldError.field as Path<ProvisionOrgAdminFormValues>, {
      type: "server",
      message: fieldError.message,
    });
  }
  return true;
}
