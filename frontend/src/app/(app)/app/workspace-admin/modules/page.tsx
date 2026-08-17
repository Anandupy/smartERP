import type { Metadata } from "next";

import { ModulesScreen } from "@/features/workspace-admin";

export const metadata: Metadata = {
  title: "Navigation Modules",
};

export default function WorkspaceAdminModulesPage() {
  return <ModulesScreen />;
}
