"use client";

import Link from "next/link";

import { Wrench } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";
import { Banner } from "@/shared/components/feedback";

import { useSystemSettings } from "../hooks/use-system-settings";

/**
 * The installation-wide maintenance notice.
 *
 * Driven by the settings record's own `maintenanceMode` and
 * `maintenanceMessage` — both documented fields on a documented endpoint — so
 * this notice never depends on a shape that has been guessed at. The scoped
 * equivalent, which resolves whichever rule applies to the caller's own
 * organization and campus, lives in the Maintenance module and reads a
 * different (and undocumented) endpoint.
 *
 * Renders nothing while loading or on failure: an alarming banner that appears
 * a beat late, or because a request failed, is worse than no banner.
 */
export function MaintenanceModeBanner() {
  const { data: settings } = useSystemSettings();

  if (!settings?.maintenanceMode) {
    return null;
  }

  return (
    <Banner
      tone="warning"
      icon={Wrench}
      title="The system is in maintenance mode"
      description={
        settings.maintenanceMessage?.trim() ||
        "Some functionality is unavailable across the whole installation."
      }
      action={
        <Button asChild variant="outline" size="sm">
          <Link href={ROUTES.app.settings.maintenance}>Manage</Link>
        </Button>
      }
    />
  );
}
