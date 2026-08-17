"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";
import { EmptyState } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import { admissionMasterConfig, type AdmissionMasterType } from "../config/admission-master-registry";
import { useAdmissionMastersBranch, useCreateAdmissionMaster } from "../hooks/use-admission-masters";
import { admissionMasterFormDefaults } from "../schemas/admission-master.schema";
import { AdmissionMasterForm } from "./admission-master-form";

export interface CreateAdmissionMasterScreenProps {
  masterType: AdmissionMasterType;
}

/**
 * Create a record of one admission master.
 *
 * The branch is taken from the active workspace — `x-branch-id` is a required
 * header on every request. Without an active branch the form does not render
 * at all, matching `academic-year`'s create screen.
 */
export function CreateAdmissionMasterScreen({
  masterType,
}: CreateAdmissionMasterScreenProps) {
  const config = admissionMasterConfig(masterType);
  const router = useRouter();
  const branch = useAdmissionMastersBranch();
  const create = useCreateAdmissionMaster(masterType);

  const listHref = ROUTES.app.admissionMasters.list(config.resource);

  if (!branch) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={`Create ${config.singularLabel}`}
          description={`A new ${config.singularLabel.toLowerCase()} for the active branch.`}
        />
        <EmptyState
          icon={config.icon}
          title="No active branch"
          description={`${config.pluralLabel} are scoped to a branch, and x-branch-id is a required header on every request. Choose a branch to continue.`}
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
        title={`Create ${config.singularLabel}`}
        description={`A new ${config.singularLabel.toLowerCase()} for ${branch.name}.`}
      />

      <AdmissionMasterForm
        config={config}
        defaultValues={admissionMasterFormDefaults()}
        submitLabel={`Create ${config.singularLabel.toLowerCase()}`}
        onCancel={() => router.push(listHref)}
        onSubmit={async (values) => {
          const created = await create.mutateAsync(values);
          router.push(
            created?.id
              ? ROUTES.app.admissionMasters.detail(config.resource, created.id)
              : listHref,
          );
        }}
      />
    </div>
  );
}
