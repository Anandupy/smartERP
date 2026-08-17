import type { Metadata } from "next";

import { MenusScreen } from "@/features/workspace-admin";

export const metadata: Metadata = {
  title: "Menu Details",
};

export default function WorkspaceAdminMenusPage() {
  return <MenusScreen />;
}
