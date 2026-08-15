import type { Metadata } from "next";

import { TemplateDetailsScreen } from "@/features/communication";

export const metadata: Metadata = {
  title: "Template",
};

export default async function CommunicationTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <TemplateDetailsScreen id={id} />;
}
