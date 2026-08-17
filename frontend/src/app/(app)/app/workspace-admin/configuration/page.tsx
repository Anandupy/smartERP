import type { Metadata } from "next";

import { ConfigurationEditorScreen } from "@/features/workspace-admin";

export const metadata: Metadata = {
  title: "Workspace Configuration",
};

export default function WorkspaceAdminConfigurationPage() {
  return <ConfigurationEditorScreen />;
}
