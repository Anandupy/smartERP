import type { Metadata } from "next";

import { EditNumberingConfigScreen } from "@/features/numbering";

export const metadata: Metadata = {
  title: "Edit Sequence",
};

export default async function EditNumberingConfigPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditNumberingConfigScreen id={id} />;
}
