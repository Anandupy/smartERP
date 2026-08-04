import type { Metadata } from "next";

import { EditProgramScreen } from "@/features/program";

export const metadata: Metadata = {
  title: "Edit Program",
};

/** Edit one program. */
export default async function EditProgramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditProgramScreen id={id} />;
}
