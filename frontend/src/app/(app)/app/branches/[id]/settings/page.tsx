import type { Metadata } from "next";

import { BranchSettingsDashboardScreen } from "@/features/branch";

export const metadata: Metadata = {
  title: "Branch Settings",
};

export default async function BranchSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <BranchSettingsDashboardScreen id={id} />;
}
