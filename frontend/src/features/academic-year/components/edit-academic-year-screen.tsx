"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Lock } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";
import { EmptyState } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import {
  useAcademicYears,
  useUpdateAcademicYear,
} from "../hooks/use-academic-years";
import {
  toAcademicYearFormValues,
  toAcademicYearRequest,
} from "../mappers/academic-year.mapper";
import type { AcademicYearDto } from "../types/academic-year.dto";
import { editBlockedReason } from "../utils/academic-year-lifecycle";
import { AcademicYearBoundary } from "./academic-year-boundary";
import { AcademicYearForm } from "./academic-year-form";

export interface EditAcademicYearScreenProps {
  id: string;
}

/** The form, mounted only once its record exists. */
function EditForm({
  year,
  branchId,
}: {
  year: AcademicYearDto;
  branchId: string;
}) {
  const router = useRouter();
  const update = useUpdateAcademicYear(year.id);
  const { academicYears } = useAcademicYears(branchId);
  const blocked = editBlockedReason(year);

  // Documented: "Update details (if not locked)". Opening a form whose save is
  // guaranteed to be refused would invite someone to retype a date range and
  // lose it, so the screen refuses first and explains why.
  if (blocked) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={`Edit ${year.name}`}
          description="This year can no longer be modified."
        />
        <EmptyState
          icon={Lock}
          title="This academic year is locked"
          description={blocked}
          action={
            <Button asChild variant="outline">
              <Link href={ROUTES.app.academicYears.detail(year.id)}>
                Back to details
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit ${year.name}`}
        description="Changes take effect as soon as they are saved."
      />

      <AcademicYearForm
        defaultValues={toAcademicYearFormValues(year)}
        branchName={undefined}
        existingYears={academicYears}
        editingId={year.id}
        submitLabel="Save changes"
        onCancel={() => router.push(ROUTES.app.academicYears.detail(year.id))}
        onSubmit={async (values) => {
          await update.mutateAsync(toAcademicYearRequest(values));
          router.push(ROUTES.app.academicYears.detail(year.id));
        }}
      />
    </div>
  );
}

/**
 * Edit an existing academic year.
 *
 * The form is only mounted once the record has resolved, so `defaultValues` is
 * the real year rather than blanks that get reset a moment later — resetting a
 * form the user may already be typing into is how edits get silently discarded.
 *
 * `branchId` is passed through from the boundary rather than re-read, so the
 * overlap check runs against the same branch the record was found in.
 */
export function EditAcademicYearScreen({ id }: EditAcademicYearScreenProps) {
  return (
    <AcademicYearBoundary id={id}>
      {(year, branchId) => <EditForm year={year} branchId={branchId} />}
    </AcademicYearBoundary>
  );
}
