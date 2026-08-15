import type { Metadata } from "next";

import { SendNotificationScreen } from "@/features/communication";

export const metadata: Metadata = {
  title: "Send Notification",
};

export default function SendCommunicationNotificationPage() {
  return <SendNotificationScreen />;
}
