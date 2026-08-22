"use client";

import Link from "next/link";

import { CircleCheckBig, FileCheck2, FileText, ShieldCheck } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ROUTES } from "@/constants";
import { useWorkspace } from "@/core/workspace";
import { StatCard } from "@/shared/components/data-display";
import { EmptyState } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";
import { formatNumber } from "@/utils";

import { useDocumentRequirements, useDocumentTypes } from "../hooks/use-documents";

const DESTINATIONS = [
  {
    href: ROUTES.app.documents.types.root,
    icon: FileText,
    title: "Document Types",
    description: "The document catalogue — file rules, sensitivity, expiry and retention for every kind of document.",
  },
  {
    href: ROUTES.app.documents.requirements.root,
    icon: FileCheck2,
    title: "Document Requirements",
    description: "Which documents are required, for which programs, quotas, categories and workflow stages.",
  },
];

/**
 * The Documents hub — a navigation and configuration landing page.
 *
 * Summary tiles are derived only from data these two screens already fetch
 * for the active branch (`useDocumentTypes`, `useDocumentRequirements`);
 * nothing here calls an aggregate/count endpoint the backend does not
 * document.
 */
export function DocumentsOverviewScreen() {
  const { branch, isReady } = useWorkspace();
  const { types, isPending: typesPending } = useDocumentTypes();
  const { requirements, isPending: requirementsPending } = useDocumentRequirements();

  const isLoading = typesPending || (Boolean(branch) && requirementsPending);
  const activeRequirements = requirements.filter((requirement) => requirement.isActive);
  const mandatoryRequirements = activeRequirements.filter(
    (requirement) => requirement.isMandatory,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Configure the document catalogue and the requirements applicant, admission and enrollment workflows draw from."
      />

      {isReady && !branch ? (
        <EmptyState
          icon={FileCheck2}
          title="No active branch"
          description="Document requirements are scoped to a branch. Choose a branch to see the full picture — the document catalogue itself is still available below."
          action={
            <Button asChild variant="outline">
              <Link href={ROUTES.workspace.root}>Change workspace</Link>
            </Button>
          }
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={FileText}
          label="Document types"
          value={typesPending ? "—" : formatNumber(types.length)}
          hint="Configured for this branch"
          isLoading={typesPending}
        />
        <StatCard
          icon={CircleCheckBig}
          label="Active requirements"
          value={isLoading ? "—" : formatNumber(activeRequirements.length)}
          hint="Currently applied to checklists"
          isLoading={isLoading}
        />
        <StatCard
          icon={ShieldCheck}
          label="Mandatory requirements"
          value={isLoading ? "—" : formatNumber(mandatoryRequirements.length)}
          hint="Block a checklist until verified"
          isLoading={isLoading}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {DESTINATIONS.map((destination) => {
          const Icon = destination.icon;
          return (
            <Link key={destination.href} href={destination.href}>
              <Card className="hover:border-primary/50 h-full transition-colors">
                <CardContent className="flex items-start gap-3 pt-6">
                  <span
                    aria-hidden="true"
                    className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg"
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-foreground block truncate text-sm font-medium">
                      {destination.title}
                    </span>
                    <span className="text-muted-foreground line-clamp-2 block text-xs">
                      {destination.description}
                    </span>
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
