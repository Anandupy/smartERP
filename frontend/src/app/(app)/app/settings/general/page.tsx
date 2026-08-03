import type { Metadata } from "next";

import { GeneralSettingsScreen } from "@/features/system-settings";

export const metadata: Metadata = {
  title: "General Settings",
};

export default function GeneralSettingsPage() {
  return <GeneralSettingsScreen />;
}
