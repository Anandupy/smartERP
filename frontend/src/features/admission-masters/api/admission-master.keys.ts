import { createQueryKeys, type FeatureQueryKeys } from "@/core/query";

/**
 * Query keys for one admission master resource, namespaced under
 * `admission-masters/<resource>` so each of the 10 masters' caches are fully
 * isolated — invalidating Blood Groups must never touch Castes.
 */
export function createAdmissionMasterKeys(resource: string): FeatureQueryKeys {
  return createQueryKeys(`admission-masters/${resource}`);
}
