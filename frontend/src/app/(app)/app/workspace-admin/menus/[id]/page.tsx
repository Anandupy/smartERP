import type { Metadata } from "next";

import { MenusScreen } from "@/features/workspace-admin";

export const metadata: Metadata = {
  title: "Menu Details",
};

export default async function WorkspaceAdminMenuDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <MenusScreen initialMenuId={id} />;
}
