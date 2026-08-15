import { StatusBadge } from "@/shared/components/data-display";

import { deliveryStatusTone } from "../constants";

export interface DeliveryStatusBadgeProps {
  status: string | undefined;
  className?: string;
}

/**
 * Tone-mapped per the nine documented delivery states: SENT/DELIVERED
 * success, FAILED/BOUNCED destructive, PENDING/QUEUED/RETRIED neutral,
 * OPENED/CLICKED info. A value this module has never seen still renders,
 * with a neutral fallback tone rather than being hidden.
 */
export function DeliveryStatusBadge({
  status,
  className,
}: DeliveryStatusBadgeProps) {
  return (
    <StatusBadge tone={deliveryStatusTone(status)} dot className={className}>
      {status ?? "Unknown"}
    </StatusBadge>
  );
}
