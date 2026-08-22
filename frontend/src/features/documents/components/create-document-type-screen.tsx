"use client";

import { useRouter } from "next/navigation";

import { ROUTES } from "@/constants";
import { PageHeader } from "@/shared/components/layout";

import { useCreateDocumentType } from "../hooks/use-documents";
import { toDocumentTypeCreateRequest } from "../mappers/document-type.mapper";
import { documentTypeFormDefaults } from "../schemas/document-type.schema";
import { DocumentTypeForm } from "./document-type-form";

/** Create a `DocumentType`. */
export function CreateDocumentTypeScreen() {
  const router = useRouter();
  const create = useCreateDocumentType();
  const listHref = ROUTES.app.documents.types.root;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create document type"
        description="A new kind of document this branch can require or accept."
      />

      <DocumentTypeForm
        defaultValues={documentTypeFormDefaults()}
        submitLabel="Create document type"
        showActiveToggle={false}
        onCancel={() => router.push(listHref)}
        onSubmit={async (values) => {
          const created = await create.mutateAsync(toDocumentTypeCreateRequest(values));
          router.push(
            created?.id
              ? ROUTES.app.documents.types.detail(created.id)
              : listHref,
          );
        }}
      />
    </div>
  );
}
