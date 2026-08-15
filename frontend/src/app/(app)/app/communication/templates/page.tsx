import type { Metadata } from "next";

import { TemplatesDirectoryScreen } from "@/features/communication";

export const metadata: Metadata = {
  title: "Templates Directory",
};

export default function CommunicationTemplatesPage() {
  return <TemplatesDirectoryScreen />;
}
