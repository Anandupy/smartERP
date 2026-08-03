import type { Metadata } from "next";

import { BranchIntegrationsSettingsScreen } from "@/features/branch";

export const metadata: Metadata = {
  title: "Integrations",
};

export default async function BranchIntegrationsSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <BranchIntegrationsSettingsScreen id={id} />;
}
