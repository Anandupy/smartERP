import type { Metadata } from "next";

import { ProgramDirectoryScreen } from "@/features/program";

export const metadata: Metadata = {
  title: "Program Directory",
};

/** Every program of the active branch, searchable and manageable. */
export default function ProgramDirectoryPage() {
  return <ProgramDirectoryScreen />;
}
