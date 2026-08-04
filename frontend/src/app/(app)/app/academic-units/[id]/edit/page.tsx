import type { Metadata } from "next";

import { EditAcademicUnitRoute } from "../../program-composition";

export const metadata: Metadata = {
  title: "Edit Academic Unit",
};

/** Edit one academic unit, with the program selector slotted in. */
export default async function EditAcademicUnitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditAcademicUnitRoute id={id} />;
}
