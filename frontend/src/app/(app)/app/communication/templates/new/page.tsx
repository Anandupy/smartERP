import type { Metadata } from "next";

import { CreateTemplateScreen } from "@/features/communication";

export const metadata: Metadata = {
  title: "New Template",
};

export default function NewCommunicationTemplatePage() {
  return <CreateTemplateScreen />;
}
