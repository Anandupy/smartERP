import type { Metadata } from "next";

import { EditBranchScreen } from "@/features/branch";

export const metadata: Metadata = {
  title: "Edit Branch",
};

export default async function EditBranchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <EditBranchScreen id={id} />;
}
