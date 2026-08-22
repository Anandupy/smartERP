import type { Metadata } from "next";

import { EditDocumentTypeScreen } from "@/features/documents";

export const metadata: Metadata = {
  title: "Edit Document Type",
};

export default async function EditDocumentTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditDocumentTypeScreen id={id} />;
}
