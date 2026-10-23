"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  CircleAlert,
  CircleCheckBig,
  ExternalLink,
  LoaderCircle,
  Pencil,
  Save,
  Trash2,
  Upload,
} from "@/assets/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/constants";
import { getErrorMessage } from "@/lib";
import { PageHeader } from "@/shared/components/layout";

import { applicantKeys } from "../api/applicant.keys";
import { applicantService } from "../api/applicant.service";
import { useBulkScan, type ScannedForm } from "../hooks/use-bulk-scan";
import { toApplicantRequest } from "../mappers/applicant.mapper";
import type { AdmissionOcrResult } from "../schemas/admission-ocr.schema";
import type { ApplicantFormValues } from "../schemas/applicant.schema";
import {
  applicantFromScan,
  type ResolveOcrMasters,
} from "../utils/scan-to-form";
import { ApplicantForm, type ApplicantFormProps } from "./applicant-form";

export type BulkImportScreenProps = {
  resolveOcrMasters?: ResolveOcrMasters;
  /** Adds the scanned parents as guardians — supplied by the route (see A1). */
  addScannedGuardians?: (
    applicantId: string,
    scan: AdmissionOcrResult,
  ) => Promise<string[]>;
} & Pick<
  ApplicantFormProps,
  | "programPicker"
  | "genderPicker"
  | "religionPicker"
  | "castePicker"
  | "categoryPicker"
  | "motherTonguePicker"
  | "bloodGroupPicker"
  | "disabilityTypePicker"
  | "admissionSourcePicker"
  | "quotaPicker"
>;

type RowStatus = "ready" | "check" | "saving" | "saved" | "error";

interface Row {
  form: ScannedForm;
  name: string;
  values: ApplicantFormValues | null;
  issues: string[];
  status: RowStatus;
  applicantId?: string;
}

const UNCERTAIN_LABELS: Record<string, string> = {
  dob: "date of birth",
  aadhaarNo: "Aadhaar",
  primaryMobile: "mobile",
  pincode: "PIN code",
  primaryEmail: "email",
  currentAddressLine1: "address",
};

const STATUS_BADGE: Record<
  RowStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  ready: { label: "Ready", variant: "default" },
  check: { label: "Needs check", variant: "outline" },
  saving: { label: "Saving…", variant: "secondary" },
  saved: { label: "Saved", variant: "secondary" },
  error: { label: "Error", variant: "destructive" },
};

/**
 * Bulk admission entry: upload one PDF holding many filled forms, and every
 * student appears in a review queue as soon as it has been read.
 *
 * A student is **Ready** when every required field was read and nothing is
 * doubtful — those can be saved together. Anything else is **Needs check**
 * with the reasons listed, and is saved after the clerk reviews it in the
 * normal applicant form. Each save also adds the parents as guardians.
 */
