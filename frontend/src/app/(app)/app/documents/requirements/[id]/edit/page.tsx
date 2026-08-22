import type { Metadata } from "next";

import { EditDocumentRequirementRoute } from "../../../documents-composition";

export const metadata: Metadata = {
  title: "Edit Document Requirement",
};

export default async function EditDocumentRequirementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditDocumentRequirementRoute id={id} />;
}
