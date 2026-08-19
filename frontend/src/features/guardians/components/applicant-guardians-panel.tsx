"use client";

import { useState } from "react";

import { Plus, Users } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/shared/components/feedback";
import { ConfirmDialog } from "@/shared/components/overlay";

import {
  useApplicantGuardians,
  useRemoveGuardianMapping,
} from "../hooks/use-guardians";
import { formatGuardianName } from "../mappers/guardian.mapper";
import type {
  ApplicantGuardianMappingDto,
  GuardianDto,
} from "../types/guardian.dto";
import { AddGuardianDialog } from "./add-guardian-dialog";
import { EditGuardianDialog } from "./edit-guardian-dialog";
import { EditGuardianMappingDialog } from "./edit-guardian-mapping-dialog";
import { GuardianMappingCard } from "./guardian-mapping-card";

export interface ApplicantGuardiansPanelProps {
  applicantId: string;
  /** Relation Type master names by id, resolved at the route composition. */
  relationTypeNames: ReadonlyMap<string, string>;
  /** The Relation Type master picker, slotted in for the add/edit dialogs. */
  relationTypePicker: React.ReactNode;
}

/**
 * The Guardians section of the Applicant Journey Hub.
 *
 * `ApplicantGuardianMapping` is the record shown here — the applicant-scoped
 * relationship, not the durable Person↔Person `Guardianship` that only
 * exists once identities resolve (module doc §5.1, §5.6). Multiple
 * guardians are fully supported; nothing here assumes exactly two.
 */
export function ApplicantGuardiansPanel({
  applicantId,
  relationTypeNames,
  relationTypePicker,
}: ApplicantGuardiansPanelProps) {
  const { mappings, isPending, error, refetch } =
    useApplicantGuardians(applicantId);
  const removeMapping = useRemoveGuardianMapping(applicantId);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingGuardian, setEditingGuardian] = useState<GuardianDto | null>(
    null,
  );
  const [editingMapping, setEditingMapping] =
    useState<ApplicantGuardianMappingDto | null>(null);
  const [removing, setRemoving] = useState<ApplicantGuardianMappingDto | null>(
    null,
  );

  if (isPending) {
    return <p className="text-muted-foreground text-sm">Loading guardians…</p>;
  }

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-destructive text-sm">
          Guardians could not be loaded.
        </p>
        <Button type="button" variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          {mappings.length} guardian{mappings.length === 1 ? "" : "s"} mapped
        </h3>
        <Button type="button" size="sm" onClick={() => setIsAddOpen(true)}>
          <Plus />
          Add guardian
        </Button>
      </div>

      {mappings.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No guardians yet"
          description="Add a parent or guardian and describe their relationship to this application."
          action={
            <Button type="button" onClick={() => setIsAddOpen(true)}>
              <Plus />
              Add guardian
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {mappings.map((mapping) => (
            <GuardianMappingCard
              key={mapping.id}
              mapping={mapping}
              relationTypeName={
                relationTypeNames.get(mapping.relationTypeId) ?? null
              }
              onEditGuardian={() =>
                mapping.guardian ? setEditingGuardian(mapping.guardian) : null
              }
              onEditMapping={() => setEditingMapping(mapping)}
              onRemove={() => setRemoving(mapping)}
            />
          ))}
        </div>
      )}

      <AddGuardianDialog
        applicantId={applicantId}
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        relationTypePicker={relationTypePicker}
      />

      <EditGuardianDialog
        guardian={editingGuardian}
        onOpenChange={(open) => {
          if (!open) setEditingGuardian(null);
        }}
      />

      <EditGuardianMappingDialog
        applicantId={applicantId}
        mapping={editingMapping}
        onOpenChange={(open) => {
          if (!open) setEditingMapping(null);
        }}
        relationTypePicker={relationTypePicker}
      />

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        destructive
        title="Remove this guardian?"
        description={
          removing?.guardian
            ? `${formatGuardianName(removing.guardian)} will no longer be mapped to this application. The guardian record itself is kept.`
            : "The guardian record itself is kept."
        }
        confirmLabel="Remove mapping"
        isPending={removeMapping.isPending}
        onConfirm={async () => {
          if (!removing) return;
          await removeMapping.mutateAsync(removing.guardianId);
          setRemoving(null);
        }}
      />
    </div>
  );
}
