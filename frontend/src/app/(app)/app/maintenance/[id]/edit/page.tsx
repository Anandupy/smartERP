import type { Metadata } from "next";

import { EditRuleScreen } from "@/features/maintenance";

export const metadata: Metadata = {
  title: "Edit maintenance rule",
};

/**
 * Edit one rule.
 *
 * `params` is a promise in the App Router and is awaited here, in the Server
 * Component, so the client screen receives a plain id rather than having to
 * unwrap it.
 */
export default async function EditMaintenanceRulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <EditRuleScreen ruleId={id} />;
}
