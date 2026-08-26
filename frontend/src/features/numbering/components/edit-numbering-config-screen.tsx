"use client";

import { useRouter } from "next/navigation";

import { Eye, Hash, Info } from "@/assets/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants";
import { ApiErrorState, EmptyState, FormSkeleton } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";
import { DescriptionList, StatusBadge, type DescriptionItem } from "@/shared/components/data-display";

import {
  ALLOCATION_MODE_LABEL,
  RESET_STRATEGY_LABEL,
  SCOPE_LABEL,
  purposeLabel,
} from "../constants";
import { useNumberingConfig, useUpdateNumberingConfig } from "../hooks/use-numbering";
import { toNumberingConfigFormValues, toUpdateNumberingConfigRequest } from "../mappers/numbering.mapper";
import type { NumberingConfigDto } from "../types/numbering.dto";
import { FormatBreakdown } from "./format-breakdown";
import { NumberingConfigForm } from "./numbering-config-form";
import { NumberingPreviewPanel } from "./numbering-preview-panel";

export interface EditNumberingConfigScreenProps {
  id: string;
}

/** Read-only "what this sequence is" summary — purpose, status, and the format it renders. */
function ConfigurationSummary({ config }: { config: NumberingConfigDto }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Hash aria-hidden="true" className="size-4" />
          {purposeLabel(config.purpose)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Status
          </span>
          <StatusBadge tone={config.isActive ? "success" : "neutral"} dot>
            {config.isActive ? "Active" : "Inactive"}
          </StatusBadge>
        </div>
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Format
          </p>
          <code className="bg-muted block w-fit rounded px-2 py-1 text-sm">{config.format}</code>
        </div>
        <FormatBreakdown
          format={config.format}
          prefix={config.prefix}
          suffix={config.suffix}
          sequencePadding={config.sequencePadding}
          yearFormat={config.yearFormat}
        />
      </CardContent>
    </Card>
  );
}

/**
 * `scope`, `allocationMode` and `resetStrategy` — derived server-side from
 * `purpose` and never form fields (`docs/numbering-module.md`). Shown here,
 * read-only, so the user understands "I select the purpose; CampusFlow
 * determines the system-level numbering behavior" rather than wondering why
 * no input exists for them.
 */
function SystemBehavior({ config }: { config: NumberingConfigDto }) {
  const items: DescriptionItem[] = [
    { key: "scope", label: "Scope", value: SCOPE_LABEL[config.scope] ?? config.scope },
    {
      key: "allocation",
      label: "Allocation",
      value: ALLOCATION_MODE_LABEL[config.allocationMode] ?? config.allocationMode,
    },
    {
      key: "reset",
      label: "Reset",
      value: RESET_STRATEGY_LABEL[config.resetStrategy] ?? config.resetStrategy,
    },
  ];

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Info aria-hidden="true" className="size-4" />
          System behavior
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <p className="text-muted-foreground mb-4 text-xs">
          Determined automatically from Purpose. Not editable here.
        </p>
        <DescriptionList items={items} columns={3} />
      </CardContent>
    </Card>
  );
}

/**
 * Edit a `NumberingConfig`. Resolved out of the list read — no `GET /:id`
 * is documented for this resource (the same pattern Academic Year's
 * missing detail read established, AGENTS.md §28). Since there is no
 * separate detail route either, this screen doubles as the configuration's
 * detail view: a read-only summary, system behavior, the editable form, and
 * an embedded Preview — all in one place.
 */
export function EditNumberingConfigScreen({ id }: EditNumberingConfigScreenProps) {
  const router = useRouter();
  const { config, isPending, error, refetch } = useNumberingConfig(id);
  const update = useUpdateNumberingConfig(id);
  const listHref = ROUTES.app.settings.numbering.root;

  if (isPending) {
    return <FormSkeleton fields={6} label="Loading sequence" />;
  }

  if (error) {
    return <ApiErrorState error={error} onRetry={() => refetch()} />;
  }

  if (!config) {
    return (
      <EmptyState
        icon={Hash}
        title="Sequence not found"
        description="It is not in this scope's list — it may belong to a different branch, or the id is wrong."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Edit sequence" description={purposeLabel(config.purpose)} />

      <ConfigurationSummary config={config} />
      <SystemBehavior config={config} />

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Eye aria-hidden="true" className="size-4" />
            Preview
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <NumberingPreviewPanel config={config} />
        </CardContent>
      </Card>

      <NumberingConfigForm
        defaultValues={toNumberingConfigFormValues(config)}
        submitLabel="Save changes"
        purposeEditable={false}
        onCancel={() => router.push(listHref)}
        onSubmit={async (values) => {
          await update.mutateAsync(toUpdateNumberingConfigRequest(values));
          router.push(listHref);
        }}
      />
    </div>
  );
}
