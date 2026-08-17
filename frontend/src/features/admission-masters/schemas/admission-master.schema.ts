import { z } from "zod";

import { nonEmptyString } from "@/schemas";

/**
 * Form schema shared by all 10 admission masters — Create and Update take an
 * identical documented body, so one schema covers every resource.
 *
 * `code` and `name` are the only required fields. Neither backend document
 * (`backend/docs/modules/admissions.md`) nor the Postman collection states a
 * format rule or a required/optional split for any field — the collection's
 * example values are schema-faker placeholders, not captured real data. `code`
 * and `name` are required here because they are the record's only defensible
 * identity pair and the user's own screen spec marks both with `*`; nothing
 * else is asserted, since the first legitimate value an invented rule
 * rejected would be a bug with no backend to blame.
 *
 * `metadata` is deliberately absent from this schema — see the module
 * `index.ts` for why it is never exposed as a form field.
 */
export const admissionMasterFormSchema = z.object({
  code: nonEmptyString,
  name: nonEmptyString,
  description: z.string().trim(),
  displayOrder: z.coerce.number().int().min(0),
  isActive: z.boolean(),
});

export type AdmissionMasterFormValues = z.infer<
  typeof admissionMasterFormSchema
>;

/** A blank record. `displayOrder` starts at 0 and `isActive` defaults on. */
export function admissionMasterFormDefaults(): AdmissionMasterFormValues {
  return { code: "", name: "", description: "", displayOrder: 0, isActive: true };
}
