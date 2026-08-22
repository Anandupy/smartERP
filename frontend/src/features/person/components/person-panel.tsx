"use client";

import { CircleCheckBig, ShieldAlert } from "@/assets/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { DescriptionList, StatusBadge, type DescriptionItem } from "@/shared/components/data-display";
import { formatDate } from "@/utils";

import { usePerson } from "../hooks/use-person";

export interface PersonPanelProps {
  personId: string;
  /** Compact layout: status + masked government id only, no `DescriptionList` grid. Use inside space-constrained review UIs. */
  compact?: boolean;
}

/**
 * Identity verification content — never a name/contact card. Person has no
 * display attributes of its own (design spec §1); this renders only what
 * `GET /v1/persons/:id` actually documents: `dob`, the server-masked
 * government id, its type, and whether this record has been merged into
 * another (a tombstone).
 *
 * Renders no wrapper of its own (no `Card`) so it composes cleanly into
 * whatever layout the caller already has — a full `Card` in the Applicant
 * Overview tab, a plain review row inside the Admit confirmation dialog.
 *
 * Never renders a raw government id, an encrypted value or a blind-index —
 * `governmentIdMasked` is the one safe display value the backend provides.
 */
export function PersonPanel({ personId, compact = false }: PersonPanelProps) {
  const { data: person, isPending, error } = usePerson(personId);

  if (isPending) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
    );
  }

  if (error || !person) {
    return (
      <p className="text-muted-foreground text-sm">
        Identity record could not be loaded.
      </p>
    );
  }

  const isMerged = person.mergedIntoPersonId !== null;
  const statusBadge = isMerged ? (
    <StatusBadge tone="warning" icon={ShieldAlert}>
      Merged into another record
    </StatusBadge>
  ) : (
    <StatusBadge tone="success" icon={CircleCheckBig}>
      Identity linked
    </StatusBadge>
  );

  const govtId = person.governmentIdErased
    ? "Erased"
    : person.governmentIdMasked
      ? `${person.governmentIdType ?? "ID"} · ${person.governmentIdMasked}`
      : "Not on file";

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {statusBadge}
        <span className="text-muted-foreground">Government ID: {govtId}</span>
      </div>
    );
  }

  const items: DescriptionItem[] = [
    { key: "status", label: "Identity status", value: statusBadge },
    { key: "dob", label: "Date of birth", value: formatDate(person.dob) },
    { key: "govtId", label: "Government ID", value: govtId },
    {
      key: "id",
      label: "Person ID",
      value: <code className="text-xs">{person.id}</code>,
    },
  ];

  return <DescriptionList items={items} columns={2} />;
}
