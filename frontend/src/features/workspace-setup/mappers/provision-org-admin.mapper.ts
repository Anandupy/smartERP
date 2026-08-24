import type { ProvisionOrgAdminFormValues } from "../schemas/provision-org-admin.schema";
import type { CreateOrgAdminRequest } from "../types/provision-org-admin.dto";

/** Form values → `POST /users` body. Blank `organizationId` is omitted, not sent as `""`. */
export function toCreateOrgAdminRequest(
  values: ProvisionOrgAdminFormValues,
): CreateOrgAdminRequest {
  const organizationId = values.organizationId.trim();
  return {
    fullName: values.fullName.trim(),
    username: values.username.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    password: values.password,
    role: "ORG_ADMIN",
    ...(organizationId ? { organizationId } : {}),
  };
}
