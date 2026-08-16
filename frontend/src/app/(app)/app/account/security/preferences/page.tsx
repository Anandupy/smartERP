import type { Metadata } from "next";

import { SecurityPreferencesScreen } from "@/features/security";

export const metadata: Metadata = {
  title: "Security Preferences",
};

export default function SecurityPreferencesPage() {
  return <SecurityPreferencesScreen />;
}
