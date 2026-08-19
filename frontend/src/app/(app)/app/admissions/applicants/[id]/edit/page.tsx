import type { Metadata } from "next";

import { EditApplicantRoute } from "../../applicant-composition";

export const metadata: Metadata = {
  title: "Edit Application",
};

/** Edit one applicant's information, with the master pickers slotted in. */
export default async function EditApplicantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditApplicantRoute id={id} />;
}
