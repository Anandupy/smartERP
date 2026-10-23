"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormContext, type Path } from "react-hook-form";
import { toast } from "sonner";

import {
  CircleCheckBig,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  TriangleAlert,
  Upload,
} from "@/assets/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getTokenStorage } from "@/core/auth";

import type {
  AdmissionOcrResponse,
  AdmissionOcrResult,
} from "../schemas/admission-ocr.schema";
import type { ApplicantFormValues } from "../schemas/applicant.schema";
import { scanFormPatch, type ResolveOcrMasters } from "../utils/scan-to-form";

export type { ResolveOcrMasters } from "../utils/scan-to-form";

export interface AdmissionOcrUploaderProps {
  resolveMasters?: ResolveOcrMasters;
  disabled?: boolean;
  /** Called with every successful scan, so the screen can act on it at save. */
  onScanned?: (result: AdmissionOcrResult) => void;
  /**
   * When set, the scanned parents are added as guardians on save; the
   * uploader shows a checkbox bound to it so the clerk can opt out.
   */
  addGuardians?: { checked: boolean; onChange: (checked: boolean) => void };
}

const ACCEPTED = "image/jpeg,image/png,image/webp,application/pdf";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 3;

/** Human labels for the fields the model may flag as uncertain. */
const FIELD_LABELS: Record<string, string> = {
  firstName: "First name",
  middleName: "Middle name",
  lastName: "Last name",
  dob: "Date of birth",
  aadhaarNo: "Aadhaar",
  primaryMobile: "Primary mobile",
  alternateMobile: "Alternate mobile",
  primaryEmail: "Email",
  pincode: "PIN code",
  currentAddressLine1: "Address",
};

/**
 * "Scan admission form" — reads a photo/scan of a filled paper form and
 * fills the New Admission form in place. Rendered inside `ApplicantForm`
 * (through its `header` slot), so it writes with `setValue`: anything the
 * clerk already typed survives, and only fields the scan actually read are
 * touched. Nothing is saved until the clerk reviews and submits.
 */
