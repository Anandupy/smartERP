import type { Metadata } from "next";

import { CommunicationSettingsScreen } from "@/features/communication";

export const metadata: Metadata = {
  title: "Communication Settings",
};

export default function CommunicationSettingsPage() {
  return <CommunicationSettingsScreen />;
}
