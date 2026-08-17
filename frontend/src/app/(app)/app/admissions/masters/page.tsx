import type { Metadata } from "next";

import { AdmissionMastersOverviewScreen } from "@/features/admission-masters";

export const metadata: Metadata = {
  title: "Admission Masters",
};

export default function AdmissionMastersPage() {
  return <AdmissionMastersOverviewScreen />;
}
