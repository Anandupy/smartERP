import type { Metadata } from "next";

import { CreateNumberingConfigScreen } from "@/features/numbering";

export const metadata: Metadata = {
  title: "New Sequence",
};

export default function CreateNumberingConfigPage() {
  return <CreateNumberingConfigScreen />;
}
