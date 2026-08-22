import type { Metadata } from "next";

import { DocumentsOverviewScreen } from "@/features/documents";

export const metadata: Metadata = {
  title: "Documents",
};

export default function DocumentsPage() {
  return <DocumentsOverviewScreen />;
}
