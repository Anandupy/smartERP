import type { Metadata } from "next";

import { EditAcademicYearScreen } from "@/features/academic-year";

export const metadata: Metadata = {
  title: "Edit Academic Year",
};

/**
 * Edit one academic year.
 *
 * The screen refuses to open the form for a locked year: the update endpoint is
 * documented as "Update details (if not locked)", so the save is guaranteed to
 * be refused.
 */
export default async function EditAcademicYearPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditAcademicYearScreen id={id} />;
}
