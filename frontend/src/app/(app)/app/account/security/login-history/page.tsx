import type { Metadata } from "next";

import { LoginHistoryScreen } from "@/features/security";

export const metadata: Metadata = {
  title: "Login History",
};

export default function LoginHistoryPage() {
  return <LoginHistoryScreen />;
}
