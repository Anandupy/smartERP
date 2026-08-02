import { cn } from "@/lib/utils";

export interface BrandCanvasProps extends React.ComponentProps<"div"> {
  /** Render the ambient light orbs (skipped on dense surfaces). */
  withOrbs?: boolean;
}

/**
 * The decorative canvas behind every brand moment: a warm brand canvas, a
 * token-tinted dot grid, and two blurred ambient orbs.
 *
 * Every layer is decorative (`aria-hidden`, `pointer-events-none`) and derives
 * its color from semantic tokens (`--color-canvas`, `--color-foreground`,
 * `--color-accent`), so dark mode and future workspace themes restyle it with
 * no component change. `overflow-hidden` keeps the bleed from ever producing
 * horizontal page scroll.
 *
 * Lives in `shared` because it carries no domain: the splash, login and
 * workspace-selection panels are the same canvas with different content on it.
 */
export function BrandCanvas({
  withOrbs = true,
  className,
  children,
  ...props
}: BrandCanvasProps) {
  return (
    <div
      className={cn(
        "bg-canvas relative isolate flex w-full flex-1 flex-col overflow-hidden",
        className,
      )}
      {...props}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(var(--color-foreground)_1px,transparent_1px)] bg-[size:26px_26px] opacity-[0.045]"
      />
      {withOrbs ? (
        <>
          <div
            aria-hidden="true"
            className="bg-canvas-accent pointer-events-none absolute -top-[15%] -left-[10%] -z-10 size-[45%] rounded-full opacity-50 blur-[100px]"
          />
          <div
            aria-hidden="true"
            className="bg-primary/25 pointer-events-none absolute -right-[15%] -bottom-[15%] -z-10 size-[55%] rounded-full blur-[120px]"
          />
        </>
      ) : null}
      {children}
    </div>
  );
}
