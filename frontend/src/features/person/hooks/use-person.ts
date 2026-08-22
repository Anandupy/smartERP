"use client";

import { useQuery } from "@tanstack/react-query";

import { personKeys } from "../api/person.keys";
import { personService } from "../api/person.service";

/** One identity record. `id` is `null` until the caller has resolved one. */
export function usePerson(id: string | null) {
  return useQuery({
    queryKey: personKeys.detail(id ?? ""),
    queryFn: () => personService.get(id ?? ""),
    enabled: Boolean(id),
    meta: { skipErrorToast: true },
  });
}
