"use client";

import { useState } from "react";

import { ChevronDown, UserPlus } from "@/assets/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { SelectFieldOption } from "@/components/form";
import { cn } from "@/lib/utils";
import { SuccessState } from "@/shared/components/feedback";

import { ProvisionOrgAdminForm } from "./provision-org-admin-form";
import type { ProvisionedAdminDto } from "../types/provision-org-admin.dto";

export interface ProvisionOrgAdminPanelProps {
  organizationOptions: SelectFieldOption[];
}

/**
 * "Delegate this setup" — collapsed by default so it reads as an option, not
 * a required step. `SUPER_ADMIN` only; the welcome screen never renders this
 * for an `ORG_ADMIN`.
 *
 * The whole header is one `<button>` (Radix's own `CollapsibleTrigger`, not
 * `asChild`-wrapped around a second interactive control) — an icon button
 * nested inside a clickable header would be invalid, ambiguous markup.
 */
export function ProvisionOrgAdminPanel({
  organizationOptions,
}: ProvisionOrgAdminPanelProps) {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<ProvisionedAdminDto | null>(null);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 rounded-t-xl text-left">
          <CardHeader className="w-full flex-row items-center justify-between gap-4 space-y-0">
            <div className="flex items-center gap-2">
              <UserPlus aria-hidden="true" className="text-muted-foreground size-4" />
              <CardTitle className="text-base">
                Prefer to delegate this setup?
              </CardTitle>
            </div>
            <ChevronDown
              aria-hidden="true"
              className={cn("text-muted-foreground size-4 shrink-0 transition-transform", open && "rotate-180")}
            />
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <p className="text-muted-foreground text-sm">
              Create an organization administrator now, and they can complete
              the branch and academic year setup themselves after signing in.
            </p>
            {created ? (
              <SuccessState
                title="Administrator created"
                description={`${created.fullName} (${created.username}) can now sign in and continue setup.`}
              />
            ) : (
              <ProvisionOrgAdminForm
                organizationOptions={organizationOptions}
                onProvisioned={setCreated}
              />
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
