import type { Metadata } from "next";

import { CreateDocumentTypeScreen } from "@/features/documents";

export const metadata: Metadata = {
  title: "Create Document Type",
};

export default function CreateDocumentTypePage() {
  return <CreateDocumentTypeScreen />;
}
