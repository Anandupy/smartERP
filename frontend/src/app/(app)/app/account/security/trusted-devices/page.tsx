import type { Metadata } from "next";

import { TrustedDevicesScreen } from "@/features/security";

export const metadata: Metadata = {
  title: "Trusted Devices",
};

export default function TrustedDevicesPage() {
  return <TrustedDevicesScreen />;
}
