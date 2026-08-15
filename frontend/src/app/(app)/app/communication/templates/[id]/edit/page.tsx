import type { Metadata } from "next";

import { EditTemplateScreen } from "@/features/communication";

export const metadata: Metadata = {
  title: "Edit Template",
};

export default async function EditCommunicationTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <EditTemplateScreen id={id} />;
}
