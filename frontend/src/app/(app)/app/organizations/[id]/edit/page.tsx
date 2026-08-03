import type { Metadata } from "next";

import { EditOrganizationScreen } from "@/features/organization";

export const metadata: Metadata = {
  title: "Edit Organization",
};

export default async function EditOrganizationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <EditOrganizationScreen id={id} />;
}
