import type { Metadata } from "next";

import { CreateRuleScreen } from "@/features/maintenance";

export const metadata: Metadata = {
  title: "New maintenance rule",
};

export default function CreateMaintenanceRulePage() {
  return <CreateRuleScreen />;
}
