import { cn } from "@/lib/utils";

export interface AuthSplitLayoutProps {
  /** The authentication content (card, form, CTA). */
  children: React.ReactNode;
  /**
   * Full-height brand panel rendered beside the content from `lg` up and
   * dropped entirely below it, so small screens never pay for decoration.
   */
  visual?: React.ReactNode;
  /** Small print rendered under the content column (legal, support links). */
  footer?: React.ReactNode;
  /** Extra classes for the content column's inner width cap. */
  className?: string;
}

/**
 * Two-column shell for authentication screens: a brand panel on one side and a
 * centered content column on the other. Structure only — every pixel of brand
 * content is injected by the auth feature.
 *
 * Mobile-first: a single centered column down to 320px, splitting at `lg`. The
 * panel is `overflow-hidden` so rotated/blurred brand artwork can bleed without
 * ever producing horizontal page scroll.
 */
export function AuthSplitLayout({
  children,
  visual,
  footer,
  className,
}: AuthSplitLayoutProps) {
  return (
    <div className="flex min-h-dvh w-full flex-col lg:flex-row">
      {visual ? (
        <aside className="bg-canvas relative hidden overflow-hidden lg:flex lg:w-1/2 lg:shrink-0 lg:flex-col">
          {visual}
        </aside>
      ) : null}
      <div
        className={cn(
          "flex w-full flex-1 flex-col px-4 py-10 sm:px-6 lg:px-8",
          visual && "lg:w-1/2",
        )}
      >
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className={cn("w-full max-w-[27.5rem]", className)}>
            {children}
          </div>
        </div>
        {footer ? (
          <div className="text-muted-foreground mx-auto w-full max-w-[27.5rem] pt-10 text-center text-xs">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
