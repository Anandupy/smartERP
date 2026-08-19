import { createQueryKeys } from "@/core/query";

import type { DocumentOwnerType } from "../types/document.dto";

const base = createQueryKeys("documents");

export const documentKeys = {
  ...base,
  byOwner: (ownerType: DocumentOwnerType, ownerId: string) =>
    ["documents", "by-owner", ownerType, ownerId] as const,
  requirements: (params: {
    programId?: string;
    quotaId?: string;
    categoryId?: string;
  }) => ["document-requirements", params] as const,
  types: () => ["document-types"] as const,
} as const;
