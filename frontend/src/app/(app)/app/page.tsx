import type { Metadata } from "next";

import { DashboardScreen } from "@/features/dashboard";
import { MaintenanceModeBanner } from "@/features/system-settings";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * The authenticated landing page.
 *
 * Thin by rule: it names the screen and joins the two features that meet on
 * it. The dashboard owns the layout, System Settings owns the installation-wide
 * maintenance notice — wiring them here is what keeps them from importing each
 * other.
 */
export default function DashboardPage() {
  return <DashboardScreen maintenanceBanner={<MaintenanceModeBanner />} />;
}