export function BulkImportScreen({
  resolveOcrMasters,
  addScannedGuardians,
  ...pickers
}: BulkImportScreenProps) {
  const scan = useBulkScan();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState<
    Record<number, { applicantId?: string; error?: string; saving?: boolean }>
  >({});
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [reviewing, setReviewing] = useState<Row | null>(null);
  const [savingAll, setSavingAll] = useState(false);

  const rows: Row[] = useMemo(
    () =>
      scan.forms
        .filter((form) => !removed.has(form.index))
        .map((form) => {
          const state = saved[form.index];
          if (!form.result) {
            return {
              form,
              name: "—",
              values: null,
              issues: [form.error ?? "Could not be read"],
              status: "error" as const,
            };
          }
          const { values, unmatched, defaulted, missing } = applicantFromScan(
            form.result,
            resolveOcrMasters,
          );
          const doubtful = form.result.uncertainFields
            .filter((field) => field !== "not_an_admission_form")
            .map((field) => UNCERTAIN_LABELS[field] ?? field);
          const issues = [
            ...missing.map((field) => `Missing: ${field}`),
            ...unmatched.map((label) => `Select: ${label}`),
            ...defaulted.map((note) => `Default used: ${note}`),
            ...(doubtful.length ? [`Check: ${doubtful.join(", ")}`] : []),
          ];
          const status: RowStatus = state?.saving
            ? "saving"
            : state?.applicantId
              ? "saved"
              : state?.error
                ? "error"
                : missing.length === 0 && issues.length === 0
                  ? "ready"
                  : "check";
          return {
            form,
            name:
              [values.firstName, values.middleName, values.lastName]
                .filter(Boolean)
                .join(" ") || "—",
            values,
            issues: state?.error ? [state.error, ...issues] : issues,
            status,
            applicantId: state?.applicantId,
          };
        }),
    [scan.forms, saved, removed, resolveOcrMasters],
  );

  const readyRows = rows.filter((row) => row.status === "ready");
  const savedCount = rows.filter((row) => row.status === "saved").length;

  /** Saves one student (and their guardians); returns the error, if any. */
  async function save(
    row: Row,
    values: ApplicantFormValues,
  ): Promise<string | null> {
    const index = row.form.index;
    setSaved((s) => ({ ...s, [index]: { saving: true } }));
    try {
      const created = await applicantService.create(toApplicantRequest(values));
      setSaved((s) => ({ ...s, [index]: { applicantId: created.id } }));
      if (row.form.result && addScannedGuardians) {
        const notices = await addScannedGuardians(
          created.id,
          row.form.result,
        ).catch(() => [
          `${row.name}: the parents could not be added as guardians.`,
        ]);
        for (const notice of notices) toast.warning(notice);
      }
      return null;
    } catch (error) {
      const message = getErrorMessage(error);
      setSaved((s) => ({ ...s, [index]: { error: message } }));
      return message;
    }
  }

  async function saveAllReady() {
    setSavingAll(true);
    let ok = 0;
    // One at a time: the backend numbers applications in sequence.
    for (const row of readyRows)
      if (row.values && (await save(row, row.values)) === null) ok++;
    await queryClient.invalidateQueries({ queryKey: applicantKeys.lists() });
    setSavingAll(false);
    toast.success(`${ok} of ${readyRows.length} applicants saved as drafts.`);
  }

  const reading = scan.status === "reading";
  const percent = scan.totalPages
    ? Math.round((scan.page / scan.totalPages) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk admission entry"
        description="Upload one PDF containing many filled admission forms. Each student is read, checked and listed for review — nothing is saved until you save it."
        actions={
          <Button asChild variant="outline">
            <Link href={ROUTES.app.admissions.applicants.directory}>
              Back to applicants
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>1. Upload the PDF</CardTitle>
          <CardDescription>
            Scan the whole bundle into one PDF (2 pages per student, 200–300
            dpi). Digital PDFs are read in seconds; paper scans take about 10
            seconds per student.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <button
            type="button"
            disabled={reading}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files?.[0];
              if (file) {
                setSaved({});
                setRemoved(new Set());
                void scan.start(file);
              }
            }}
            className="border-input hover:border-primary hover:bg-muted/40 flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload
              aria-hidden="true"
              className="text-muted-foreground size-6"
            />
            <span className="text-sm font-medium">
              Click to upload, or drop the PDF here
            </span>
            <span className="text-muted-foreground text-xs">
              One PDF · up to 40 MB · up to 80 pages
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) {
                setSaved({});
                setRemoved(new Set());
                void scan.start(file);
              }
            }}
          />

          {scan.status !== "idle" ? (
            <div className="space-y-2" aria-live="polite">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  {reading ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  ) : null}
                  {reading
                    ? `Reading page ${scan.page} of ${scan.totalPages || "…"} — ${scan.forms.length} students found`
                    : `${scan.fileName}: ${scan.forms.length} students found`}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {reading ? `${percent}%` : null}
                </span>
              </div>
              {reading ? <Progress value={percent} /> : null}
              {scan.skippedPages.length > 0 ? (
                <p className="text-muted-foreground text-xs">
                  Skipped pages {scan.skippedPages.join(", ")} — not part of an
                  admission form.
                </p>
              ) : null}
            </div>
          ) : null}

          {scan.error ? (
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>Couldn&apos;t read the PDF</AlertTitle>
              <AlertDescription>{scan.error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {rows.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b">
            <div>
              <CardTitle>2. Review and save</CardTitle>
              <CardDescription>
                {readyRows.length} ready ·{" "}
                {rows.filter((r) => r.status === "check").length} need a check ·{" "}
                {savedCount} saved
              </CardDescription>
            </div>
            <Button
              type="button"
              disabled={readyRows.length === 0 || savingAll || reading}
              onClick={() => void saveAllReady()}
            >
              {savingAll ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <Save aria-hidden="true" />
              )}
              Save all ready ({readyRows.length})
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Date of birth</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>What to check</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const badge = STATUS_BADGE[row.status];
                  return (
                    <TableRow key={row.form.index}>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {row.form.index}
                        <span className="block text-xs">
                          p. {row.form.pages.join("–")}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="tabular-nums">
                        {row.values?.dob || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>
                          {row.status === "saved" ? (
                            <CircleCheckBig aria-hidden="true" />
                          ) : null}
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md text-xs whitespace-normal">
                        {row.issues.length
                          ? row.issues.join(" · ")
                          : "Nothing — all fields read clearly."}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {row.status === "saved" && row.applicantId ? (
                          <Button asChild size="sm" variant="ghost">
                            <Link
                              href={ROUTES.app.admissions.applicants.detail(
                                row.applicantId,
                              )}
                            >
                              <ExternalLink aria-hidden="true" />
                              Open
                            </Link>
                          </Button>
                        ) : row.values ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={row.status === "saving" || savingAll}
                              onClick={() => setReviewing(row)}
                            >
                              <Pencil aria-hidden="true" />
                              Review &amp; save
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              aria-label={`Remove ${row.name} from the queue`}
                              disabled={row.status === "saving" || savingAll}
                              onClick={() =>
                                setRemoved((s) =>
                                  new Set(s).add(row.form.index),
                                )
                              }
                            >
                              <Trash2 aria-hidden="true" />
                            </Button>
                          </>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Sheet
        open={reviewing !== null}
        onOpenChange={(open) => !open && setReviewing(null)}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>Review {reviewing?.name}</SheetTitle>
            <SheetDescription>
              Pages {reviewing?.form.pages.join("–")} of the PDF.{" "}
              {reviewing?.issues.length
                ? reviewing.issues.join(" · ")
                : "Every field was read clearly."}
            </SheetDescription>
          </SheetHeader>
          {reviewing?.values ? (
            <div className="px-4 pb-6">
              <ApplicantForm
                key={reviewing.form.index}
                {...pickers}
                defaultValues={reviewing.values}
                submitLabel="Save applicant"
                onCancel={() => setReviewing(null)}
                onSubmit={async (values) => {
                  const error = await save(reviewing, values);
                  // Shown inside the form by ApplicantForm's own error alert.
                  if (error) throw new Error(error);
                  await queryClient.invalidateQueries({
                    queryKey: applicantKeys.lists(),
                  });
                  toast.success(
                    `${values.firstName} ${values.lastName} saved as a draft.`,
                  );
                  setReviewing(null);
                }}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
