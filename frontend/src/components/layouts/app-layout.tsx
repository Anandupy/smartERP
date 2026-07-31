import { Container } from "@/shared/components/layout";
import { cn } from "@/lib/utils";

export interface AppLayoutProps {
  children: React.ReactNode;
  /** Sidebar navigation slot — populated by the navigation feature. */
  sidebar?: React.ReactNode;
  /** Top bar slot — search, user menu, etc. */
  header?: React.ReactNode;
  className?: string;
}

/**
 * Authenticated application shell: fixed sidebar on large screens, stacked on
 * mobile, with a sticky header and a scrollable, responsive content region.
 * Slots are injected by features; this component owns structure, not content.
 */
export function AppLayout({
  children,
  sidebar,
  header,
  className,
}: AppLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {sidebar ? (
        <aside className="border-border shrink-0 border-b lg:h-dvh lg:w-64 lg:border-r lg:border-b-0">
          {sidebar}
        </aside>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {header ? (
          <header className="border-border bg-background/80 sticky top-0 z-20 border-b backdrop-blur">
            {header}
          </header>
        ) : null}

        <main className={cn("flex-1", className)}>
          <Container className="py-4 sm:py-6 lg:py-8">{children}</Container>
        </main>
      </div>
    </div>
  );
}
