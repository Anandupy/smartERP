import { createQueryKeys } from "@/core/query";

import type { DocumentOwnerType } from "../types/document.dto";

const base = createQueryKeys("documents");

export const documentKeys = {
  ...base,
  byOwner: (ownerType: DocumentOwnerType, ownerId: string) =>
    ["documents", "by-owner", ownerType, ownerId] as const,
  requirements: (branchId: string) =>
    ["document-requirements", { branchId }] as const,
  requirement: (id: string) => ["document-requirements", id] as const,
  types: (includeInactive: boolean) =>
    ["document-types", { includeInactive }] as const,
  type: (id: string) => ["document-types", id] as const,
} as const;
