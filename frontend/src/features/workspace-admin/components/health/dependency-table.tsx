"use client";

import { StatusBadge } from "@/shared/components/data-display";
import { EmptyState } from "@/shared/components/feedback";

import { mapIndicatorStatus } from "../../mappers/health.mapper";
import type { HealthCheckResultDto } from "../../types/health.dto";

export interface DependencyTableProps {
  /** `details` from `/health` — every indicator, passing and failing, keyed dynamically. */
  details: HealthCheckResultDto["details"] | null;
}

const TONE = { up: "success", down: "danger", unknown: "neutral" } as const;

/**
 * Renders whatever dependencies `/health` actually reported.
 *
 * Indicator names are not fixed — `/health` checks `database` and
 * `memoryHeap` today, `/ready` checks only `database` — so this iterates
 * `Object.entries(details)` rather than looking up fixed keys. If the backend
 * adds a `redis` or `storage` indicator tomorrow, it appears here with no
 * frontend change.
 */
export function DependencyTable({ details }: DependencyTableProps) {
  const entries = details ? Object.entries(details) : [];

  if (entries.length === 0) {
    return (
      <EmptyState
        title="No dependency details were returned"
        description="The full health probe has not succeeded yet, or reported no indicators."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border border-b text-left">
            <th className="text-muted-foreground px-3 py-2 font-medium">
              Dependency
            </th>
            <th className="text-muted-foreground px-3 py-2 font-medium">
              Status
            </th>
            <th className="text-muted-foreground px-3 py-2 font-medium">
              Details
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([name, entry]) => {
            const state = mapIndicatorStatus(entry?.status);
            const rest = Object.entries(entry ?? {}).filter(
              ([key]) => key !== "status",
            );

            return (
              <tr key={name} className="border-border/60 border-b last:border-0">
                <td className="px-3 py-2 font-medium capitalize">{name}</td>
                <td className="px-3 py-2">
                  <StatusBadge tone={TONE[state]} dot>
                    {state === "up" ? "Up" : state === "down" ? "Down" : "Unknown"}
                  </StatusBadge>
                </td>
                <td className="text-muted-foreground px-3 py-2">
                  {rest.length > 0
                    ? rest.map(([key, value]) => `${key}: ${String(value)}`).join(", ")
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
