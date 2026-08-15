"use client";

import Link from "next/link";

import {
  CheckCircle2,
  FileText,
  Mail,
  MessageSquare,
  Send,
  Settings,
  TriangleAlert,
} from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants";
import { LinkCard, StatCard } from "@/shared/components/data-display";
import { ApiErrorState, BackendPendingNote } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";
import { formatDateTime, formatNumber } from "@/utils";

import { useCommunicationScope } from "../hooks/use-communication-scope";
import { useCommunicationSettings } from "../hooks/use-communication-settings";
import { useDeliveryAnalytics } from "../hooks/use-delivery-analytics";
import { useDeliveryLogs } from "../hooks/use-delivery-logs";
import { useTemplates } from "../hooks/use-templates";
import { ChannelBadge } from "./channel-badge";
import { CommunicationNoScopeState } from "./communication-scope-gate";
import { DeliveryStatusBadge } from "./delivery-status-badge";

/**
 * Communication Overview.
 *
 * Composes four independent queries — templates, delivery analytics, recent
 * delivery logs, settings — fetched in parallel rather than sequentially, per
 * the module doc's guidance against turning the overview into an N+1 page.
 * Every figure traces to one of those four documented endpoints; nothing here
 * is a frontend aggregation.
 */
export function CommunicationOverviewScreen() {
  const scope = useCommunicationScope();

  const { templates, isPending: templatesPending, error: templatesError } =
    useTemplates({});
  const { analytics, isPending: analyticsPending, error: analyticsError } =
    useDeliveryAnalytics(scope);
  const { logs: recentLogs, isPending: logsPending } = useDeliveryLogs(
    scope
      ? { organizationId: scope.organizationId, branchId: scope.branchId, limit: 5 }
      : null,
  );
  const { data: settings, isPending: settingsPending } = useCommunicationSettings(scope);

  if (!scope) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Communication"
          description="Templates, delivery logs, analytics and settings."
        />
        <CommunicationNoScopeState />
      </div>
    );
  }

  const publishedCount = templates.filter((t) => t.status === "PUBLISHED").length;

  const channelToggles = settings
    ? ([
        ["Email", settings.emailEnabled],
        ["SMS", settings.smsEnabled],
        ["WhatsApp", settings.whatsappEnabled],
        ["Push", settings.pushEnabled],
        ["OTP", settings.otpEnabled],
      ] as const)
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communication"
        description="Templates, delivery logs, analytics and settings for the active organization and branch."
        actions={
          <Button asChild>
            <Link href={ROUTES.app.communication.sendNotification}>
              <Send />
              Send notification
            </Link>
          </Button>
        }
      />

      {templatesError ? <ApiErrorState error={templatesError} /> : null}
      {analyticsError ? <ApiErrorState error={analyticsError} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={FileText}
          label="Templates"
          value={templatesPending ? "—" : formatNumber(templates.length)}
          hint={
            templatesPending
              ? undefined
              : `${formatNumber(publishedCount)} published`
          }
          isLoading={templatesPending}
        />
        <StatCard
          icon={Mail}
          label="Sent"
          value={analyticsPending ? "—" : formatNumber(analytics?.sent ?? 0)}
          isLoading={analyticsPending}
        />
        <StatCard
          icon={CheckCircle2}
          label="Delivered"
          value={analyticsPending ? "—" : formatNumber(analytics?.delivered ?? 0)}
          isLoading={analyticsPending}
        />
        <StatCard
          icon={TriangleAlert}
          label="Failed"
          value={analyticsPending ? "—" : formatNumber(analytics?.failed ?? 0)}
          isLoading={analyticsPending}
        />
      </div>

      <BackendPendingNote>
        these figures come from the current page of each endpoint&apos;s
        response — the templates count reflects what the unpaginated list
        endpoint returned, and analytics has no date range. No time-series
        widget is shown, per the analytics endpoint&apos;s documented shape.
      </BackendPendingNote>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center justify-between gap-2">
              Channels enabled
              <Button asChild variant="ghost" size="sm">
                <Link href={ROUTES.app.communication.settings}>Settings</Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {settingsPending ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {channelToggles.map(([label, enabled]) => (
                  <li
                    key={label}
                    className="border-border flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <span>{label}</span>
                    <span
                      className={
                        enabled ? "text-chart-2 font-medium" : "text-muted-foreground"
                      }
                    >
                      {enabled ? "On" : "Off"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center justify-between gap-2">
              Recent deliveries
              <Button asChild variant="ghost" size="sm">
                <Link href={ROUTES.app.communication.deliveryLogs}>View all</Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {logsPending ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : recentLogs.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No deliveries recorded yet.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {recentLogs.slice(0, 5).map((log) => (
                  <li key={log.id} className="flex items-center gap-3 py-2.5">
                    <ChannelBadge channel={log.channel} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{log.recipient ?? "—"}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {log.createdAt ? formatDateTime(log.createdAt) : "—"}
                      </p>
                    </div>
                    <DeliveryStatusBadge status={log.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <LinkCard
            icon={FileText}
            title="Templates"
            description="Create and manage message templates."
            href={ROUTES.app.communication.templates.root}
          />
          <LinkCard
            icon={MessageSquare}
            title="Delivery logs"
            description="Every outbound message attempt."
            href={ROUTES.app.communication.deliveryLogs}
          />
          <LinkCard
            icon={TriangleAlert}
            title="Analytics"
            description="Delivery outcomes at a glance."
            href={ROUTES.app.communication.analytics}
          />
          <LinkCard
            icon={Settings}
            title="Settings"
            description="Channels, operations and default providers."
            href={ROUTES.app.communication.settings}
          />
        </CardContent>
      </Card>
    </div>
  );
}
