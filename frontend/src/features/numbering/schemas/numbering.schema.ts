import { z } from "zod";

import { nonEmptyString } from "@/schemas";

import { NUMBERING_YEAR_FORMATS } from "../types/numbering.dto";

/**
 * The format layer's closed token vocabulary and safety bounds, mirrored
 * from the backend (design spec §12.5 — `KNOWN_PLACEHOLDERS`,
 * `SAFE_LITERAL_PATTERN`, `MAX_FORMAT_LENGTH`, `MAX_PREFIX_SUFFIX_LENGTH`).
 * A UX nicety only: the server re-validates and remains authoritative, and a
 * rejection it raises for a rule not mirrored here still surfaces through
 * the form's own error handling.
 */
const KNOWN_PLACEHOLDERS = ["{prefix}", "{suffix}", "{branchCode}", "{year}", "{sequence}"];
const SAFE_LITERAL_PATTERN = /^[A-Za-z0-9\-_./ ]*$/;
const MAX_FORMAT_LENGTH = 64;
const MAX_PREFIX_SUFFIX_LENGTH = 20;

// A single `superRefine` rather than chained `.refine()` calls: chaining
// short-circuits — Zod skips a later `.refine()` once an earlier one in the
// chain has already failed — which silently hid every check but the first.
const literalField = z.string().trim().superRefine((value, ctx) => {
  if (value.length > MAX_PREFIX_SUFFIX_LENGTH) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Must be ${MAX_PREFIX_SUFFIX_LENGTH} characters or fewer`,
    });
  }
  if (!SAFE_LITERAL_PATTERN.test(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Only letters, digits, and - _ . / space are allowed",
    });
  }
});

/**
 * Form schema for `NumberingConfig`. Covers both Create and Edit — the
 * mapper decides which fields actually reach the wire, since `purpose` is
 * create-only and `isActive` is edit-only (`docs/numbering-module.md`).
 */
export const numberingConfigFormSchema = z.object({
  purpose: nonEmptyString,
  prefix: literalField,
  suffix: literalField,
  includeBranchCode: z.boolean(),
  includeAcademicYear: z.boolean(),
  sequencePadding: z.coerce.number().int().min(1).max(20),
  format: nonEmptyString.superRefine((value, ctx) => {
    if (value.length > MAX_FORMAT_LENGTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Must be ${MAX_FORMAT_LENGTH} characters or fewer`,
      });
    }
    if (!value.includes("{sequence}")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Format must include {sequence}",
      });
    }
    const tokens = value.match(/\{[^}]*\}/g) ?? [];
    if (!tokens.every((token) => KNOWN_PLACEHOLDERS.includes(token))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Only ${KNOWN_PLACEHOLDERS.join(", ")} are supported placeholders`,
      });
    }
    if (new Set(tokens).size !== tokens.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Each placeholder may be used only once",
      });
    }
    if (!SAFE_LITERAL_PATTERN.test(value.replace(/\{[^}]*\}/g, ""))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only letters, digits, and - _ . / space are allowed outside placeholders",
      });
    }
  }),
  yearFormat: z.enum(NUMBERING_YEAR_FORMATS),
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
    yearFormat: "NAME",
    isActive: true,
  };
}
