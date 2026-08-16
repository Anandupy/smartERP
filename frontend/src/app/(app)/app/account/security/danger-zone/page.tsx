import type { Metadata } from "next";

import { DangerZoneScreen } from "@/features/security";

export const metadata: Metadata = {
  title: "Danger Zone",
};

export default function DangerZonePage() {
  return <DangerZoneScreen />;
}
