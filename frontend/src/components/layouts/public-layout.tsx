import { Container } from "@/shared/components/layout";

export interface PublicLayoutProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Future public/marketing shell (landing pages, docs). Structure only, so the
 * public site can share the design system without pulling in app chrome.
 */
export function PublicLayout({ children, header, footer }: PublicLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      {header ? (
        <header className="border-border border-b">{header}</header>
      ) : null}
      <main className="flex-1">
        <Container>{children}</Container>
      </main>
      {footer ? (
        <footer className="border-border border-t">{footer}</footer>
      ) : null}
    </div>
  );
}
