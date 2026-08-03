"use client";

import { Building2, CalendarDays, MapPin } from "@/assets/icons";
import { useWorkspace } from "@/core/workspace";
import { StatCard } from "@/shared/components/data-display";

/**
 * The three ids every request on this screen carries, shown as three tiles.
 *
 * Read from `useWorkspace()` — the same hook the API layer's header providers
 * resolve from — so what is displayed here and what is sent on the wire cannot
 * disagree. Nothing is fetched: the scope was resolved once at sign-in.
 */
export function WorkspaceScopeCards() {
  const { organization, branch, academicYear } = useWorkspace();

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        icon={Building2}
        label="Organization"
        value={organization?.name ?? "—"}
        hint={organization?.code ?? undefined}
        valueClassName="text-lg"
      />
      <StatCard
        icon={MapPin}
        label="Campus"
        value={branch?.name ?? "—"}
        hint={branch?.code ?? undefined}
        valueClassName="text-lg"
      />
      <StatCard
        icon={CalendarDays}
        label="Academic year"
        value={academicYear?.name ?? "—"}
        hint={academicYear?.code ?? undefined}
        valueClassName="text-lg"
      />
    </div>
  );
}
