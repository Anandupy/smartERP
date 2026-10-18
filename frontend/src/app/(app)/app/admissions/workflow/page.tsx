import type { Metadata } from "next";

import { AdmissionWorkflowSettingsScreen } from "@/features/admissions";

export const metadata: Metadata = {
  title: "Admission Workflow",
};

export default function AdmissionWorkflowPage() {
  return <AdmissionWorkflowSettingsScreen />;
}
