import type { LucideIcon } from "@/assets/icons";
import { BackendPendingBadge, BackendPendingNote, EmptyState } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

export interface PendingScreenProps {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Disabled filter/toolbar controls, shown above the empty state. */
  filters?: React.ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  /** What the backend has not published, in the user's terms. */
  missing: React.ReactNode;
}

/**
 * Scaffold for a list-shaped screen with no backend behind it at all.
 *
 * No query, no MSW handler, no local persistence standing in for server
 * state — the layout and any filter controls render exactly as designed, all
 * of it inert, with `BackendPendingNote` naming what is missing.
 */
export function PendingScreen({
  title,
  description,
  icon,
  filters,
  emptyTitle,
  emptyDescription,
  missing,
}: PendingScreenProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        badge={<BackendPendingBadge />}
      />

      {filters ? (
        <div className="border-border flex flex-wrap items-center gap-2 rounded-xl border p-3">
          {filters}
        </div>
      ) : null}

      <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} />

      <BackendPendingNote>{missing}</BackendPendingNote>
    </div>
  );
}
