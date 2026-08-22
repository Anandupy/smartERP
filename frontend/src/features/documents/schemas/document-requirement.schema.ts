import { z } from "zod";

import { nonEmptyString } from "@/schemas";

/**
 * Sentinel form value for "applies to all" — mapped to `null` on submit.
 * Not the empty string: `SelectField`'s underlying Radix `Select` treats an
 * empty string as "no value", which would stop the trigger from ever
 * displaying "All programs" as the selected option.
 */
export const APPLIES_TO_ALL = "ALL";

/**
 * Form schema for `DocumentRequirement`.
 *
 * `documentTypeId` and `requiredByStage` are the only fields the design
 * spec's validation matrix (§28) documents as required.
 * `appliesToProgramId`/`appliesToQuotaId`/`appliesToCategoryId` are each
 * nullable on the wire, meaning "applies to all" — represented in the form
 * by `APPLIES_TO_ALL` and translated to `null` in the mapper.
 * `isMandatory` defaults `true` per the same matrix.
 */
export const documentRequirementFormSchema = z.object({
  documentTypeId: nonEmptyString,
  appliesToProgramId: z.string(),
  appliesToQuotaId: z.string(),
  appliesToCategoryId: z.string(),
  requiredByStage: nonEmptyString,
  isMandatory: z.boolean(),
  isActive: z.boolean(),
});

export type DocumentRequirementFormValues = z.infer<
  typeof documentRequirementFormSchema
>;

export function documentRequirementFormDefaults(): DocumentRequirementFormValues {
  return {
    documentTypeId: "",
    appliesToProgramId: APPLIES_TO_ALL,
    appliesToQuotaId: APPLIES_TO_ALL,
    appliesToCategoryId: APPLIES_TO_ALL,
    requiredByStage: "",
    isMandatory: true,
    isActive: true,
  };
}
