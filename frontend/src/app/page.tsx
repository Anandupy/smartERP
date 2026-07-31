import { appConfig } from "@/config";
import { Container } from "@/shared/components/layout";

/**
 * Minimal architecture landing placeholder. Business pages (dashboard,
 * workspace, modules) are intentionally out of scope for the platform setup.
 */
export default function Home() {
  return (
    <Container size="md" className="flex flex-1 flex-col justify-center py-16">
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm font-medium">
          {appConfig.name} ERP
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Frontend platform ready
        </h1>
        <p className="text-muted-foreground max-w-prose text-sm">
          The scalable architecture (core platform, providers, design system,
          and feature scaffolding) is in place. Feature modules can now be built
          under <code className="bg-muted rounded px-1 py-0.5">features/</code>{" "}
          without restructuring.
        </p>
      </div>
    </Container>
  );
}
