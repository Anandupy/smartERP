"use client";

import Link from "next/link";
import { useState } from "react";

import {
  CalendarDays,
  Contact,
  Copy,
  GraduationCap,
  Mail,
  MapPin,
  Pencil,
  Phone,
  User,
} from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants";
import { DescriptionList } from "@/shared/components/data-display";
import { EmptyState } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";
import { formatDate } from "@/utils";

import { AdmitApplicantDialog } from "./admit-applicant-dialog";
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
  /** Slotted in for the Admit dialog's academic-unit selection. */
  academicUnitPicker: React.ReactNode;
}

/**
 * The Applicant Journey Hub — the central operational workspace for one
 * application, per the design brief's central goal: everything an
 * administrator needs to understand this applicant's lifecycle, in one
 * place, without jumping between unrelated screens.
 *
 * This phase ships the Overview and Workflow surfaces: status, the
 * next-action engine, every legal transition, the admission transaction, and
 * the workflow history. Guardian mappings and document governance are their
 * own, larger workspaces and are **not** built yet — see
 * `docs/backend-gaps.md` §M and the follow-up noted in this feature's
 * `index.ts`, rather than shipped here as an empty or fake tab.
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
}: ApplicantJourneyHubScreenProps) {
  const [isAdmitOpen, setIsAdmitOpen] = useState(false);
  const [admitResult, setAdmitResult] =
    useState<AdmitApplicantResponse | null>(null);

  const canAdmit = isAdmitEligible(applicant.admissionStatus);

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
          <CardContent className="pt-4">
            <p className="text-muted-foreground mb-4 text-sm">
              {applicant.displayName} has been admitted. These identifiers
              have distinct scopes — none is interchangeable with another.
            </p>
            <DescriptionList
              items={[
                {
                  key: "studentCode",
                  label: "Student code",
                  value: admitResult.studentCode,
                },
                {
                  key: "admissionNo",
                  label: "Admission no.",
                  value: admitResult.admissionNo,
                },
                { key: "enrollment", label: "Enrollment", value: "Active" },
              ]}
            />
          </CardContent>
        </Card>
      ) : applicant.admissionStatus === "ADMITTED" ? (
        <EmptyState
          icon={GraduationCap}
          title="This application has been admitted"
          description="No Admission read endpoint is documented, so the Student/Admission/Enrollment identifiers cannot be looked up here after the fact — only shown once, right after the admit transaction completes."
        />
      ) : null}

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
                  Admit applicant
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Workflow history</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <ApplicantWorkflowTimeline applicantId={applicant.id} />
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
              {applicant.personId ? (
                <div className="space-y-1">
                  <p className="text-chart-2 font-medium">Person linked</p>
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <code className="truncate">{applicant.personId}</code>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Copy person id"
                      onClick={() =>
                        navigator.clipboard.writeText(applicant.personId ?? "")
                      }
                    >
                      <Copy className="size-3" />
                    </Button>
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Not yet resolved. This applicant will be matched to an
                  existing person, or a new person will be created, when the
                  application is submitted.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AdmitApplicantDialog
        applicant={applicant}
        open={isAdmitOpen}
        onOpenChange={setIsAdmitOpen}
        academicUnitPicker={academicUnitPicker}
        onAdmitted={setAdmitResult}
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
      <Icon aria-hidden="true" className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="truncate">{children}</p>
      </div>
    </div>
  );
}
