import type { Metadata } from "next";

import { DocumentRequirementListRoute } from "../documents-composition";

export const metadata: Metadata = {
  title: "Document Requirements",
};

export default function DocumentRequirementsPage() {
  return <DocumentRequirementListRoute />;
}
