import type { Metadata } from "next";

import { CommunicationAnalyticsScreen } from "@/features/communication";

export const metadata: Metadata = {
  title: "Communication Analytics",
};

export default function CommunicationAnalyticsPage() {
  return <CommunicationAnalyticsScreen />;
}
