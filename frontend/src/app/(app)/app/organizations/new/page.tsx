import type { Metadata } from "next";

import { CreateOrganizationScreen } from "@/features/organization";

export const metadata: Metadata = {
  title: "Create Organization",
};

export default function CreateOrganizationPage() {
  return <CreateOrganizationScreen />;
}
