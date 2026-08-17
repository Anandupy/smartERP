import type { Metadata } from "next";

import { CreateModuleScreen } from "@/features/workspace-admin";

export const metadata: Metadata = {
  title: "Create Module",
};

export default function CreateWorkspaceAdminModulePage() {
  return <CreateModuleScreen />;
}
