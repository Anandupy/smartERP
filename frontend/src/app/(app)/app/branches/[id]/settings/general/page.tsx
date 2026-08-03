import type { Metadata } from "next";

import { BranchGeneralSettingsScreen } from "@/features/branch";

export const metadata: Metadata = {
  title: "General Settings",
};

export default async function BranchGeneralSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <BranchGeneralSettingsScreen id={id} />;
}
