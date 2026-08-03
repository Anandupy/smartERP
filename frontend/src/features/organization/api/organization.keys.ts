import { createQueryKeys } from "@/core/query";

/**
 * Query keys for organizations.
 *
 * `lists()` is unparameterized because the endpoint takes no query parameters:
 * there is exactly one server-side list, and the directory filters it in the
 * browser. Keying by filters would create cache entries that all hold the same
 * response.
 */
export const organizationKeys = createQueryKeys("organizations");
