import type { Metadata } from "next";

import { CreateDocumentRequirementRoute } from "../../documents-composition";

export const metadata: Metadata = {
  title: "Add Document Requirement",
};

export default function CreateDocumentRequirementPage() {
  return <CreateDocumentRequirementRoute />;
}
