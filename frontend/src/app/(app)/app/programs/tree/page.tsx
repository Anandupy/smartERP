import type { Metadata } from "next";

import { ProgramTreeScreen } from "@/features/program";

export const metadata: Metadata = {
  title: "Program Hierarchy",
};

/**
 * How a branch's programs are grouped.
 *
 * A static segment, so it takes precedence over the sibling `[id]` route — the
 * same arrangement `directory` and `new` already use.
 */
export default function ProgramTreePage() {
  return <ProgramTreeScreen />;
}
