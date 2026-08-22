"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { FileCheck2 } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";
import { useWorkspace } from "@/core/workspace";
import { EmptyState } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import { useCreateDocumentRequirement } from "../hooks/use-documents";
import { toDocumentRequirementCreateRequest } from "../mappers/document-requirement.mapper";
import { documentRequirementFormDefaults } from "../schemas/document-requirement.schema";
import { DocumentRequirementForm } from "./document-requirement-form";

export interface CreateDocumentRequirementScreenProps {
  programPicker: React.ReactNode;
  quotaPicker: React.ReactNode;
  categoryPicker: React.ReactNode;
  stageOptions: readonly { value: string; label: string }[];
}

/** Create a `DocumentRequirement`, scoped to the active branch. */
export function CreateDocumentRequirementScreen({
  programPicker,
  quotaPicker,
  categoryPicker,
  stageOptions,
}: CreateDocumentRequirementScreenProps) {
  const router = useRouter();
  const { branch, isReady } = useWorkspace();
  const create = useCreateDocumentRequirement();
  const listHref = ROUTES.app.documents.requirements.root;

  if (isReady && !branch) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Add requirement"
          description="A new document requirement for the active branch."
        />
        <EmptyState
          icon={FileCheck2}
          title="No active branch"
          description="Document requirements are scoped to a branch. Choose a branch to continue."
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
        title="Add requirement"
        description={branch ? `A new document requirement for ${branch.name}.` : ""}
      />

      <DocumentRequirementForm
        defaultValues={documentRequirementFormDefaults()}
        submitLabel="Add requirement"
        onCancel={() => router.push(listHref)}
        programPicker={programPicker}
        quotaPicker={quotaPicker}
        categoryPicker={categoryPicker}
        stageOptions={stageOptions}
        onSubmit={async (values) => {
          if (!branch) return;
          await create.mutateAsync(toDocumentRequirementCreateRequest(values, branch.id));
          router.push(listHref);
        }}
      />
    </div>
  );
}
