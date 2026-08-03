import { SidebarInset } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Container } from "@/shared/components/layout";

import { AppShellProvider } from "./app-shell-provider";

export interface AppLayoutProps {
  children: React.ReactNode;
  /**
   * Sidebar navigation slot — a `<Sidebar>` supplied by the navigation
   * feature. Rendered outside the content column so it can collapse to a rail
   * on desktop and become a drawer below `tablet`.
   */
  sidebar?: React.ReactNode;
  /** Top bar slot — breadcrumbs, search, workspace switcher, user menu. */
  header?: React.ReactNode;
  /** Footer slot pinned below the content. */
  footer?: React.ReactNode;
  /** Widens or narrows the content column. Defaults to the standard cap. */
  size?: React.ComponentProps<typeof Container>["size"];
  className?: string;
}

/**
 * Authenticated application shell: sidebar, sticky header, scrollable content.
 *
 * Structure only — every piece of navigation is injected, which is what lets
 * one shell serve all 100+ ERP screens without knowing about any of them. The
 * responsive behaviour lives in the `Sidebar` primitive: a collapsible rail
 * from `tablet` up, an overlay drawer below it, so there is no fixed layout
 * width anywhere between 320 and 1920px.
 *
 * Stays a Server Component; the interactive seam is `AppShellProvider`.
 */
export function AppLayout({
  children,
  sidebar,
  header,
  footer,
  size = "xl",
  className,
}: AppLayoutProps) {
  return (
    <AppShellProvider>
      {sidebar}

      <SidebarInset className="min-w-0">
        {header ? (
          <header className="border-border bg-background/85 sticky top-0 z-20 border-b backdrop-blur">
            {header}
          </header>
        ) : null}

        <main className={cn("flex-1", className)}>
          <Container size={size} className="py-4 sm:py-6 lg:py-8">
            {children}
          </Container>
        </main>

        {footer ? (
          <footer className="border-border border-t">{footer}</footer>
        ) : null}
      </SidebarInset>
    </AppShellProvider>
  );
}
