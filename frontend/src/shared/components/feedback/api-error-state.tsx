import {
  Lock,
  Search,
  ServerCrash,
  TriangleAlert,
  WifiOff,
  type LucideIcon,
} from "@/assets/icons";
import { isApiError } from "@/core/api";
import type { ApiErrorKind } from "@/types/api";

import { ErrorState, type ErrorStateProps } from "./error-state";

/**
 * Per-category presentation for a normalized `ApiError`.
 *
 * `title` names what went wrong in the user's terms; the description always
 * comes from `getErrorMessage`, so a server-authored explanation still wins
 * over anything guessed from the status code. `retryable` decides whether the
 * retry control is offered at all — re-running a request that was refused for
 * lack of permission only produces the same refusal.
 */
const PRESENTATION: Record<
  ApiErrorKind,
  { title: string; icon: LucideIcon; retryable: boolean }
> = {
  network: { title: "Can't reach the server", icon: WifiOff, retryable: true },
  timeout: { title: "That took too long", icon: WifiOff, retryable: true },
  canceled: { title: "Request canceled", icon: TriangleAlert, retryable: true },
  unauthorized: { title: "Your session ended", icon: Lock, retryable: false },
  forbidden: { title: "Access restricted", icon: Lock, retryable: false },
  notFound: { title: "Not found", icon: Search, retryable: false },
  validation: {
    title: "Some details need attention",
    icon: TriangleAlert,
    retryable: false,
  },
  conflict: {
    title: "That's out of date",
    icon: TriangleAlert,
    retryable: true,
  },
  rateLimit: {
    title: "Too many requests",
    icon: TriangleAlert,
    retryable: true,
  },
  server: { title: "Something went wrong", icon: ServerCrash, retryable: true },
  unknown: {
    title: "Something went wrong",
    icon: TriangleAlert,
    retryable: true,
  },
};

export interface ApiErrorStateProps extends Omit<
  ErrorStateProps,
  "icon" | "title"
> {
  /** Overrides the category's default heading. */
  title?: string;
}

/**
 * `ErrorState` driven by the failure's `ApiError.kind`.
 *
 * This is the **only** place the platform maps an error category to UI. Modules
 * render `<ApiErrorState error={query.error} onRetry={query.refetch} />` instead
 * of each re-deciding what a 403 looks like — which is how "network" and
 * "forbidden" stay visually distinct everywhere without duplicated branching.
 *
 * A non-`ApiError` value falls through to the generic treatment, so this is
 * always safe to render against an unknown thrown value.
 */
export function ApiErrorState({
  error,
  title,
  onRetry,
  ...props
}: ApiErrorStateProps) {
  const kind: ApiErrorKind = isApiError(error) ? error.kind : "unknown";
  const presentation = PRESENTATION[kind];

  return (
    <ErrorState
      error={error}
      title={title ?? presentation.title}
      icon={presentation.icon}
      onRetry={presentation.retryable ? onRetry : undefined}
      {...props}
    />
  );
}
