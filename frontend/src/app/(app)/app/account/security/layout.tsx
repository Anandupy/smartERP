import { SecurityNav } from "@/features/security";

/**
 * Layout for the Account & Security Center. Mirrors the System Settings
 * section layout — the nav is a property of the section, not any one screen.
 */
export default function SecuritySectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="lg:grid lg:grid-cols-[16rem_1fr] lg:gap-8">
      <SecurityNav className="lg:sticky lg:top-20 lg:self-start" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
