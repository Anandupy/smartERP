import type {
  WorkspaceAcademicYear,
  WorkspaceBranch,
  WorkspaceOrganization,
} from "@/core/workspace";

export interface WorkspaceSummaryProps {
  organization: WorkspaceOrganization | null;
  branch: WorkspaceBranch | null;
  academicYear: WorkspaceAcademicYear | null;
}

/**
 * The scope as it currently stands, restated in one line.
 *
 * Three separate controls make it easy to lose track of what they add up to,
 * so the answer is shown as a sentence before the user commits to it.
 *
 * It is a polite live region: the summary changes as a *consequence* of each
 * choice rather than in response to it, and that is exactly the kind of change
 * a screen-reader user would otherwise never learn about.
 */
export function WorkspaceSummary({
  organization,
  branch,
  academicYear,
}: WorkspaceSummaryProps) {
  const parts = [organization?.name, branch?.name, academicYear?.name].filter(
    (part): part is string => Boolean(part),
  );

  return (
    <div
      aria-live="polite"
      className="bg-muted/60 border-border rounded-xl border px-4 py-3"
    >
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Current context
      </p>
      <p className="text-foreground mt-1 text-sm">
        {parts.length > 0 ? parts.join(" · ") : "Nothing selected yet"}
      </p>
    </div>
  );
}
