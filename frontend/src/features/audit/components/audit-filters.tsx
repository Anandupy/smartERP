"use client";

import { ArrowDown, ArrowUp } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  ACTION_OPTIONS,
  DATE_PRESETS,
  MODULE_OPTIONS,
  SORT_OPTIONS,
  type DatePreset,
} from "../constants";
import type { AuditSortField } from "../types/audit.dto";
import type { AuditFilters } from "../utils/query";

export interface AuditFiltersControlsProps {
  filters: AuditFilters;
  onChange: (next: Partial<AuditFilters>) => void;
  /**
   * Filters fixed by the surrounding screen — Settings History pins `module`,
   * for instance. Their controls are hidden rather than disabled: a control
   * that cannot be changed is clutter, and the heading already says what the
   * screen is scoped to.
   */
  locked?: ReadonlyArray<keyof AuditFilters>;
}

/**
 * The audit query controls.
 *
 * Every one maps to a documented parameter — `module`, `action`, `startDate`,
 * `sortBy`, `sortOrder` — so nothing here narrows the list in the browser.
 * Changing any of them resets to page 1, because staying on page 7 of a
 * result set that just changed shape shows the user a page that has nothing to
 * do with what they asked for.
 */
export function AuditFiltersControls({
  filters,
  onChange,
  locked = [],
}: AuditFiltersControlsProps) {
  const isLocked = (field: keyof AuditFilters) => locked.includes(field);
  const set = (next: Partial<AuditFilters>) => onChange({ ...next, page: 1 });

  return (
    <>
      {isLocked("module") ? null : (
        <Select
          value={filters.module}
          onValueChange={(module) => set({ module })}
        >
          <SelectTrigger className="w-40" aria-label="Filter by module">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODULE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {isLocked("action") ? null : (
        <Select
          value={filters.action}
          onValueChange={(action) => set({ action })}
        >
          <SelectTrigger className="w-36" aria-label="Filter by action">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select
        value={filters.datePreset}
        onValueChange={(value) => set({ datePreset: value as DatePreset })}
      >
        <SelectTrigger className="w-40" aria-label="Filter by date range">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DATE_PRESETS.map((preset) => (
            <SelectItem key={preset.value} value={preset.value}>
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1">
        <Select
          value={filters.sortBy}
          onValueChange={(value) => set({ sortBy: value as AuditSortField })}
        >
          <SelectTrigger className="w-36" aria-label="Sort by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={
            filters.sortOrder === "desc"
              ? "Sorted newest first — switch to oldest first"
              : "Sorted oldest first — switch to newest first"
          }
          onClick={() =>
            set({ sortOrder: filters.sortOrder === "desc" ? "asc" : "desc" })
          }
        >
          {filters.sortOrder === "desc" ? <ArrowDown /> : <ArrowUp />}
        </Button>
      </div>
    </>
  );
}
