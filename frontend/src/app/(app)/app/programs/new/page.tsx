import type { Metadata } from "next";

import { CreateProgramScreen } from "@/features/program";

export const metadata: Metadata = {
  title: "New Program",
};

/** Create a program in the active branch. */
export default function CreateProgramPage() {
  return <CreateProgramScreen />;
}
