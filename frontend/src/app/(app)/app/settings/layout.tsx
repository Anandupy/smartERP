import { SettingsNav } from "@/features/system-settings";
import { SectionLayout } from "@/shared/components/layout";

/**
 * Layout for the System Settings section.
 *
 * The section navigation is a property of the section, not of any one screen,
 * so it lives here and every settings page inherits it. It scrolls horizontally
 * above the content on small screens and becomes a left rail from `lg`, which
 * is the only structural difference between a phone and a desktop here.
 */
export default function SettingsSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SectionLayout nav={<SettingsNav />}>{children}</SectionLayout>;
}
