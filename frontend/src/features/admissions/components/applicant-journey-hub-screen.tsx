"use client";

import Link from "next/link";
import { useState } from "react";

import {
  CalendarDays,
  Contact,
  GraduationCap,
  Mail,
  MapPin,
  Pencil,
  Phone,
  User,
} from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES } from "@/constants";
import { useWorkspace } from "@/core/workspace";
import { DescriptionList } from "@/shared/components/data-display";
import { BackendPendingNote, EmptyState } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";
import { formatDate } from "@/utils";

import { AdmitApplicantDialog } from "./admit-applicant-dialog";
import { ApplicantIdentitySummary } from "./applicant-identity-summary";
import { ApplicantStatusBadge } from "./applicant-status-badge";
import { ApplicantWorkflowActions } from "./applicant-workflow-actions";
import { ApplicantWorkflowTimeline } from "./applicant-workflow-timeline";
import { formatApplicantAddress } from "../mappers/applicant.mapper";
import type {
  AdmitApplicantResponse,
  ApplicantDto,
} from "../types/applicant.dto";
import { isAdmitEligible, nextActionSummary } from "../utils/workflow";

export interface ApplicantJourneyHubScreenProps {
  applicant: ApplicantDto;
  /** Resolved by the route composition — Program is a separate feature. */
  programName: string | null;
  /** Slotted in for the Admit dialog's academic-unit selection — the real picker, or its empty-state. */
  academicUnitPicker: React.ReactNode;
  /**
   * Placement display path by academic-unit id, for the applicant's own
   * programme — plain data, not the AcademicUnit feature's types (AGENTS.md
   * §28). Used only after `admit()` succeeds, to show *where* the student was
   * placed ("Grade 1 → Division A") without a second read: `admit()`'s
   * response carries no placement id at all (§8.6), so this resolves the id
   * the dialog's own form submitted.
   */
  academicUnitPaths: ReadonlyMap<string, string>;
  /** The full Guardians workspace, composed at the route (features/guardians). */
  guardiansPanel: React.ReactNode;
  /** The full Documents workspace, composed at the route (features/documents). */
  documentsPanel: React.ReactNode;
  /** A short guardian summary for the Admit review, composed at the route. */
  guardianSummary: React.ReactNode;
  /** A short document-readiness summary for the Admit review, composed at the route. */
  documentsSummary: React.ReactNode;
  /** `PersonPanel` from `features/person`, slotted in by the route composition (AGENTS.md §28). */
  renderPersonPanel: (personId: string, compact?: boolean) => React.ReactNode;
}

/**
 * The Applicant Journey Hub — the central operational workspace for one
 * application: everything an administrator needs to understand this
 * applicant's lifecycle, in one place, without jumping between unrelated
 * screens.
 *
 * Four tabs, not seven — the design brief's Preferences and a dedicated
 * Audit-events tab are deliberately not built: `admit()` never reads the
 * preference list (module doc §4.9), and the general Audit Logs module is
 * not populated for Applicant mutations at all
 * (`admissions-production-audit.md`), so a tab here would either be empty or
 * duplicate the real Workflow History this screen already shows honestly.
 *
 * The identity panel shows only what the contract actually returns:
 * `personId` when present, and an honest "not yet resolved" state before
 * `SUBMIT` — never an invented "existing vs new person" indicator, since no
 * endpoint in this module returns one (`docs/admission-lifecycle-module.md`
 * §2.6, `backend-gaps.md` AP1).
 */
