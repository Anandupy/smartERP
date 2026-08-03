import type { Metadata } from "next";

import { SystemSettingsScreen } from "@/features/system-settings";

export const metadata: Metadata = {
  title: "System Settings",
};

export default function SystemSettingsPage() {
  return <SystemSettingsScreen />;
}
