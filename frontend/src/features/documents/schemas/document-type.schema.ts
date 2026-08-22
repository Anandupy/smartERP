import { z } from "zod";

import { nonEmptyString } from "@/schemas";

/**
 * Form schema for `DocumentType`. Create and Update take the same
 * documented body (`docs/backend-gaps.md` DOC5) — one schema covers both.
 *
 * `code`, `name` and `allowedMimeTypes` (min 1) are required — the design
 * spec's validation matrix (§28) documents `code` and `allowedMimeTypes` as
 * required; `name` is required as the record's only other defensible
 * identity field, the same reasoning `admissionMasterFormSchema` uses.
 * Nothing else is asserted beyond what the matrix states.
 */
export const documentTypeFormSchema = z
  .object({
    code: nonEmptyString,
    name: nonEmptyString,
    description: z.string().trim(),
    isSensitive: z.boolean(),
    hasExpiry: z.boolean(),
    defaultValidityMonths: z.coerce.number().int().min(1).nullable(),
    retentionYears: z.coerce.number().int().min(1).nullable(),
    allowedMimeTypes: z.array(z.string()).min(1, "Select at least one file type"),
    maxSizeBytes: z.coerce.number().int().min(1024).max(50 * 1024 * 1024),
    displayOrder: z.coerce.number().int().min(0),
    isActive: z.boolean(),
  })
  .refine(
    (values) => !values.hasExpiry || values.defaultValidityMonths !== null,
    {
      message: "Set a default validity when expiry is enabled",
      path: ["defaultValidityMonths"],
    },
  );

export type DocumentTypeFormValues = z.infer<typeof documentTypeFormSchema>;

/** A blank record. 10 MiB max size matches the design spec's own default (§7). */
export function documentTypeFormDefaults(): DocumentTypeFormValues {
  return {
    code: "",
    name: "",
    description: "",
    isSensitive: false,
    hasExpiry: false,
    defaultValidityMonths: null,
    retentionYears: null,
    allowedMimeTypes: [],
    maxSizeBytes: 10 * 1024 * 1024,
    displayOrder: 0,
    isActive: true,
  };
}
