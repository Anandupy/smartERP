import type { Metadata } from "next";

import { CreateApplicantRoute } from "../applicant-composition";

export const metadata: Metadata = {
  title: "New Admission",
};

/** New admission — Applicant Information, with every master picker slotted in. */
export default function NewApplicantPage() {
  return <CreateApplicantRoute />;
}
