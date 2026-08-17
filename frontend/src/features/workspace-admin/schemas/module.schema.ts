import { z } from "zod";

import { nonEmptyString } from "@/schemas";

/**
 * Form schema for creating and editing a module.
 *
 * `code` mirrors the backend's own validator exactly — `create-module.dto.ts`
 * enforces `/^[A-Z0-9_]+$/` with `@Matches`, and that is the only format rule
 * either document states. Nothing else is asserted: no length limits, no icon
 * vocabulary — none are documented, and the first legitimate value an invented
 * rule rejected would be a bug with no backend to blame.
 */
const CODE = /^[A-Z0-9_]+$/;

export const moduleFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Required")
    .regex(CODE, "Uppercase letters, numbers and underscores only"),
  name: nonEmptyString,
  description: z.string().trim(),
  icon: z.string().trim(),
  displayOrder: z.coerce.number().int().min(0),
});

export type ModuleFormValues = z.infer<typeof moduleFormSchema>;

/** A blank module. `displayOrder` defaults to the documented default of 0. */
export function moduleFormDefaults(): ModuleFormValues {
  return { code: "", name: "", description: "", icon: "", displayOrder: 0 };
}
