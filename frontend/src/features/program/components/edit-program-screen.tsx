"use client";

import { useRouter } from "next/navigation";

import { ROUTES } from "@/constants";
import { PageHeader } from "@/shared/components/layout";

import { usePrograms, useUpdateProgram } from "../hooks/use-programs";
import { toProgramFormValues, toProgramRequest } from "../mappers/program.mapper";
import type { ProgramDto } from "../types/program.dto";
import { ProgramBoundary } from "./program-boundary";
import { ProgramForm } from "./program-form";

export interface EditProgramScreenProps {
  id: string;
}

/** The form, mounted only once its record exists. */
function EditForm({
  program,
  branchId,
}: {
  program: ProgramDto;
  branchId: string;
}) {
  const router = useRouter();
  const update = useUpdateProgram(program.id);
  const { programs } = usePrograms(branchId);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit ${program.name}`}
        description="Changes take effect as soon as they are saved."
      />

      <ProgramForm
        defaultValues={toProgramFormValues(program)}
        existingPrograms={programs}
        editingId={program.id}
        submitLabel="Save changes"
        onCancel={() => router.push(ROUTES.app.programs.detail(program.id))}
        onSubmit={async (values) => {
          await update.mutateAsync(toProgramRequest(values));
          router.push(ROUTES.app.programs.detail(program.id));
        }}
      />
    </div>
  );
}

/**
 * Edit an existing program.
 *
 * The form is only mounted once the record has loaded, so `defaultValues` is
 * the real program rather than blanks that get reset a moment later —
 * resetting a form the user may already be typing into is how edits get
 * silently discarded.
 *
 * `editingId` is what keeps the parent picker honest: documented rule 3
 * prevents circular parents, so the record and every one of its descendants are
 * removed from the options.
 */
export function EditProgramScreen({ id }: EditProgramScreenProps) {
  return (
    <ProgramBoundary id={id}>
      {(program, branchId) => (
        <EditForm program={program} branchId={branchId} />
      )}
    </ProgramBoundary>
  );
}
