import Link from "next/link";

import { appConfig } from "@/config";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";
import { Container } from "@/shared/components/layout";

/**
 * Root landing page.
 *
 * The application proper begins at `/splash`, which resolves where a visitor
 * belongs (see `core/startup`); this page exists so the bare origin is not a
 * 404 and offers the way in.
 */
export default function Home() {
  return (
    <Container size="md" className="flex flex-1 flex-col justify-center py-16">
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm font-medium">
          {appConfig.name} ERP
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {appConfig.edition}
        </h1>
        <p className="text-muted-foreground max-w-prose text-sm">
          Administration is live: system settings, maintenance rules and the
          audit trail, inside a shell built to carry every module that follows.
        </p>
        <Button asChild>
          <Link href={ROUTES.auth.splash}>Continue to {appConfig.name}</Link>
        </Button>
      </div>
    </Container>
  );
}
