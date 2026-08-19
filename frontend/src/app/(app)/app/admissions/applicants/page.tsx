import type { Metadata } from "next";

import { ApplicantDirectoryScreen } from "@/features/admissions";

export const metadata: Metadata = {
  title: "Applicants",
};

export default function ApplicantsPage() {
  return <ApplicantDirectoryScreen />;
}
