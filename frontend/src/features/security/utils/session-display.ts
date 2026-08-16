import { CircleHelp, Monitor, Smartphone, Tablet, type LucideIcon } from "@/assets/icons";
import type { AuthSessionDto } from "@/features/auth";

/**
 * Presentation helpers for `AuthSessionDto`.
 *
 * The backend's `device` field is one of exactly the buckets the controller's
 * `parseDevice()` emits (`Desktop`/`Mobile`/`Tablet`) or `null` — never a
 * richer breakdown. Nothing here parses `userAgent` into a browser/OS guess;
 * that string is shown to the user as-is (see `session-details-drawer.tsx`)
 * rather than presented as structured data the backend never returned.
 */
/** Declared once at module scope — components must never be created during render. */
const DEVICE_ICON: Record<string, LucideIcon> = {
  Desktop: Monitor,
  Mobile: Smartphone,
  Tablet: Tablet,
};

export function sessionDeviceIcon(device: string | null): LucideIcon {
  return (device && DEVICE_ICON[device]) || CircleHelp;
}

export function sessionDeviceLabel(device: string | null): string {
  return device ?? "Unknown device";
}

/** Stable sort: most recently created session first. */
export function sortSessionsByRecency(
  sessions: readonly AuthSessionDto[],
): AuthSessionDto[] {
  return [...sessions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
