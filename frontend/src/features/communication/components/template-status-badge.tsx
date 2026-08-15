import { StatusBadge } from "@/shared/components/data-display";

import { TEMPLATE_STATUS_LABEL, templateStatusTone } from "../constants";
import type { TemplateStatus } from "../types/template.dto";

export interface TemplateStatusBadgeProps {
  status: string | TemplateStatus | undefined;
  className?: string;
}

/** DRAFT neutral · PUBLISHED success · ARCHIVED muted (warning tone). */
export function TemplateStatusBadge({
  status,
  className,
}: TemplateStatusBadgeProps) {
  return (
    <StatusBadge tone={templateStatusTone(status)} className={className}>
      {status ? (TEMPLATE_STATUS_LABEL[status as TemplateStatus] ?? status) : "Unknown"}
    </StatusBadge>
  );
}
