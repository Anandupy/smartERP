import { createQueryKeys } from "@/core/query";

const base = createQueryKeys("guardians");

export const guardianKeys = {
  ...base,
  /** Guardians mapped to one applicant. */
  byApplicant: (applicantId: string) =>
    ["guardians", "by-applicant", applicantId] as const,
  /** `GET /admissions/guardians/search?q=`. */
  search: (query: string) => ["guardians", "search", query] as const,
  /** `GET /admissions/guardianships/ward/:wardPersonId`. */
  wardGuardianships: (wardPersonId: string) =>
    ["guardianships", "ward", wardPersonId] as const,
} as const;
