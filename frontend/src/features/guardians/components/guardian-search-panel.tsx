"use client";

import { useState } from "react";

import { Search, User } from "@/assets/icons";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks";
import { Spinner } from "@/shared/components/feedback";

import { useGuardianSearch } from "../hooks/use-guardians";
import { formatGuardianName } from "../mappers/guardian.mapper";
import type { GuardianDto } from "../types/guardian.dto";

export interface GuardianSearchPanelProps {
  onSelect: (guardian: GuardianDto) => void;
}

/**
 * Search existing guardians for sibling reuse — `GET
 * /admissions/guardians/search?q=`, capped at 10 matches, and an empty query
 * never fires a request (module doc §5.6). A plain text list rather than a
 * combobox: there is no established search-and-pick pattern elsewhere in
 * this codebase to extend, and this keeps the interaction simple and fully
 * keyboard-operable without a new dependency.
 */
export function GuardianSearchPanel({ onSelect }: GuardianSearchPanelProps) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 300);
  const { results, isFetching } = useGuardianSearch(debounced);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by mobile or name…"
          aria-label="Search guardians"
          className="pl-8"
        />
      </div>

      {isFetching ? (
        <div className="flex items-center gap-2 py-4">
          <Spinner size="sm" />
          <span className="text-muted-foreground text-sm">Searching…</span>
        </div>
      ) : debounced.trim().length === 0 ? (
        <p className="text-muted-foreground py-4 text-sm">
          Search for a guardian already on record — useful for siblings who
          share a parent.
        </p>
      ) : results.length === 0 ? (
        <p className="text-muted-foreground py-4 text-sm">
          No guardian matches &ldquo;{debounced}&rdquo;.
        </p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {results.map((guardian) => (
            <li key={guardian.id}>
              <button
                type="button"
                onClick={() => onSelect(guardian)}
                className="hover:bg-accent focus-visible:ring-ring flex w-full items-center gap-3 rounded-lg p-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <User aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {formatGuardianName(guardian)}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {guardian.mobilePrimary}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
