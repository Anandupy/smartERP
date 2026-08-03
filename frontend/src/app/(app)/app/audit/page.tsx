import type { Metadata } from "next";

import { AuditScreen } from "@/features/audit";

export const metadata: Metadata = {
  title: "Audit Logs",
};

export default function AuditLogsPage() {
  return <AuditScreen />;
}
