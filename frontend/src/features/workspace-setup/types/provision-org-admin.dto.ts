/**
 * Wire contract for provisioning an `ORG_ADMIN` from the setup wizard.
 *
 * This reuses the existing `POST /users` endpoint (`docs modules: none yet —
 * see `backend/docs/core/workspace-bootstrap.md` §8, which documents this
 * exact call) rather than a setup-specific identity API. Only the fields the
 * wizard sends are typed here; `CreateUserDto` also accepts `branchId`, which
 * the wizard never sets — an `ORG_ADMIN` is organization-scoped, not
 * branch-scoped.
 */
export interface CreateOrgAdminRequest {
  fullName: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  role: "ORG_ADMIN";
  organizationId?: string;
}

/** The fields the wizard shows back after a successful provisioning call. */
export interface ProvisionedAdminDto {
  id: string;
  fullName: string;
  username: string;
  email: string;
  role: string;
}
