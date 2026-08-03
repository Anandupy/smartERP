"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  DescriptionList,
  StatusBadge,
  type DescriptionItem,
} from "@/shared/components/data-display";
import { ApiErrorState, FormSkeleton } from "@/shared/components/feedback";
import { DetailDrawer } from "@/shared/components/overlay";
import { formatDateTime } from "@/utils";

import { actionTone } from "../constants";
import { useAuditLog } from "../hooks/use-audit-logs";
import type { AuditChange, AuditLogDto } from "../types/audit.dto";

export interface AuditDetailDrawerProps {
  /** The row that was opened, or `null` when the drawer is closed. */
  log: AuditLogDto | null;
  onOpenChange: (open: boolean) => void;
}

/** A JSON-ish value, rendered readably without pretending to know its type. */
function renderValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return (
    <code className="bg-muted block rounded p-2 text-xs break-all whitespace-pre-wrap">
      {JSON.stringify(value, null, 2)}
    </code>
  );
}

/** The documented field-level diff, one row per changed field. */
function ChangeList({ changes }: { changes: AuditChange[] }) {
  return (
    <ul className="space-y-2">
      {changes.map((change, index) => (
        <li key={`${change.field}-${index}`}>
          <Card size="sm">
            <CardContent className="space-y-2">
              <p className="text-sm font-medium">{change.field}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs tracking-wide uppercase">
                    Before
                  </p>
                  <div className="text-sm">{renderValue(change.oldValue)}</div>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs tracking-wide uppercase">
                    After
                  </p>
                  <div className="text-sm">{renderValue(change.newValue)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

/**
 * One audit record in full.
 *
 * The row already carries the summary fields, so the drawer re-fetches by id —
 * that is the only endpoint documented to include `metadata` and `changes`,
 * which list rows omit unless `includeDetails=true`. Fetching the heavy columns
 * for one record on demand is cheaper than fetching them for every row on the
 * chance one gets opened.
 *
 * Fields the backend may not return (severity, status, duration, trace ids) are
 * rendered only when present, rather than as a column of em dashes that implies
 * the backend reported nothing when it was never asked.
 */
export function AuditDetailDrawer({
  log,
  onOpenChange,
}: AuditDetailDrawerProps) {
  const { data, isPending, error, refetch } = useAuditLog(log?.id ?? null);

  // The row is shown immediately; the fetched record replaces it once it lands.
  const record = data ?? log;

  const items: DescriptionItem[] = record
    ? [
        { key: "event", label: "Event", value: record.eventName },
        {
          key: "action",
          label: "Action",
          value: (
            <StatusBadge tone={actionTone(record.action)}>
              {record.action}
            </StatusBadge>
          ),
        },
        { key: "module", label: "Module", value: record.module },
        {
          key: "entity",
          label: "Entity",
          value: `${record.aggregateType} · ${record.aggregateId}`,
        },
        {
          key: "actor",
          label: "Changed by",
          value: record.userEmail ?? record.userId ?? "System",
        },
        { key: "role", label: "Role", value: record.role ?? "—" },
        {
          key: "timestamp",
          label: "When",
          value: formatDateTime(record.timestamp),
        },
        {
          key: "requestId",
          label: "Request id",
          value: record.requestId ?? "—",
        },
        { key: "ip", label: "IP address", value: record.ipAddress ?? "—" },
        ...(record.severity
          ? [{ key: "severity", label: "Severity", value: record.severity }]
          : []),
        ...(record.status
          ? [{ key: "status", label: "Status", value: record.status }]
          : []),
        ...(record.executionTime !== null && record.executionTime !== undefined
          ? [
              {
                key: "duration",
                label: "Duration",
                value: `${record.executionTime} ms`,
              },
            ]
          : []),
        ...(record.route
          ? [
              {
                key: "route",
                label: "Route",
                value: `${record.httpMethod ?? ""} ${record.route}`.trim(),
                wide: true,
              },
            ]
          : []),
        ...(record.userAgent
          ? [
              {
                key: "userAgent",
                label: "User agent",
                value: record.userAgent,
                wide: true,
              },
            ]
          : []),
      ]
    : [];

  return (
    <DetailDrawer
      open={log !== null}
      onOpenChange={onOpenChange}
      size="wide"
      title={record?.eventName ?? "Audit record"}
      description={
        record
          ? `${record.module} · ${formatDateTime(record.timestamp)}`
          : undefined
      }
    >
      {error ? (
        <ApiErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <div className="space-y-6">
          <DescriptionList items={items} columns={2} />

          {isPending ? <FormSkeleton fields={2} withSubmit={false} /> : null}

          {data?.changes && data.changes.length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Field changes</h3>
              <ChangeList changes={data.changes} />
            </section>
          ) : null}

          {data?.metadata && Object.keys(data.metadata).length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Event payload</h3>
              <code className="bg-muted block rounded-lg p-3 text-xs break-all whitespace-pre-wrap">
                {JSON.stringify(data.metadata, null, 2)}
              </code>
            </section>
          ) : null}
        </div>
      )}
    </DetailDrawer>
  );
}
