import type { Metadata } from "next";

import { BranchDirectoryScreen } from "@/features/branch";

export const metadata: Metadata = {
  title: "Branch Directory",
};

export default function BranchDirectoryPage() {
  return <BranchDirectoryScreen />;
}
