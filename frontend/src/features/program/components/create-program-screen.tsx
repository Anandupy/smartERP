"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { School } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";
import { EmptyState } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import {
  useCreateProgram,
  useProgramBranch,
  usePrograms,
} from "../hooks/use-programs";
import { toProgramRequest } from "../mappers/program.mapper";
import { programFormDefaults } from "../schemas/program.schema";
import { ProgramForm } from "./program-form";

/**
 * Create a program.
 *
 * The owning branch is taken from the active workspace — `branchId` is a
 * documented required field, and `useWorkspace()` is the single source for it.
 * Without an active branch the form does not render: it would have nothing
 * valid to submit, and an empty state that explains why is more useful than a
 * form that fails on save.
 *
 * The branch's existing programs are loaded so the parent picker can honour the
 * two documented hierarchy rules and the uniqueness rule can be checked while
 * the form is still open.
 */
export function CreateProgramScreen() {
  const router = useRouter();
  const branch = useProgramBranch();
  const create = useCreateProgram();
  const { programs } = usePrograms(branch?.id ?? null);

  if (!branch) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Create Program"
          description="A new academic vertical inside a branch."
        />
        <EmptyState
          icon={School}
          title="No active branch"
          description="A program belongs to a branch, and the branch id is a required field on the create request. Choose a branch to continue."
          action={
            <Button asChild variant="outline">
              <Link href={ROUTES.workspace.root}>Change workspace</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Program"
        description={`A new academic vertical inside ${branch.name}.`}
      />

      <ProgramForm
        defaultValues={programFormDefaults(branch.id)}
        branchName={branch.name}
        existingPrograms={programs}
        submitLabel="Create program"
        onCancel={() => router.push(ROUTES.app.programs.directory)}
        onSubmit={async (values) => {
          const created = await create.mutateAsync(toProgramRequest(values));
          // No response body is documented, so an id may not come back.
          // Falling back to the directory is correct rather than defensive:
          // pushing to `/programs/undefined` would be worse than landing on a
          // list that certainly contains the new record.
          router.push(
            created?.id
              ? ROUTES.app.programs.detail(created.id)
              : ROUTES.app.programs.directory,
          );
        }}
      />
    </div>
  );
}
