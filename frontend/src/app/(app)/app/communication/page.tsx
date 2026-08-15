import type { Metadata } from "next";

import { CommunicationOverviewScreen } from "@/features/communication";

export const metadata: Metadata = {
  title: "Communication",
};

export default function CommunicationPage() {
  return <CommunicationOverviewScreen />;
}
