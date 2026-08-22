import type { Metadata } from "next";

import { DocumentTypeListScreen } from "@/features/documents";

export const metadata: Metadata = {
  title: "Document Types",
};

export default function DocumentTypesPage() {
  return <DocumentTypeListScreen />;
}
