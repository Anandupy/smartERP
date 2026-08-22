"use client";

export interface ApplicantIdentitySummaryProps {
  /**
   * Not present in any captured Postman example, though `VERIFIED` bound at
   * `SUBMIT` and required from `SUBMITTED` onward at the database level
   * (`ApplicantDto`'s own doc-comment, module doc §3.2, AP2).
   */
  personId?: string | null;
  /** `PersonPanel` from `features/person`, slotted in by the route composition (AGENTS.md §28). */
  renderPersonPanel: (personId: string, compact?: boolean) => React.ReactNode;
  compact?: boolean;
}

/**
 * The one place "is this applicant's identity resolved" is decided —
 * reused by the Overview tab's Identity card and the Admit dialog's Person
 * review section, so both branches (linked / not yet resolved) read
 * identically everywhere they appear.
 */
export function ApplicantIdentitySummary({
  personId,
  renderPersonPanel,
  compact = false,
}: ApplicantIdentitySummaryProps) {
  if (personId) {
    return <>{renderPersonPanel(personId, compact)}</>;
  }

  return (
    <p className="text-muted-foreground text-sm">
      Not yet resolved. This applicant will be matched to an existing
      person, or a new person will be created, when the application is
      submitted.
    </p>
  );
}
