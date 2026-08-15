"use client";

import {
  DescriptionList,
  type DescriptionItem,
} from "@/shared/components/data-display";
import { Banner } from "@/shared/components/feedback";
import { DetailDrawer } from "@/shared/components/overlay";
import { formatDateTime } from "@/utils";

import type { DeliveryLogDto } from "../../types/delivery-log.dto";
import { ChannelBadge } from "../channel-badge";
import { DeliveryStatusBadge } from "../delivery-status-badge";

export interface DeliveryLogDetailDrawerProps {
  log: DeliveryLogDto | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Delivery Log detail drawer.
 *
 * Built entirely from the row already loaded by the list — no detail
 * endpoint is documented for delivery logs (per the module spec's endpoint
 * inventory), and this module does not invent one. Every field the row
 * happens to carry is shown; nothing is fetched a second time.
 */
export function DeliveryLogDetailDrawer({
  log,
  onOpenChange,
}: DeliveryLogDetailDrawerProps) {
  if (!log) return null;

  const failed = log.status === "FAILED" || log.status === "BOUNCED";

  const items: DescriptionItem[] = [
    { key: "id", label: "Log id", value: log.id },
    { key: "channel", label: "Channel", value: <ChannelBadge channel={log.channel} /> },
    { key: "provider", label: "Provider", value: log.provider ?? "—" },
    {
      key: "status",
      label: "Status",
      value: <DeliveryStatusBadge status={log.status} />,
    },
    { key: "recipient", label: "Recipient", value: log.recipient ?? "—" },
    { key: "sender", label: "Sender", value: log.sender ?? "—" },
    { key: "subject", label: "Subject", value: log.subject ?? "—", wide: true },
    {
      key: "template",
      label: "Template",
      value: log.templateId
        ? `${log.templateId}${log.templateVersion ? ` · v${log.templateVersion}` : ""}`
        : "—",
    },
    {
      key: "latency",
      label: "Latency",
      value: typeof log.latencyMs === "number" ? `${log.latencyMs} ms` : "—",
    },
    { key: "retries", label: "Retry count", value: String(log.retryCount ?? 0) },
    {
      key: "sentAt",
      label: "Sent",
      value: log.sentAt ? formatDateTime(log.sentAt) : "—",
    },
    {
      key: "deliveredAt",
      label: "Delivered",
      value: log.deliveredAt ? formatDateTime(log.deliveredAt) : "—",
    },
    {
      key: "openedAt",
      label: "Opened",
      value: log.openedAt ? formatDateTime(log.openedAt) : "Not tracked",
    },
    {
      key: "clickedAt",
      label: "Clicked",
      value: log.clickedAt ? formatDateTime(log.clickedAt) : "Not tracked",
    },
    {
      key: "createdAt",
      label: "Recorded",
      value: log.createdAt ? formatDateTime(log.createdAt) : "—",
    },
  ];

  return (
    <DetailDrawer
      open={log !== null}
      onOpenChange={onOpenChange}
      size="wide"
      title={log.recipient ?? "Delivery log"}
      description={log.subject ?? undefined}
    >
      <div className="space-y-6">
        {failed && (log.errorCode ?? log.errorMessage) ? (
          <Banner
            tone="danger"
            title={log.errorCode ?? "Delivery failed"}
            description={log.errorMessage ?? undefined}
          />
        ) : null}

        <DescriptionList items={items} columns={2} />

        {log.metadata && Object.keys(log.metadata).length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Raw metadata</h3>
            <code className="bg-muted block rounded-lg p-3 text-xs break-all whitespace-pre-wrap">
              {JSON.stringify(log.metadata, null, 2)}
            </code>
          </section>
        ) : null}
      </div>
    </DetailDrawer>
  );
}
