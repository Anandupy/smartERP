import { SecurityNav } from "@/features/security";
import { SectionLayout } from "@/shared/components/layout";

/**
 * Layout for the Account & Security Center. Mirrors the System Settings
 * section layout — the nav is a property of the section, not any one screen.
 */
export default function SecuritySectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SectionLayout nav={<SecurityNav />}>{children}</SectionLayout>;
}
