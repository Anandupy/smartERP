import type { Metadata } from "next";

import { DocumentTypeDetailScreen } from "@/features/documents";

export const metadata: Metadata = {
  title: "Document Type",
};

export default async function DocumentTypeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DocumentTypeDetailScreen id={id} />;
}
