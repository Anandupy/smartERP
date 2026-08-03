"use client";

import { useRouter } from "next/navigation";

import { ROUTES } from "@/constants";
import { PageHeader } from "@/shared/components/layout";

import { useUpdateBranch } from "../hooks/use-branches";
import { toBranchFormValues, toBranchRequest } from "../mappers/branch.mapper";
import { BranchBoundary } from "./branch-boundary";
import { BranchForm } from "./branch-form";

export interface EditBranchScreenProps {
  id: string;
}

/** The form, mounted only once its record exists. */
function EditForm({ id }: { id: string }) {
  const router = useRouter();
  const update = useUpdateBranch(id);

  return (
    <BranchBoundary id={id}>
      {(branch) => (
        <div className="space-y-6">
          <PageHeader
            title={`Edit ${branch.name}`}
            description="Changes take effect as soon as they are saved."
          />

          <BranchForm
            defaultValues={toBranchFormValues(branch)}
            submitLabel="Save changes"
            lockOrganization
            onCancel={() => router.push(ROUTES.app.branches.detail(branch.id))}
            onSubmit={async (values) => {
              await update.mutateAsync(toBranchRequest(values));
              router.push(ROUTES.app.branches.detail(branch.id));
            }}
          />
        </div>
      )}
    </BranchBoundary>
  );
}

/**
 * Edit an existing branch.
 *
 * The form is only mounted once the record has loaded, so `defaultValues` is
 * the real branch rather than blanks that get reset a moment later — resetting
 * a form the user may already be typing into is how edits get silently
 * discarded.
 */
export function EditBranchScreen({ id }: EditBranchScreenProps) {
  return <EditForm id={id} />;
}
