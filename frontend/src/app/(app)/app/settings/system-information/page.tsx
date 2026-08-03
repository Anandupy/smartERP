import type { Metadata } from "next";

import { SystemInformationScreen } from "@/features/system-settings";

export const metadata: Metadata = {
  title: "System Information",
};

export default function SystemInformationPage() {
  return <SystemInformationScreen />;
}
