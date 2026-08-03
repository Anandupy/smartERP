import type { Metadata } from "next";

import { MaintenanceScreen } from "@/features/maintenance";

export const metadata: Metadata = {
  title: "Maintenance",
};

export default function MaintenancePage() {
  return <MaintenanceScreen />;
}
