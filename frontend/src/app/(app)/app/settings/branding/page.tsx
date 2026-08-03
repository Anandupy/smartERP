import type { Metadata } from "next";

import { BrandingScreen } from "@/features/system-settings";

export const metadata: Metadata = {
  title: "Branding & Identity",
};

export default function BrandingPage() {
  return <BrandingScreen />;
}
