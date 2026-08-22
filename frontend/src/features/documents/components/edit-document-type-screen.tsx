"use client";

import { useRouter } from "next/navigation";

import { ROUTES } from "@/constants";
import { PageHeader } from "@/shared/components/layout";

import { useUpdateDocumentType } from "../hooks/use-documents";
import { toDocumentTypeFormValues, toDocumentTypeUpdateRequest } from "../mappers/document-type.mapper";
import { DocumentTypeBoundary } from "./document-type-boundary";
import { DocumentTypeForm } from "./document-type-form";

export interface EditDocumentTypeScreenProps {
  id: string;
}

/** Edit a `DocumentType`. Prefilled from the loaded record. */
export function EditDocumentTypeScreen({ id }: EditDocumentTypeScreenProps) {
  const router = useRouter();
  const update = useUpdateDocumentType(id);
  const detailHref = ROUTES.app.documents.types.detail(id);

  return (
    <DocumentTypeBoundary id={id}>
      {(type) => (
        <div className="space-y-6">
          <PageHeader title="Edit document type" description={type.name} />

          <DocumentTypeForm
            defaultValues={toDocumentTypeFormValues(type)}
            submitLabel="Save changes"
            onCancel={() => router.push(detailHref)}
            onSubmit={async (values) => {
              await update.mutateAsync(toDocumentTypeUpdateRequest(values));
              router.push(detailHref);
            }}
          />
        </div>
      )}
    </DocumentTypeBoundary>
  );
}
