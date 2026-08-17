import { z } from "zod";

import { nonEmptyString } from "@/schemas";

import { MENU_STATUSES, PERMISSION_MODES } from "../types/menu.dto";

/**
 * Form schema for creating and editing a menu.
 *
 * Format rules mirror `create-menu.dto.ts` exactly: `code` matches
 * `/^[A-Z0-9_]+$/` (the same `@Matches` decorator the backend uses), and
 * `moduleId`/`route`/`displayName` are the only other required fields. Every
 * other constraint the Stitch design might suggest — route uniqueness, a
 * fixed icon vocabulary, a permission-key format — is enforced server-side and
 * not duplicated here, since inventing it here would reject values the backend
 * would accept.
 *
 * `permissions` and `searchKeywords` are both `string[]` on the wire but
 * edited here as comma-separated text — no shared "tag input" component exists
 * in this codebase, and the two-field split/join happens in
 * `mappers/menu.mapper.ts` rather than in a zod transform, so the text the user
 * typed round-trips exactly on validation failure.
 *
 * `parentId` uses the sentinel `NO_PARENT` because a `Select` cannot carry an
 * empty string as a value; the mapper turns it back into `null` (root-level).
 */
const CODE = /^[A-Z0-9_]+$/;

export const NO_PARENT = "ROOT";

export const menuFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Required")
    .regex(CODE, "Uppercase letters, numbers and underscores only"),
  moduleId: nonEmptyString,
  parentId: z.string(),
  route: nonEmptyString,
  componentIdentifier: z.string().trim(),
  displayName: nonEmptyString,
  icon: z.string().trim(),
  tooltip: z.string().trim(),
  description: z.string().trim(),
  permissionsText: z.string().trim(),
  permissionMode: z.enum(PERMISSION_MODES),
  displayOrder: z.coerce.number().int().min(0),
  badge: z.string().trim(),
  searchKeywordsText: z.string().trim(),
  status: z.enum(MENU_STATUSES),
});

export type MenuFormValues = z.infer<typeof menuFormSchema>;

/** A blank menu. `moduleId` is seeded by the caller from the selected module. */
export function menuFormDefaults(moduleId = ""): MenuFormValues {
  return {
    code: "",
    moduleId,
    parentId: NO_PARENT,
    route: "",
    componentIdentifier: "",
    displayName: "",
    icon: "",
    tooltip: "",
    description: "",
    permissionsText: "",
    permissionMode: "ALL",
    displayOrder: 0,
    badge: "",
    searchKeywordsText: "",
    status: "ACTIVE",
  };
}
