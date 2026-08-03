"use client";

import Link from "next/link";

import { Settings, TriangleAlert } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";
import { LinkCard } from "@/shared/components/data-display";
import { BackendPendingBadge, Banner } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import { BranchBoundary } from "../components/branch-boundary";
import type { BranchDto } from "../types/branch.dto";
import { PendingSettingsGroup } from "./pending-settings-form";
import { BRANCH_SETTINGS_SECTIONS } from "./settings-sections";

/**
 * The banner every pending settings screen opens with.
 *
 * One component so the wording is identical across four screens: the reason is
 * the same in each case, and four slightly different explanations of the same
 * gap would read as four different gaps.
 */
function NoContractBanner({ what }: { what: string }) {
  return (
    <Banner
      tone="info"
      icon={TriangleAlert}
      title="No backend contract yet"
      description={`${what} No endpoint, request body or validation is documented anywhere in the branch API, so nothing on this screen can be saved.`}
    />
  );
}

export interface BranchSettingsScreenProps {
  id: string;
}

/**
 * Branch Settings overview.
 *
 * Lists the sections and marks the four that have no contract. The section that
 * does — history — is the audit trail, and is reachable from here like any
 * other.
 */
export function BranchSettingsDashboardScreen({
  id,
}: BranchSettingsScreenProps) {
  return (
    <BranchBoundary id={id}>
      {(branch) => (
        <div className="space-y-6">
          <PageHeader
            title="Branch Settings"
            badge={<BackendPendingBadge />}
            description={`Configuration for ${branch.name}.`}
            actions={
              <Button asChild variant="outline">
                <Link href={ROUTES.app.branches.detail(branch.id)}>
                  Back to branch
                </Link>
              </Button>
            }
          />

          <Banner
            tone="info"
            icon={Settings}
            title="Branch settings have no backend module"
            description="Every documented branch endpoint operates on the branch record itself. Four of the five sections below are layout only; History is the audit trail and is fully wired."
          />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {BRANCH_SETTINGS_SECTIONS.map((section) => (
              <LinkCard
                key={section.id}
                icon={section.icon}
                title={section.label}
                description={section.description}
                href={section.href(branch.id)}
                badge={
                  section.backendPending ? <BackendPendingBadge /> : undefined
                }
              />
            ))}
          </div>
        </div>
      )}
    </BranchBoundary>
  );
}

/** Shared shell for the four sections with no contract. */
function PendingSection({
  branch,
  title,
  description,
  what,
  children,
}: {
  branch: BranchDto;
  title: string;
  description: string;
  what: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        badge={<BackendPendingBadge />}
        description={`${description} — ${branch.name}`}
      />
      <NoContractBanner what={what} />
      {children}
    </div>
  );
}

/**
 * Branch General Settings.
 *
 * The branch's own name, code, contact and address **are** editable — through
 * the branch record, on the Edit Branch screen. What this screen shows is the
 * per-branch operational configuration the design calls for, none of which the
 * branch entity carries: local branding, working hours, holiday calendar and
 * regional formatting.
 */
export function BranchGeneralSettingsScreen({ id }: BranchSettingsScreenProps) {
  return (
    <BranchBoundary id={id}>
      {(branch) => (
        <PendingSection
          branch={branch}
          title="General Settings"
          description="Profile, local branding and operational windows"
          what="Branch identity, contact and address are editable on the branch record itself; the operational settings below are not."
        >
          <Banner
            tone="info"
            title="Looking for name, code, contact or address?"
            description="Those are fields on the branch record and can be changed now."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href={ROUTES.app.branches.edit(branch.id)}>
                  Edit branch
                </Link>
              </Button>
            }
          />

          <PendingSettingsGroup
            title="Local branding"
            description="Assets shown to users of this branch, overriding the organization's."
            fields={[
              { label: "Display name", placeholder: "North Campus" },
              { label: "Short name", placeholder: "NC" },
              {
                label: "Branch logo URL",
                placeholder: "https://…",
                wide: true,
              },
            ]}
            missing="the branch record carries a single logoUrl and no
              branch-level branding fields."
          />

          <PendingSettingsGroup
            title="Regional"
            description="How dates, times and currency are presented for this branch."
            fields={[
              { label: "Time zone", kind: "select" },
              { label: "Locale", kind: "select" },
              { label: "Date format", kind: "select" },
              { label: "Currency", kind: "select" },
            ]}
            missing="the branch entity has no timezone, locale, date-format or
              currency field. Only the organization record carries timezone and
              currency."
          />

          <PendingSettingsGroup
            title="Working hours"
            description="Operational windows, shift management and the holiday calendar."
            fields={[
              { label: "Opening time", placeholder: "08:00" },
              { label: "Closing time", placeholder: "16:30" },
              { label: "Working days", kind: "select" },
              { label: "Holiday calendar", kind: "select" },
              {
                label: "Operational notes",
                kind: "textarea",
                wide: true,
              },
            ]}
            missing="no working-hours, shift or holiday-calendar contract exists."
          />
        </PendingSection>
      )}
    </BranchBoundary>
  );
}

