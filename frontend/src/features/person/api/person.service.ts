import { api } from "@/core/api";

import type { PersonDto } from "../types/person.dto";

/**
 * Transport for `/v1/persons`.
 *
 * Person has **no direct create API** — it is only ever created as a side
 * effect of creating an Applicant, Guardian or Employee (design spec §2 D2).
 * This module is therefore read-only: identity verification/display, never
 * identity management.
 */
export const personService = {
  /** `GET /v1/persons/:id`. */
  get: (id: string) => api.get<PersonDto>(`/persons/${id}`),
} as const;
