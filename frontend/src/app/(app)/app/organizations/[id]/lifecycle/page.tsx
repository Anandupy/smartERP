import type { Metadata } from "next";

import { OrganizationLifecycleScreen } from "@/features/organization";

export const metadata: Metadata = {
  title: "Organization Lifecycle",
};

export default async function OrganizationLifecyclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <OrganizationLifecycleScreen id={id} />;
}
