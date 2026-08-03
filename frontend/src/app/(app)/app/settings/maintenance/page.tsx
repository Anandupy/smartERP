import type { Metadata } from "next";

import { MaintenanceSupportScreen } from "@/features/system-settings";

export const metadata: Metadata = {
  title: "Maintenance & Support",
};

export default function MaintenanceSupportPage() {
  return <MaintenanceSupportScreen />;
}
