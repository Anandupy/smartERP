"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { School } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";
import { Banner, EmptyState } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import {
  useAcademicYearBranch,
  useAcademicYears,
  useCreateAcademicYear,
} from "../hooks/use-academic-years";
import { toAcademicYearRequest } from "../mappers/academic-year.mapper";
import { academicYearFormDefaults } from "../schemas/academic-year.schema";
import { AcademicYearForm } from "./academic-year-form";

/**
 * Create an academic year.
 *
 * The owning branch is taken from the active workspace — `branchId` is a
 * documented required field, and `useWorkspace()` is the single source for it.
 * Without an active branch the form does not render at all: it would have
 * nothing valid to submit, and an empty state that explains why is more useful
 * than a form that fails on save.
 *
 * The branch's existing years are loaded so the documented no-overlap rule can
 * be checked while the form is still open. That check is advisory — see the
 * schema — and the banner it produces says so.
 *
 * Creating the **first** year for a branch is a special case the backend
 * documents: it is auto-activated and auto-selected. The screen says so up
 * front, because it means the very first creation silently changes the branch's
 * current working year, and a user who did not expect that would have no way to
 * undo it — there is no deselect endpoint.
 */
export function CreateAcademicYearScreen() {
  const router = useRouter();
  const branch = useAcademicYearBranch();
  const create = useCreateAcademicYear();
  const { academicYears, isPending } = useAcademicYears(branch?.id ?? null);

  if (!branch) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Create Academic Year"
          description="The name and date range of a new administrative timeframe."
        />
        <EmptyState
          icon={School}
          title="No active branch"
          description="An academic year belongs to a branch, and the branch id is a required field on the create request. Choose a branch to continue."
          action={
            <Button asChild variant="outline">
              <Link href={ROUTES.workspace.root}>Change workspace</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const isFirstYear = !isPending && academicYears.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Academic Year"
        description={`A new administrative timeframe for ${branch.name}.`}
      />

      {isFirstYear ? (
        <Banner
          tone="info"
          title="This will become the branch's current year"
          description="The backend documents that the first academic year created for a branch is automatically set as both active and selected. There is no endpoint that deselects a year, so this takes effect immediately and cannot be undone from here."
        />
      ) : null}

      <AcademicYearForm
        defaultValues={academicYearFormDefaults(branch.id)}
        branchName={branch.name}
        existingYears={academicYears}
        submitLabel="Create academic year"
        onCancel={() => router.push(ROUTES.app.academicYears.directory)}
        onSubmit={async (values) => {
          const created = await create.mutateAsync(
            toAcademicYearRequest(values),
          );
          // No response body is documented, so an id may not come back. Falling
          // back to the directory is correct rather than defensive: pushing to
          // `/academic-years/undefined` would be worse than landing on a list
          // that certainly contains the new record.
          router.push(
            created?.id
              ? ROUTES.app.academicYears.detail(created.id)
              : ROUTES.app.academicYears.directory,
          );
        }}
      />
    </div>
  );
}
