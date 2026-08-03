"use client";

import { ScrollText, Settings, Wrench } from "@/assets/icons";
import { ROUTES } from "@/constants";
import { useAuth } from "@/core/auth";
import { LinkCard } from "@/shared/components/data-display";
import { PageHeader } from "@/shared/components/layout";

import { WorkspaceScopeCards } from "./workspace-scope-cards";

export interface DashboardScreenProps {
  /**
   * Live maintenance notice, wired at the route.
   *
   * A slot rather than an import: the maintenance module owns the query and
   * the copy, and the dashboard only decides where a system-wide notice
   * belongs — above everything, before the user starts working.
   */
  maintenanceBanner?: React.ReactNode;
}

/**
 * The landing screen for an authenticated, scoped session.
 *
 * Deliberately a small, honest surface: the scope the user is working in, a
 * system-wide notice when there is one, and the way into the modules that
 * exist. Enrolment counts, revenue tiles and trend charts wait for the
 * modules that own those numbers — a dashboard of invented figures is worse
 * than one that is briefly plain.
 */
export function DashboardScreen({ maintenanceBanner }: DashboardScreenProps) {
  const { user } = useAuth();
  const firstName = user?.name?.trim().split(/\s+/)[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        description="Everything below is scoped to the organization, campus and academic year you selected."
      />

      {maintenanceBanner}

      <WorkspaceScopeCards />

      <section className="space-y-3">
        <h2 className="text-foreground text-sm font-medium">Administration</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <LinkCard
            icon={Settings}
            title="System Settings"
            description="Product identity, environment, maintenance mode and support channels."
            href={ROUTES.app.settings.root}
          />
          <LinkCard
            icon={Wrench}
            title="Maintenance"
            description="Schedule downtime and restrict parts of the platform while work is in progress."
            href={ROUTES.app.maintenance.root}
          />
          <LinkCard
            icon={ScrollText}
            title="Audit Logs"
            description="Every configuration change, who made it, and when."
            href={ROUTES.app.audit.root}
          />
        </div>
      </section>
    </div>
  );
}
