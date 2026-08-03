"use client";

import { Download } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DescriptionList,
  type DescriptionItem,
} from "@/shared/components/data-display";
import {
  BackendPendingBadge,
  BackendPendingNote,
  Banner,
} from "@/shared/components/feedback";

import type { AuditLogQuery } from "../types/audit.dto";

export interface AuditExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The query the export would carry, shown so the scope is unambiguous. */
  query: AuditLogQuery;
  /** Records the current filters match, from the list endpoint's pagination. */
  total: number | null;
}

/**
 * Export the current audit selection.
 *
 * **Backend Pending.** The Audit Log Query API documents four read endpoints —
 * list, summary, timeline and detail — and no export among them. There is no
 * documented format, no file endpoint, and no asynchronous job to poll.
 *
 * The dialog still ships, and it does one genuinely useful thing: it states
 * exactly which records an export *would* cover, by listing the query
 * parameters currently in force. That is the part an operator needs to check
 * before exporting anything, and it is knowable today.
 *
 * Generating a CSV in the browser from the loaded page was the obvious
 * alternative and is deliberately not offered: it would export one page of a
 * result set the user believes they are exporting in full, which for an audit
 * trail is worse than exporting nothing.
 */
export function AuditExportDialog({
  open,
  onOpenChange,
  query,
  total,
}: AuditExportDialogProps) {
  const items: DescriptionItem[] = Object.entries(query)
    .filter(
      ([key, value]) =>
        value !== undefined &&
        !["page", "limit", "includeDetails"].includes(key),
    )
    .map(([key, value]) => ({
      key,
      label: key,
      value: String(value),
    }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Export audit log
            <BackendPendingBadge />
          </DialogTitle>
          <DialogDescription>
            {total === null
              ? "The current filters define the selection below."
              : `${total.toLocaleString()} records match the current filters.`}
          </DialogDescription>
        </DialogHeader>

        <Banner
          tone="info"
          icon={Download}
          title="No export endpoint is documented"
          description="The Audit Log Query API documents list, summary, timeline and detail endpoints only. Export will be wired as soon as a contract exists."
        />

        <div className="space-y-2">
          <p className="text-sm font-medium">Selection</p>
          {items.length > 0 ? (
            <DescriptionList items={items} columns={2} />
          ) : (
            <p className="text-muted-foreground text-sm">
              No filters applied — the export would cover every record within
              your access boundary.
            </p>
          )}
        </div>

        <BackendPendingNote>
          an export needs a documented endpoint, the formats it produces, and
          whether it responds with a file or a job to poll.
        </BackendPendingNote>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button type="button" disabled>
            <Download />
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
