"use client";

import { useRouter } from "next/navigation";

import { ROUTES } from "@/constants";
import { PageHeader } from "@/shared/components/layout";

import { useUpdateDocumentRequirement } from "../hooks/use-documents";
import { toDocumentRequirementFormValues, toDocumentRequirementUpdateRequest } from "../mappers/document-requirement.mapper";
import { DocumentRequirementBoundary } from "./document-requirement-boundary";
import { DocumentRequirementForm } from "./document-requirement-form";

export interface EditDocumentRequirementScreenProps {
  id: string;
  programPicker: React.ReactNode;
  quotaPicker: React.ReactNode;
  categoryPicker: React.ReactNode;
  stageOptions: readonly { value: string; label: string }[];
}

/** Edit a `DocumentRequirement`. Prefilled from the loaded record. */
export function EditDocumentRequirementScreen({
  id,
  programPicker,
  quotaPicker,
  categoryPicker,
  stageOptions,
}: EditDocumentRequirementScreenProps) {
  const router = useRouter();
  const update = useUpdateDocumentRequirement(id);
  const listHref = ROUTES.app.documents.requirements.root;

  return (
    <DocumentRequirementBoundary id={id}>
      {(requirement) => (
        <div className="space-y-6">
          <PageHeader title="Edit requirement" description="Update where this document is required." />

          <DocumentRequirementForm
            defaultValues={toDocumentRequirementFormValues(requirement)}
            submitLabel="Save changes"
            onCancel={() => router.push(listHref)}
            programPicker={programPicker}
            quotaPicker={quotaPicker}
            categoryPicker={categoryPicker}
            stageOptions={stageOptions}
            onSubmit={async (values) => {
              await update.mutateAsync(
                toDocumentRequirementUpdateRequest(values, requirement.branchId),
              );
              router.push(listHref);
            }}
          />
        </div>
      )}
    </DocumentRequirementBoundary>
  );
}
