import type { Metadata } from "next";

import { EditModuleScreen } from "@/features/workspace-admin";

export const metadata: Metadata = {
  title: "Edit Module",
};

export default async function EditWorkspaceAdminModulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <EditModuleScreen id={id} />;
}
