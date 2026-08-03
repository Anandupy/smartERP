import type { Metadata } from "next";

import { BranchCommunicationSettingsScreen } from "@/features/branch";

export const metadata: Metadata = {
  title: "Communication & Security",
};

export default async function BranchCommunicationSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <BranchCommunicationSettingsScreen id={id} />;
}
