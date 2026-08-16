import type { Metadata } from "next";

import { TwoFactorScreen } from "@/features/security";

export const metadata: Metadata = {
  title: "Two-Factor Authentication",
};

export default function TwoFactorPage() {
  return <TwoFactorScreen />;
}