export function ApplicantJourneyHubScreen({
  applicant,
  programName,
  academicUnitPicker,
  academicUnitPaths,
  guardiansPanel,
  documentsPanel,
  guardianSummary,
  documentsSummary,
  renderPersonPanel,
}: ApplicantJourneyHubScreenProps) {
  const [isAdmitOpen, setIsAdmitOpen] = useState(false);
  const [admitResult, setAdmitResult] =
    useState<AdmitApplicantResponse | null>(null);
  const [placementUnitId, setPlacementUnitId] = useState<string | null>(null);
  const { academicYear } = useWorkspace();

  const canAdmit = isAdmitEligible(applicant.admissionStatus);
  const placementPath = placementUnitId
    ? (academicUnitPaths.get(placementUnitId) ?? null)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={applicant.displayName}
        description={
          applicant.applicationNo
            ? `Application ${applicant.applicationNo}`
            : "No application number yet"
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ApplicantStatusBadge status={applicant.admissionStatus} />
            {applicant.admissionStatus === "DRAFT" ? (
              <Button asChild variant="outline">
                <Link
                  href={ROUTES.app.admissions.applicants.edit(applicant.id)}
                >
                  <Pencil />
                  Edit
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {admitResult ? (
        <Card className="border-chart-2/40 bg-chart-2/5">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <GraduationCap aria-hidden="true" />
              Admission completed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-4">
            <p className="text-muted-foreground text-sm">
              {applicant.displayName} has been admitted. These identifiers
              have distinct scopes — none is interchangeable with another.
            </p>

            <div>
              <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                Student
              </h3>
              <DescriptionList
                items={[
                  { key: "studentCode", label: "Student code", value: admitResult.studentCode },
                  {
                    key: "studentId",
                    label: "Student ID",
                    value: <code className="text-xs">{admitResult.studentId}</code>,
                  },
                ]}
                columns={2}
              />
            </div>

            <div>
              <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                Admission
              </h3>
              <DescriptionList
                items={[
                  { key: "admissionNo", label: "Admission no.", value: admitResult.admissionNo },
                  {
                    key: "admissionId",
                    label: "Admission ID",
                    value: <code className="text-xs">{admitResult.admissionId}</code>,
                  },
                ]}
                columns={2}
              />
            </div>

            <div>
              <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                Enrollment
              </h3>
              <DescriptionList
                items={[
                  {
                    key: "enrollmentId",
                    label: "Enrollment ID",
                    value: <code className="text-xs">{admitResult.enrollmentId}</code>,
                  },
                ]}
                columns={2}
              />
            </div>

            <div>
              <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                Academic placement
              </h3>
              <DescriptionList
                items={[
                  { key: "program", label: "Program", value: programName ?? "—" },
                  {
                    key: "academicYear",
                    label: "Academic year",
                    value: academicYear?.name ?? "—",
                  },
                  {
                    key: "placement",
                    label: "Placement",
                    // Never the bare "Division A" — see AcademicUnitPicker.
                    // `placementUnitId` is the value this screen's own admit
                    // form submitted; a `null` here means the picker used an
                    // id this map doesn't have an entry for, not that the
                    // student has no placement.
                    value: placementPath ?? "—",
                  },
                  {
                    key: "rollNumber",
                    label: "Roll number",
                    // Left unset at admission by design — MANUAL is the only
                    // implemented policy, and inventing one here would be the
                    // exact "auto-generated number nobody can explain" the
                    // backend already refuses to do.
                    value: "Not yet assigned",
                  },
                ]}
                columns={2}
              />
            </div>

            {applicant.personId ? (
              <div>
                <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                  Person
                </h3>
                {renderPersonPanel(applicant.personId)}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              <Button asChild variant="outline" size="sm">
                <Link href={ROUTES.app.admissions.applicants.detail(applicant.id)}>
                  View applicant
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={ROUTES.app.admissions.applicants.directory}>Back to applicants</Link>
              </Button>
            </div>
            <BackendPendingNote>
              no Student, Admission or Enrollment detail screen is built into
              this frontend yet, so View Student, View Admission and View
              Enrollment have nowhere to link — the identifiers above are
              shown as returned, not as clickable destinations. The placement
              and academic-year rows above are resolved from this screen&apos;s
              own admit form and the active workspace, not from a read
              endpoint.
            </BackendPendingNote>
          </CardContent>
        </Card>
      ) : applicant.admissionStatus === "ADMITTED" ? (
        <EmptyState
          icon={GraduationCap}
          title="This application has been admitted"
          description="No Admission read endpoint is documented, so the Student/Admission/Enrollment identifiers cannot be looked up here after the fact — only shown once, right after the admit transaction completes."
        />
      ) : null}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="guardians">Guardians</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader className="border-b">
                  <CardTitle>What&apos;s next</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <p className="text-sm">
                    {nextActionSummary(applicant.admissionStatus)}
                  </p>
                  <ApplicantWorkflowActions applicant={applicant} />
                  {canAdmit ? (
                    <Button onClick={() => setIsAdmitOpen(true)}>
                      <GraduationCap />
                      Complete admission
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader className="border-b">
                  <CardTitle>Applicant</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-4 text-sm">
                  <Row icon={User} label="Program">
                    {programName ?? "—"}
                  </Row>
                  <Row icon={CalendarDays} label="Date of birth">
                    {formatDate(applicant.dob)}
                  </Row>
                  <Row icon={Phone} label="Mobile">
                    {applicant.primaryMobile}
                  </Row>
                  {applicant.primaryEmail ? (
                    <Row icon={Mail} label="Email">
                      {applicant.primaryEmail}
                    </Row>
                  ) : null}
                  <Row icon={MapPin} label="Address">
                    {formatApplicantAddress(applicant)}
                  </Row>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b">
                  <CardTitle className="flex items-center gap-2">
                    <Contact aria-hidden="true" className="size-4" />
                    Identity
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 text-sm">
                  <ApplicantIdentitySummary
                    personId={applicant.personId}
                    renderPersonPanel={renderPersonPanel}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="guardians" className="pt-4">
          {guardiansPanel}
        </TabsContent>

        <TabsContent value="documents" className="pt-4">
          {documentsPanel}
        </TabsContent>

        <TabsContent value="history" className="pt-4">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Workflow history</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <ApplicantWorkflowTimeline applicantId={applicant.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AdmitApplicantDialog
        applicant={applicant}
        open={isAdmitOpen}
        onOpenChange={setIsAdmitOpen}
        academicUnitPicker={academicUnitPicker}
        programName={programName}
        guardianSummary={guardianSummary}
        documentsSummary={documentsSummary}
        renderPersonPanel={renderPersonPanel}
        onAdmitted={(result, academicUnitId) => {
          setAdmitResult(result);
          setPlacementUnitId(academicUnitId);
        }}
      />
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof User;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon
        aria-hidden="true"
        className="text-muted-foreground mt-0.5 size-4 shrink-0"
      />
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="truncate">{children}</p>
      </div>
    </div>
  );
}
