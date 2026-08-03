import type { Metadata } from "next";

import { BranchLifecycleScreen } from "@/features/branch";

export const metadata: Metadata = {
  title: "Branch Lifecycle",
};

export default async function BranchLifecyclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <BranchLifecycleScreen id={id} />;
}
