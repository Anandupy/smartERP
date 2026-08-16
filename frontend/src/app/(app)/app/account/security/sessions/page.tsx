import type { Metadata } from "next";

import { ActiveSessionsScreen } from "@/features/security";

export const metadata: Metadata = {
  title: "Active Sessions",
};

export default function ActiveSessionsPage() {
  return <ActiveSessionsScreen />;
}
