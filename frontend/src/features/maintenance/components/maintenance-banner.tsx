"use client";

import { ExternalLink, Wrench } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Banner, type BannerTone } from "@/shared/components/feedback";

export interface MaintenanceBannerProps {
  title: string | null;
  message: string | null;
  /** Scope label ("Global", "Campus"), shown before the message. */
  scopeLabel?: string | null;
  /** Documented `customPage` — a public URL with the full details. */
  detailsHref?: string | null;
  /**
   * The rule's `severity`. The backend documents no value set, so anything
   * other than the one recorded sample is treated as neutral information
   * rather than mapped to a colour this component made up.
   */
  severity?: string | null;
  className?: string;
}

/**
 * How a maintenance rule reads to the people it affects.
 *
 * One component for both places a rule is announced — the live notice and the
 * editor's preview — so what an operator previews is literally what users get.
 *
 * Tone deliberately does **not** branch on `severity`: `"INFO"` is the only
 * value the contract records, and inventing a `CRITICAL`/`WARNING` ladder would
 * mean colouring real notices by a scale the backend never agreed to. Every
 * maintenance notice is a warning; the copy carries the rest.
 */
export function MaintenanceBanner({
  title,
  message,
  scopeLabel,
  detailsHref,
  severity,
  className,
}: MaintenanceBannerProps) {
  const tone: BannerTone = "warning";
  const heading = title?.trim() || "Maintenance in progress";

  const description = [scopeLabel, message?.trim(), severity?.trim()]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  return (
    <Banner
      tone={tone}
      icon={Wrench}
      title={heading}
      description={description || "Some parts of the platform are unavailable."}
      className={className}
      action={
        detailsHref ? (
          <Button asChild variant="outline" size="sm">
            <a href={detailsHref} target="_blank" rel="noreferrer noopener">
              Details
              <ExternalLink />
            </a>
          </Button>
        ) : undefined
      }
    />
  );
}
