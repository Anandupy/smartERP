"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Info } from "@/assets/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/core/auth";
import { useWorkspace } from "@/core/workspace";
import { getErrorMessage } from "@/lib";
import {
  ApiErrorState,
  Banner,
  LoadingState,
} from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";
import { cn } from "@/lib/utils";

import {
  useAdmissionPolicy,
  useClearAdmissionPolicyValue,
  useSetAdmissionPolicyValue,
} from "../hooks/use-workflow-policy";
import {
  ADMISSION_POLICY_KEYS,
  ADMISSION_WORKFLOW_PROFILES,
  type AdmissionPolicyDto,
  type AdmissionPolicyField,
  type AdmissionWorkflowProfile,
  type PolicySource,
} from "../types/workflow-policy.dto";
import { PROFILE_META } from "../utils/workflow";

/** The permission that may change admission policy (backend F2 registry). */
export const ADMISSION_POLICY_WRITE_PERMISSION = "config.admissions.write";

const SOURCE_LABEL: Record<PolicySource, string> = {
  BRANCH: "Set for this branch",
  ORGANIZATION: "From the organization",
  SYSTEM: "Platform setting",
  DEFAULT: "Default",
};

const SWITCHES: Array<{
  field: Extract<
    AdmissionPolicyField,
    | "waitlistEnabled"
    | "feeStepEnabled"
    | "documentRequestEnabled"
    | "allowDeferment"
  >;
  label: string;
  description: string;
}> = [
  {
    field: "documentRequestEnabled",
    label: "Document requests",
    description: "Reviewers can send an application back for documents.",
  },
  {
    field: "feeStepEnabled",
    label: "Fee step",
    description: "Applications can wait on an application fee before an offer.",
  },
  {
    field: "waitlistEnabled",
    label: "Waitlist",
    description: "Applications under review can be waitlisted.",
  },
  {
    field: "allowDeferment",
    label: "Deferment",
    description: "An approved applicant can defer to a later intake.",
  },
];

type Draft = Pick<
  AdmissionPolicyDto,
  | "workflowProfile"
  | "offerValidityDays"
  | "allowDeferment"
  | "waitlistEnabled"
  | "feeStepEnabled"
  | "documentRequestEnabled"
>;

const FIELDS = Object.keys(ADMISSION_POLICY_KEYS) as AdmissionPolicyField[];

/**
 * The admission workflow policy for the **active** organization and branch.
 *
 * Bound to the workspace scope on purpose: the configuration API writes to
 * the scope the request is already in and never accepts an id, so a screen
 * that let you pick some other branch would be promising something the
 * backend does not do. Switch branch in the workspace to manage another.
 *
 * Editing is offered only with `config.admissions.write`; everyone else gets
 * the same values read-only. The backend checks the permission and the
 * scope again on every write.
 */
