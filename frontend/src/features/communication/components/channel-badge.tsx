import { StatusBadge } from "@/shared/components/data-display";

import { CHANNEL_ICON, channelLabel } from "../constants";
import type { CommunicationChannel } from "../types/template.dto";

export interface ChannelBadgeProps {
  channel: string | CommunicationChannel | undefined;
  className?: string;
}

/**
 * Icon + label per `CommunicationChannel`. Neutral tone throughout — the
 * channel is a category, not a state, so it carries no success/danger
 * meaning the way a status badge does.
 */
export function ChannelBadge({ channel, className }: ChannelBadgeProps) {
  const Icon = channel
    ? CHANNEL_ICON[channel as CommunicationChannel]
    : undefined;

  return (
    <StatusBadge tone="neutral" icon={Icon} className={className}>
      {channelLabel(channel)}
    </StatusBadge>
  );
}
