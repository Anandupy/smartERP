import Link from "next/link";

import { ROUTES } from "@/constants";
import { Button } from "@/components/ui/button";
import { Container } from "@/shared/components/layout";

/** Global 404 page. */
export default function NotFound() {
  return (
    <Container
      size="sm"
      className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center"
    >
      <p className="text-muted-foreground text-sm font-medium">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        The page you&apos;re looking for doesn&apos;t exist or may have been
        moved.
      </p>
      <Button asChild className="mt-2">
        <Link href={ROUTES.root}>Back to home</Link>
      </Button>
    </Container>
  );
}
