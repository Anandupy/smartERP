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
