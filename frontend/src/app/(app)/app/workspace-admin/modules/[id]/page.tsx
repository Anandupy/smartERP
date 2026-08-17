import type { Metadata } from "next";

import { ModuleDetailScreen } from "@/features/workspace-admin";

export const metadata: Metadata = {
  title: "Module",
};

export default async function WorkspaceAdminModuleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ModuleDetailScreen id={id} />;
}
