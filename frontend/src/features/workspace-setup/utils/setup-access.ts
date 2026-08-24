import { roleRequiresSelection, type SetupResource } from "@/core/workspace";

/**
 * Which roles the backend's `@Roles()` decorators let act on each mandatory
 * resource — read off the controllers `docs/workspace-setup-module.md` cites,
 * not guessed. `BRANCH`/`ACADEMIC_YEAR` also allow `BRANCH_ADMIN` on the
 * backend, but a `BRANCH_ADMIN` has no initial-setup authority
 * (`docs/workspace-setup-module.md` §"Roles") and is never routed into this
 * wizard in the first place — see `roleCanAccessSetupWizard`.
 */
const STAGE_ROLES: Record<SetupResource, readonly string[]> = {
  SYSTEM_SETTINGS: ["SUPER_ADMIN"],
  ORGANIZATION: ["SUPER_ADMIN"],
  BRANCH: ["SUPER_ADMIN", "ORG_ADMIN"],
  ACADEMIC_YEAR: ["SUPER_ADMIN", "ORG_ADMIN"],
};

/** May this role act on this stage's create/init endpoint? */
export function canActOnStage(
  resource: SetupResource,
  role: string | null,
): boolean {
  if (!role) return false;
  return STAGE_ROLES[resource].includes(role);
}

/**
 * `POST /workspace/setup/complete` is `SUPER_ADMIN`-only on the backend, with
 * no exception for the `ORG_ADMIN` who may have done all the actual
 * configuration work (Path B). This is a deliberate backend decision, not a
 * gap this feature works around — see
 * `docs/workspace-setup-module.md`'s "Completion is not delegated" section.
 */
export function canCompleteSetup(role: string | null): boolean {
  return role === "SUPER_ADMIN";
}

/**
 * May this role see the setup wizard at all?
 *
 * Identical to `core/workspace`'s `roleRequiresSelection` — the two roles that
 * choose their own workspace scope are exactly the two with initial-setup
 * authority — re-exported under this name so call sites read as a setup
 * decision rather than an unexplained workspace one.
 */
export const roleCanAccessSetupWizard = roleRequiresSelection;