export function AdmissionWorkflowSettingsScreen() {
  const { organization, branch } = useWorkspace();
  const { can, hasRole } = usePermissions();
  const policyQuery = useAdmissionPolicy();
  const setValue = useSetAdmissionPolicyValue();
  const clearValue = useClearAdmissionPolicyValue();

  const canEdit = can(ADMISSION_POLICY_WRITE_PERMISSION);
  const canEditOrganization = hasRole("SUPER_ADMIN") || hasRole("ORG_ADMIN");

  const [draft, setDraft] = useState<Draft | null>(null);
  const [scopeType, setScopeType] = useState<"BRANCH" | "ORGANIZATION">(
    "BRANCH",
  );
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);

  const policy = policyQuery.data;
  const values: Draft | null = draft ?? policy ?? null;

  const changed = useMemo(() => {
    if (!policy || !draft) return [] as AdmissionPolicyField[];
    return FIELDS.filter((field) => draft[field] !== policy[field]);
  }, [policy, draft]);

  if (policyQuery.isPending) {
    return <LoadingState message="Loading admission policy…" />;
  }

  if (policyQuery.error || !policy || !values) {
    return (
      <ApiErrorState
        error={policyQuery.error}
        onRetry={() => void policyQuery.refetch()}
      />
    );
  }

  const offerDaysInvalid =
    !Number.isInteger(values.offerValidityDays) ||
    values.offerValidityDays < 1 ||
    values.offerValidityDays > 365;
  const reasonMissing = reason.trim().length === 0;

  const update = <K extends keyof Draft>(field: K, value: Draft[K]) => {
    setSaveError(null);
    setDraft({ ...(draft ?? policy), [field]: value });
  };

  const save = async () => {
    if (changed.length === 0 || reasonMissing || offerDaysInvalid) return;
    setSaving(true);
    setSaveError(null);
    try {
      for (const field of changed) {
        await setValue.mutateAsync({
          key: ADMISSION_POLICY_KEYS[field],
          body: { scopeType, value: values[field], reason: reason.trim() },
        });
      }
      setDraft(null);
      setReason("");
    } catch (error) {
      setSaveError(error);
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const removeOverride = async (field: AdmissionPolicyField) => {
    if (reasonMissing) {
      setSaveError(new Error("Enter a reason before removing an override."));
      return;
    }
    try {
      await clearValue.mutateAsync({
        key: ADMISSION_POLICY_KEYS[field],
        body: { scopeType: "BRANCH", reason: reason.trim() },
      });
      setDraft(null);
    } catch (error) {
      setSaveError(error);
      toast.error(getErrorMessage(error));
    }
  };

  const badge = (field: AdmissionPolicyField) => (
    <SourceBadge
      source={policy.sources[field]}
      canRemove={canEdit && policy.sources[field] === "BRANCH"}
      disabled={saving || clearValue.isPending}
      onRemove={() => void removeOverride(field)}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admission workflow"
        description={`How applications are admitted at ${branch?.name ?? "this branch"}${organization ? `, ${organization.name}` : ""}.`}
      />

      <Banner
        tone="info"
        icon={Info}
        title="Applications already submitted keep the process they started with."
        description="A change applies to new applications and drafts. An offer keeps the deadline it was issued with."
      />

      {!canEdit ? (
        <Banner
          tone="warning"
          title="Read only"
          description="Changing the admission workflow needs the admission policy permission. Ask an organization administrator."
        />
      ) : null}

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>Process</span>
            {badge("workflowProfile")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div
            role="radiogroup"
            aria-label="Admission process"
            className="grid gap-3 md:grid-cols-3"
          >
            {ADMISSION_WORKFLOW_PROFILES.map((profile) => {
              const selected = values.workflowProfile === profile;
              return (
                <button
                  key={profile}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!canEdit}
                  onClick={() =>
                    update(
                      "workflowProfile",
                      profile as AdmissionWorkflowProfile,
                    )
                  }
                  className={cn(
                    "focus-visible:ring-ring/50 rounded-lg border p-4 text-left transition-colors outline-none focus-visible:ring-[3px] disabled:cursor-default",
                    selected
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50 border-border",
                  )}
                >
                  <span className="block text-sm font-semibold">
                    {PROFILE_META[profile].label}
                  </span>
                  <span className="text-muted-foreground mt-1 block text-sm">
                    {PROFILE_META[profile].description}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Optional steps and offer window</CardTitle>
        </CardHeader>
        <CardContent className="divide-y pt-0">
          {SWITCHES.map(({ field, label, description }) => (
            <div
              key={field}
              className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="space-y-1">
                <Label htmlFor={`policy-${field}`}>{label}</Label>
                <p className="text-muted-foreground text-sm">{description}</p>
                {badge(field)}
              </div>
              <Switch
                id={`policy-${field}`}
                checked={values[field]}
                disabled={!canEdit}
                onCheckedChange={(checked) => update(field, checked)}
              />
            </div>
          ))}
          <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <Label htmlFor="policy-offer-days">Offer stays open (days)</Label>
              <p className="text-muted-foreground text-sm">
                After this many days an unconfirmed offer is cancelled
                automatically.
              </p>
              {badge("offerValidityDays")}
            </div>
            <div className="w-full sm:w-28">
              <Input
                id="policy-offer-days"
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                value={values.offerValidityDays}
                disabled={!canEdit}
                aria-invalid={offerDaysInvalid || undefined}
                aria-describedby={
                  offerDaysInvalid ? "policy-offer-days-error" : undefined
                }
                onChange={(event) =>
                  update("offerValidityDays", Number(event.target.value))
                }
              />
              {offerDaysInvalid ? (
                <p
                  id="policy-offer-days-error"
                  className="text-destructive mt-1 text-xs"
                >
                  Enter a whole number from 1 to 365.
                </p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {canEdit ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Save changes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {canEditOrganization ? (
              <div
                role="radiogroup"
                aria-label="Apply to"
                className="flex flex-wrap gap-2"
              >
                {(["BRANCH", "ORGANIZATION"] as const).map((option) => (
                  <Button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={scopeType === option}
                    variant={scopeType === option ? "default" : "outline"}
                    onClick={() => setScopeType(option)}
                  >
                    {option === "BRANCH"
                      ? `Only ${branch?.name ?? "this branch"}`
                      : `Every branch of ${organization?.name ?? "the organization"}`}
                  </Button>
                ))}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="policy-reason">
                Reason <span className="text-destructive">(required)</span>
              </Label>
              <Textarea
                id="policy-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Why the admission process is changing…"
                maxLength={500}
              />
            </div>

            {saveError ? (
              <p className="text-destructive text-sm" role="alert">
                {getErrorMessage(saveError)}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => void save()}
                disabled={
                  saving ||
                  changed.length === 0 ||
                  reasonMissing ||
                  offerDaysInvalid
                }
              >
                {saving ? "Saving…" : "Save changes"}
              </Button>
              {changed.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDraft(null);
                    setSaveError(null);
                  }}
                  disabled={saving}
                >
                  Discard
                </Button>
              ) : (
                <span className="text-muted-foreground text-sm">
                  No changes yet.
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function SourceBadge({
  source,
  canRemove,
  disabled,
  onRemove,
}: {
  source: PolicySource;
  canRemove: boolean;
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Badge variant="outline">{SOURCE_LABEL[source]}</Badge>
      {canRemove ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={onRemove}
          disabled={disabled}
        >
          Use the organization setting
        </Button>
      ) : null}
    </span>
  );
}
