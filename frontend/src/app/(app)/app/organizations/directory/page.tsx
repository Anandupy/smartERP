import type { Metadata } from "next";

import { OrganizationDirectoryScreen } from "@/features/organization";

export const metadata: Metadata = {
  title: "Organization Directory",
};

export default function OrganizationDirectoryPage() {
  return <OrganizationDirectoryScreen />;
}
