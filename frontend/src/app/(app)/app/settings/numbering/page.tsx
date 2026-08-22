import type { Metadata } from "next";

import { NumberingConfigListScreen } from "@/features/numbering";

export const metadata: Metadata = {
  title: "Numbering",
};

export default function NumberingPage() {
  return <NumberingConfigListScreen />;
}