export function AdmissionOcrUploader({
  resolveMasters,
  disabled = false,
  onScanned,
  addGuardians,
}: AdmissionOcrUploaderProps) {
  const form = useFormContext<ApplicantFormValues>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState<{
    fileName: string;
    result: AdmissionOcrResult;
    engine: AdmissionOcrResponse["engine"];
    notices: string[];
    filled: number;
    unmatched: string[];
    defaulted: string[];
  } | null>(null);

  const fillForm = useCallback(
    (result: AdmissionOcrResult) => {
      const { patch, unmatched, defaulted } = scanFormPatch(
        result,
        resolveMasters,
      );
      let filled = 0;

      // Only what the scan read: anything the clerk already typed survives.
      for (const [key, value] of Object.entries(patch)) {
        form.setValue(key as Path<ApplicantFormValues>, value as never, {
          shouldDirty: true,
          shouldValidate: false,
        });
        filled += 1;
      }

      return { filled, unmatched, defaulted };
    },
    [form, resolveMasters],
  );

  const scan = useCallback(
    async (files: File[]) => {
      if (isScanning || disabled || files.length === 0) return;
      setError(null);

      if (files.length > MAX_FILES) {
        setError(
          `Choose at most ${MAX_FILES} files: one PDF, or one photo per page.`,
        );
        return;
      }
      if (files.some((file) => !ACCEPTED.split(",").includes(file.type))) {
        setError("Upload a JPG, PNG, WebP or PDF of the admission form.");
        return;
      }
      if (files.some((file) => file.size > MAX_FILE_BYTES)) {
        setError("A file is larger than 10 MB. Send a smaller photo or scan.");
        return;
      }

      setIsScanning(true);
      try {
        const body = new FormData();
        for (const file of files) body.append("file", file);
        const token = getTokenStorage().getAccessToken();
        const res = await fetch("/api/admissions/ocr", {
          method: "POST",
          body,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const payload = (await res.json().catch(() => null)) as
          (AdmissionOcrResponse & { error?: string }) | null;

        if (!res.ok || !payload?.result) {
          throw new Error(
            payload?.error ??
              `The form could not be scanned (HTTP ${res.status}).`,
          );
        }

        const { filled, unmatched, defaulted } = fillForm(payload.result);
        const fileName =
          files.length === 1
            ? files[0].name || "Pasted image"
            : `${files.length} pages`;
        setScanned({
          fileName,
          result: payload.result,
          engine: payload.engine,
          notices: payload.notices ?? [],
          filled,
          unmatched,
          defaulted,
        });
        onScanned?.(payload.result);
        toast.success(
          `Filled ${filled} fields from the scanned form. Check them before saving.`,
        );
      } catch (scanError) {
        setError(
          scanError instanceof Error
            ? scanError.message
            : "The form could not be scanned.",
        );
      } finally {
        setIsScanning(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [disabled, fillForm, isScanning, onScanned],
  );

  // Paste a photo copied from WhatsApp Web with Ctrl+V anywhere on the page.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/"),
      );
      const file = item?.getAsFile();
      if (!file) return;
      event.preventDefault();
      void scan([file]);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [scan]);

  const uncertain =
    scanned?.result.uncertainFields.map((f) => FIELD_LABELS[f] ?? f) ?? [];
  const parents = scanned?.result.parents;
  const parentLines = parents
    ? [
        parents.fatherName &&
          `Father: ${parents.fatherName}${parents.fatherMobile ? ` (${parents.fatherMobile})` : ""}`,
        parents.motherName &&
          `Mother: ${parents.motherName}${parents.motherMobile ? ` (${parents.motherMobile})` : ""}`,
      ].filter(Boolean)
    : [];

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Sparkles aria-hidden="true" className="size-4" />
          Scan a filled admission form
        </CardTitle>
        <CardDescription>
          Upload or paste (Ctrl+V) a photo or scan of the parent&apos;s filled
          form. The fields below fill in automatically — check them before
          saving.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <button
          type="button"
          disabled={disabled || isScanning}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void scan(Array.from(event.dataTransfer.files ?? []));
          }}
          className="border-input hover:border-primary hover:bg-muted/40 flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isScanning ? (
            <>
              <LoaderCircle
                aria-hidden="true"
                className="text-primary size-6 animate-spin"
              />
              <span className="text-sm font-medium">
                Reading the form… this can take up to a minute
              </span>
            </>
          ) : (
            <>
              <Upload
                aria-hidden="true"
                className="text-muted-foreground size-6"
              />
              <span className="text-sm font-medium">
                Click to upload, or drop the form here
              </span>
              <span className="text-muted-foreground text-xs">
                One PDF, or a photo of each page (select both) · JPG, PNG, WebP
                · up to 10 MB each
              </span>
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED}
          multiple
          className="hidden"
          onChange={(event) => void scan(Array.from(event.target.files ?? []))}
        />

        {error ? (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>Couldn&apos;t scan the form</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {scanned && !isScanning ? (
          <Alert>
            <CircleCheckBig aria-hidden="true" />
            <AlertTitle>
              Filled {scanned.filled} fields from {scanned.fileName}
            </AlertTitle>
            <AlertDescription className="space-y-1">
              <p className="text-muted-foreground text-xs">
                {scanned.engine === "claude"
                  ? "Read with Claude vision."
                  : "Read with the offline scanner — check every field, especially handwriting."}
              </p>
              {scanned.notices.map((notice) => (
                <p key={notice}>{notice}</p>
              ))}
              {uncertain.length > 0 ? (
                <p>
                  <strong>Check carefully:</strong> {uncertain.join(", ")} —
                  hard to read on the form.
                </p>
              ) : null}
              {scanned.defaulted.length > 0 ? (
                <p>
                  <strong>Default used — confirm:</strong>{" "}
                  {scanned.defaulted.join("; ")}.
                </p>
              ) : null}
              {scanned.unmatched.length > 0 ? (
                <p>
                  <strong>Select manually:</strong>{" "}
                  {scanned.unmatched.join(", ")} — no matching master record in
                  this branch.
                </p>
              ) : null}
              {parentLines.length > 0 && addGuardians ? (
                <label className="flex items-start gap-2 pt-1">
                  <Checkbox
                    checked={addGuardians.checked}
                    onCheckedChange={(checked) =>
                      addGuardians.onChange(checked === true)
                    }
                    aria-label="Add parents as guardians when saving"
                  />
                  <span>
                    <strong>Add as guardians when saving:</strong>{" "}
                    {parentLines.join(" · ")}
                  </span>
                </label>
              ) : parentLines.length > 0 ? (
                <p>
                  <strong>Add as guardians after saving:</strong>{" "}
                  {parentLines.join(" · ")}
                </p>
              ) : null}
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto px-0"
                onClick={() => fileInputRef.current?.click()}
              >
                <RotateCcw aria-hidden="true" />
                Scan another form
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
