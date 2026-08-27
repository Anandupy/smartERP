"use client";

import { useRouter } from "next/navigation";

import { ROUTES } from "@/constants";
import { useGuide } from "@/core/guides";
import { useWorkspace } from "@/core/workspace";
import { PageHeader } from "@/shared/components/layout";

import { useCreateBranch } from "../hooks/use-branches";
import { toBranchRequest } from "../mappers/branch.mapper";
import { branchFormDefaults } from "../schemas/branch.schema";
import { BranchForm } from "./branch-form";

/**
 * Create a branch.
 *
 * The owning organization is seeded from the active workspace — the scope the
 * user is already operating in is overwhelmingly the one they mean, and
 * `useWorkspace()` is the single source for it. It stays changeable, since a
 * super-admin with several organizations may legitimately mean another.
 *
 * On success the new branch's detail screen is the destination rather than the
 * directory: the person who just created a campus is far more likely to want to
 * look at it than at the list they came from.
 */
export function CreateBranchScreen() {
  const router = useRouter();
  const create = useCreateBranch();
  const { organization } = useWorkspace();
  const guide = useGuide("branches");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Branch"
        description="The identity, classification and location of a new campus."
      />

      <BranchForm
        defaultValues={branchFormDefaults(organization?.id ?? "")}
        submitLabel="Create branch"
        submitGuideTarget="branch-create-submit"
        onCancel={() => router.push(ROUTES.app.branches.directory)}
        onSubmit={async (values) => {
          const created = await create.mutateAsync(toBranchRequest(values));
          router.push(ROUTES.app.branches.detail(created.id));
          guide.reportEvent({ entityId: created.id });
        }}
      />
    </div>
  );
}
