import { BranchSettingsNav } from "@/features/branch";

/**
 * Layout for a branch's settings section.
 *
 * The section navigation is a property of the section, not of any one screen,
 * so it lives here and every settings page inherits it. Mirrors the System
 * Settings layout; the difference is that these routes are branch-scoped, so
 * the id is read from `params` and threaded into the nav.
 */
export default async function BranchSettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="lg:grid lg:grid-cols-[15rem_1fr] lg:gap-8">
      <BranchSettingsNav
        branchId={id}
        className="lg:sticky lg:top-20 lg:self-start"
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
