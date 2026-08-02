import { AuthSplitLayout } from "@/components/layouts";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BrandMark, FadeIn } from "@/shared";

import { AuthFooter } from "./auth-footer";

export type AuthStatusTone = "brand" | "success" | "danger";

export interface AuthStatusScreenProps {
  /** Decorative glyph for the status tile. */
  icon: React.ReactNode;
  /** Colors the tile: brand for neutral states, danger for blocked ones. */
  tone?: AuthStatusTone;
  /** Page heading — rendered as the `<h1>`. */
  title: string;
  description: React.ReactNode;
  /** Content between the copy and the actions (timers, detail boxes). */
  children?: React.ReactNode;
  /** Primary and secondary calls to action, stacked full width. */
  actions: React.ReactNode;
  /** Small print under the card's divider. */
  note?: React.ReactNode;
  /** Brand panel rendered from `lg` up. */
  visual?: React.ReactNode;
}

const TONE: Record<AuthStatusTone, string> = {
  brand: "bg-primary text-primary-foreground",
  success: "bg-primary text-primary-foreground",
  danger: "bg-destructive/10 text-destructive",
};

/**
 * Shared shell for the outcome screens — email sent, password updated, account
 * locked, session expired. They differ in glyph, tone and copy, not structure,
 * so the structure lives here once and each screen stays a data declaration.
 */
export function AuthStatusScreen({
  icon,
  tone = "brand",
  title,
  description,
  children,
  actions,
  note,
  visual,
}: AuthStatusScreenProps) {
  return (
    <AuthSplitLayout visual={visual} footer={<AuthFooter />}>
      <FadeIn className="space-y-8">
        <BrandMark size="sm" className="lg:hidden" />

        <Card className="shadow-ambient [--card-spacing:--spacing(6)] sm:[--card-spacing:--spacing(8)]">
          <CardContent className="space-y-6 text-center">
            <span
              aria-hidden="true"
              className={cn(
                "shadow-ambient mx-auto flex size-14 items-center justify-center rounded-full [&_svg]:size-7",
                TONE[tone],
              )}
            >
              {icon}
            </span>

            <div className="space-y-2">
              <h1 className="text-foreground text-2xl font-semibold tracking-tight">
                {title}
              </h1>
              <div className="text-muted-foreground text-sm text-balance">
                {description}
              </div>
            </div>

            {children}

            <div className="space-y-3">{actions}</div>

            {note ? (
              <div className="border-border/60 text-muted-foreground border-t pt-5 text-xs">
                {note}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </FadeIn>
    </AuthSplitLayout>
  );
}
