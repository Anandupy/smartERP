import type { Metadata } from "next";

import { HealthMonitorScreen } from "@/features/workspace-admin";

export const metadata: Metadata = {
  title: "System Health",
};

export default function WorkspaceAdminHealthPage() {
  return <HealthMonitorScreen />;
}
