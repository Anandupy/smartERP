import type { Metadata } from "next";

import { BranchAcademicSettingsScreen } from "@/features/branch";

export const metadata: Metadata = {
  title: "Academic Settings",
};

export default async function BranchAcademicSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <BranchAcademicSettingsScreen id={id} />;
}
