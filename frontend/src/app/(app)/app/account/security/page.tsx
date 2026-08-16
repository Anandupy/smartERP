import type { Metadata } from "next";

import { SecurityDashboardScreen } from "@/features/security";

export const metadata: Metadata = {
  title: "Account & Security",
};

export default function SecurityDashboardPage() {
  return <SecurityDashboardScreen />;
}
