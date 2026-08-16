import type { Metadata } from "next";

import { SecurityAuditScreen } from "@/features/security";

export const metadata: Metadata = {
  title: "Security Activity Audit",
};

export default function SecurityAuditPage() {
  return <SecurityAuditScreen />;
}
