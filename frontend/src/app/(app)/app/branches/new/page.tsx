import type { Metadata } from "next";

import { CreateBranchScreen } from "@/features/branch";

export const metadata: Metadata = {
  title: "Create Branch",
};

export default function CreateBranchPage() {
  return <CreateBranchScreen />;
}