/**
 * Branch Academic Settings.
 *
 * Structure mode **is** a documented field and is editable on the branch
 * record; everything else the design shows — grading systems, semester cycles,
 * attendance policy — has no contract.
 */
export function BranchAcademicSettingsScreen({
  id,
}: BranchSettingsScreenProps) {
  return (
    <BranchBoundary id={id}>
      {(branch) => (
        <PendingSection
          branch={branch}
          title="Academic Settings"
          description="Curriculum structure, grading and attendance"
          what="Structure mode is a documented field on the branch record; the academic configuration below is not."
        >
          <Banner
            tone="info"
            title="Structure mode is editable"
            description="DEFAULT or CUSTOM is a documented field on the branch, and governs whether programs and sections are defined manually."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href={ROUTES.app.branches.edit(branch.id)}>
                  Edit branch
                </Link>
              </Button>
            }
          />

          <PendingSettingsGroup
            title="Grading"
            description="How results are recorded and reported for this branch."
            fields={[
              { label: "Grading system", kind: "select" },
              { label: "Passing threshold", placeholder: "40" },
              { label: "Grade scale", kind: "select" },
              {
                label: "Round up marks",
                kind: "switch",
                description:
                  "Round fractional marks to the nearest whole number.",
              },
            ]}
            missing="no grading contract exists on the branch or anywhere else in
              the documented API."
          />

          <PendingSettingsGroup
            title="Academic cycle"
            description="Term structure and session boundaries for this branch."
            fields={[
              { label: "Cycle type", kind: "select", placeholder: "Semester" },
              { label: "Terms per year", placeholder: "2" },
              { label: "Session start month", kind: "select" },
            ]}
            missing="academic years are their own module with their own endpoints;
              no branch-level cycle configuration is documented."
          />

          <PendingSettingsGroup
            title="Attendance"
            description="Biometric integration, leave policies and late-arrival rules."
            fields={[
              { label: "Attendance mode", kind: "select" },
              { label: "Minimum attendance %", placeholder: "75" },
              { label: "Late-arrival grace (minutes)", placeholder: "15" },
              {
                label: "Biometric integration",
                kind: "switch",
                description: "Record attendance from a biometric device.",
              },
            ]}
            missing="no attendance module or contract is documented."
          />
        </PendingSection>
      )}
    </BranchBoundary>
  );
}

/**
 * Branch Communication & Security.
 *
 * A communication module exists in the backend documentation, but it is
 * organization-wide and has no branch-scoped settings endpoint — so nothing
 * here can be wired to it without inventing the scoping.
 */
export function BranchCommunicationSettingsScreen({
  id,
}: BranchSettingsScreenProps) {
  return (
    <BranchBoundary id={id}>
      {(branch) => (
        <PendingSection
          branch={branch}
          title="Communication & Security"
          description="Gateways, notification protocols and access controls"
          what="A communication module is documented, but it has no branch-scoped settings endpoint."
        >
          <PendingSettingsGroup
            title="Communication"
            description="Email and SMS delivery for this branch."
            fields={[
              { label: "Email gateway", kind: "select" },
              { label: "SMS provider", kind: "select" },
              { label: "Sender name", placeholder: "North Campus" },
              { label: "Reply-to address", placeholder: "no-reply@…" },
              {
                label: "Push notifications",
                kind: "switch",
                description: "Send in-app and mobile push notifications.",
              },
            ]}
            missing="the communication module's settings endpoint is
              organization-wide; no branch-scoped variant is documented."
          />

          <PendingSettingsGroup
            title="Security"
            description="Sign-in and data-protection policy for this branch."
            fields={[
              {
                label: "Single sign-on",
                kind: "switch",
                description: "Require SSO for staff accounts at this branch.",
              },
              { label: "IP allowlist", kind: "textarea", wide: true },
              { label: "Session timeout (minutes)", placeholder: "30" },
              { label: "Encryption standard", kind: "select" },
            ]}
            missing="no SSO, IP-allowlist, session-policy or encryption contract
              is documented at any scope."
          />
        </PendingSection>
      )}
    </BranchBoundary>
  );
}

/**
 * Branch Integrations.
 *
 * Shown by the design alongside the other settings sections; nothing in the
 * documented API describes an integration, a key or a webhook.
 */
export function BranchIntegrationsSettingsScreen({
  id,
}: BranchSettingsScreenProps) {
  return (
    <BranchBoundary id={id}>
      {(branch) => (
        <PendingSection
          branch={branch}
          title="Integrations"
          description="External systems connected to this branch"
          what="No integration, credential or webhook contract exists."
        >
          <PendingSettingsGroup
            title="Connected systems"
            description="Third-party systems this branch exchanges data with."
            fields={[
              { label: "LMS provider", kind: "select" },
              { label: "LMS sync frequency", kind: "select" },
              { label: "Finance API key", placeholder: "••••••••" },
              {
                label: "Webhook endpoint",
                placeholder: "https://…",
                wide: true,
              },
            ]}
            missing="no integrations endpoint, credential store or webhook
              registry is documented."
          />
        </PendingSection>
      )}
    </BranchBoundary>
  );
}
