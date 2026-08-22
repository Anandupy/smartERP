import { z } from "zod";

import { nonEmptyString } from "@/schemas";

/**
 * Form schema for `NumberingConfig`. Covers both Create and Edit — the
 * mapper decides which fields actually reach the wire, since `purpose` is
 * create-only and `isActive` is edit-only (`docs/numbering-module.md`).
 *
 * `format` must contain `{sequence}` — the one documented validation rule
 * beyond presence (design spec §2 D6, invariant 6): "a format must contain
 * `{sequence}`, validated at config creation." Asserted here as a UX
 * nicety; the server remains authoritative.
 */
export const numberingConfigFormSchema = z.object({
  purpose: nonEmptyString,
  prefix: z.string().trim(),
  suffix: z.string().trim(),
  includeBranchCode: z.boolean(),
  includeAcademicYear: z.boolean(),
  sequencePadding: z.coerce.number().int().min(1).max(20),
  format: nonEmptyString.refine((value) => value.includes("{sequence}"), {
    message: "Format must include {sequence}",
  }),
  isActive: z.boolean(),
});

export type NumberingConfigFormValues = z.infer<typeof numberingConfigFormSchema>;

export function numberingConfigFormDefaults(): NumberingConfigFormValues {
  return {
    purpose: "",
    prefix: "",
    suffix: "",
    includeBranchCode: false,
    includeAcademicYear: false,
    sequencePadding: 6,
    format: "{prefix}{sequence}",
    isActive: true,
  };
}
