import { z } from "zod";

/**
 * Shared Zod schemas reused by feature schemas and the forms layer. Feature-
 * specific schemas live in their module's `schemas/` folder and compose these.
 */

export const idSchema = z.string().min(1, "Required");

export const paginationParamsSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  search: z.string().optional(),
});

export type PaginationParamsInput = z.input<typeof paginationParamsSchema>;
export type PaginationParams = z.output<typeof paginationParamsSchema>;

/** Common reusable field schemas. */
export const emailSchema = z.string().email("Enter a valid email address");
export const nonEmptyString = z.string().trim().min(1, "Required");

/**
 * The two pieces of a phone number entered through `PhoneField`
 * (`components/form`), combined into the single E.164 string
 * `CreateUserDto.phone` requires — see `@/lib/phone` for why. Kept apart
 * here rather than as one schema so a form can validate "is this a plausible
 * code" / "is this a plausible number" independently before checking the
 * combined value with `isValidE164`.
 */
export const phoneCountryCodeSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{0,3}$/, "e.g. +91");
export const phoneNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{6,12}$/, "Digits only");
