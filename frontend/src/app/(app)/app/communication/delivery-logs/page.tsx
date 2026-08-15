import type { Metadata } from "next";

import { DeliveryLogsScreen } from "@/features/communication";

export const metadata: Metadata = {
  title: "Delivery Logs",
};

export default function CommunicationDeliveryLogsPage() {
  return <DeliveryLogsScreen />;
}
