import { Building2, CircleCheckBig, Globe, Tag } from "@/assets/icons";
import { StatCard } from "@/shared/components/data-display";
import { formatNumber } from "@/utils";

import type { NumberingConfigDto } from "../types/numbering.dto";

export interface NumberingSummaryCardsProps {
  configs: NumberingConfigDto[];
  isLoading?: boolean;
  className?: string;
}

/**
 * Summary tiles for the Numbering directory. Every figure is counted from
 * the same list already fetched for the table below — no dedicated summary
 * endpoint exists, and none is called to produce these. There is
 * deliberately no "numbers generated today/this month" or similar tile:
 * nothing in the documented contract exposes allocation counts, so no such
 * figure is shown (`docs/numbering-module.md`).
 */
export function NumberingSummaryCards({
  configs,
  isLoading = false,
  className,
}: NumberingSummaryCardsProps) {
  const total = configs.length;
  const active = configs.filter((config) => config.isActive).length;
  const branchScoped = configs.filter((config) => config.scope === "BRANCH").length;
  const organizationScoped = configs.filter((config) => config.scope === "ORGANIZATION").length;
  const purposesConfigured = new Set(configs.map((config) => config.purpose)).size;

  return (
    <div className={className ?? "grid gap-3 sm:grid-cols-2 lg:grid-cols-4"}>
      <StatCard
        icon={CircleCheckBig}
        label="Active configurations"
        value={isLoading ? "—" : formatNumber(active)}
        hint={isLoading ? undefined : `of ${formatNumber(total)} configured`}
        isLoading={isLoading}
      />
      <StatCard
        icon={Tag}
        label="Purposes configured"
        value={isLoading ? "—" : formatNumber(purposesConfigured)}
        hint="Distinct purposes with a sequence"
        isLoading={isLoading}
      />
      <StatCard
        icon={Building2}
        label="Branch scoped"
        value={isLoading ? "—" : formatNumber(branchScoped)}
        hint="Sequences numbered per branch"
        isLoading={isLoading}
      />
      <StatCard
        icon={Globe}
        label="Organization scoped"
        value={isLoading ? "—" : formatNumber(organizationScoped)}
        hint="Sequences shared org-wide"
        isLoading={isLoading}
      />
    </div>
  );
}
