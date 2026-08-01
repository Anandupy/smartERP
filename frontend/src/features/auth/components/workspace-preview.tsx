import { cn } from "@/lib/utils";

export interface WorkspacePreviewProps extends React.ComponentProps<"div"> {
  title?: string;
}

/**
 * Decorative abstraction of a CampusFlow analytics workspace, used as the brand
 * panel's hero on the welcome screen.
 *
 * Built from tokens rather than a bitmap so it stays crisp at every density,
 * costs no network request, and restyles with the theme. Entirely decorative:
 * hidden from assistive tech, and it never renders below `lg`.
 */
export function WorkspacePreview({
  title = "Enrollment Analytics",
  className,
  ...props
}: WorkspacePreviewProps) {
  return (
    <div aria-hidden="true" className={cn("relative", className)} {...props}>
      {/* Back plate — suggests a stack of workspace surfaces. */}
      <div className="bg-card/60 shadow-ambient absolute -top-6 right-4 left-10 h-full rounded-xl ring-1 ring-current/5" />

      <div className="bg-card shadow-ambient-lg relative rounded-xl p-5 ring-1 ring-current/10">
        <div className="border-border/60 mb-4 flex items-center justify-between border-b pb-3">
          <span className="text-foreground text-sm font-medium">{title}</span>
          <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[0.625rem] font-medium">
            Live
          </span>
        </div>

        {/* Mini bar chart. Heights are layout, not data. */}
        <div className="flex h-24 items-end gap-2">
          {[45, 70, 35, 90, 60, 80, 50].map((height, index) => (
            <div
              key={height}
              className={cn(
                "flex-1 rounded-t-sm",
                index % 2 === 0 ? "bg-primary/80" : "bg-primary/35",
              )}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {["Programs", "Branches", "Students"].map((label) => (
            <div key={label} className="space-y-1">
              <div className="bg-muted h-1.5 w-full rounded-full" />
              <span className="text-muted-foreground text-[0.625rem]">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
