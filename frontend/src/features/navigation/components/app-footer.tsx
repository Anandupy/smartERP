import { appConfig } from "@/config";
import { Container } from "@/shared/components/layout";

/**
 * Shell footer: attribution and the standing legal links.
 *
 * A Server Component with no interactivity — it renders the same for everyone,
 * so it costs the client bundle nothing. Links are placeholders until the
 * public pages exist; they are marked as such rather than pointing at 404s.
 */
export function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <Container
      size="xl"
      className="text-muted-foreground flex flex-col gap-2 py-4 text-xs sm:flex-row sm:items-center sm:justify-between"
    >
      <p>
        © {year} {appConfig.name} ERP
        {appConfig.version ? ` · v${appConfig.version}` : ""}
      </p>
      <p>All rights reserved.</p>
    </Container>
  );
}
