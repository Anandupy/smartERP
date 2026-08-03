import { Clock } from "@/assets/icons";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** The exact wording used everywhere, so the marker is greppable. */
export const BACKEND_PENDING_LABEL = "Backend Pending";

export interface BackendPendingBadgeProps {
  className?: string;
}

/**
 * Marks UI whose backend contract is not yet documented.
 *
 * The frontend is contract-driven: where the API documentation and Postman
 * collection record no request or response for a screen, the screen still
 * ships — laid out, validated and wired to its query hooks — but its writes
 * stay disabled rather than being invented. This badge is how that state is
 * declared to the user, and searching for `BACKEND_PENDING_LABEL` enumerates
 * every place still waiting on the backend.
 */
export function BackendPendingBadge({ className }: BackendPendingBadgeProps) {
  return (
    <Badge variant="outline" className={cn("gap-1", className)}>
      <Clock aria-hidden="true" />
      {BACKEND_PENDING_LABEL}
    </Badge>
  );
}

export interface BackendPendingNoteProps {
  /** What is missing, in the user's terms. */
  children: React.ReactNode;
  className?: string;
}

/**
 * Inline explanation beneath a disabled control, naming what the backend has
 * not yet published. Always paired with `BackendPendingBadge` on the section.
 */
export function BackendPendingNote({
  children,
  className,
}: BackendPendingNoteProps) {
  return (
    <p className={cn("text-muted-foreground text-xs", className)}>
      <span className="font-medium">{BACKEND_PENDING_LABEL}:</span> {children}
    </p>
  );
}
