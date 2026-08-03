import { SettingsNav } from "@/features/system-settings";

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
  return (
    <div className="lg:grid lg:grid-cols-[14rem_1fr] lg:gap-8">
      <SettingsNav className="lg:sticky lg:top-20 lg:self-start" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
