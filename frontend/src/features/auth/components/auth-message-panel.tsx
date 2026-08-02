import { appConfig } from "@/config";
import { cn } from "@/lib/utils";
import { BrandCanvas } from "@/shared";

export interface AuthMessagePanelProps {
  /** Decorative glyph rendered in the panel's tile. */
  icon: React.ReactNode;
  title: string;
  description: string;
  /** Optional decoration rendered under the message (mock cards, badges). */
  children?: React.ReactNode;
  className?: string;
}

/**
 * The brand panel every recovery and session screen shares: the product name,
 * a reassurance message on a glass panel, and room for decoration.
 *
 * One component rather than seven near-identical panels — the screens differ
 * only in copy and glyph. Rendered by `AuthSplitLayout` from `lg` up, so small
 * screens never pay for it.
 */
export function AuthMessagePanel({
  icon,
  title,
  description,
  children,
  className,
}: AuthMessagePanelProps) {
  return (
    <BrandCanvas
      className={cn("justify-center gap-10 p-10 xl:p-14", className)}
    >
      <p className="text-primary text-2xl font-semibold tracking-tight xl:text-3xl">
        {appConfig.name} ERP
      </p>

      <div className="bg-panel border-panel-border shadow-ambient space-y-4 rounded-xl border p-6 backdrop-blur-md xl:p-8">
        <span
          aria-hidden="true"
          className="bg-primary text-primary-foreground shadow-ambient flex size-12 items-center justify-center rounded-xl [&_svg]:size-6"
        >
          {icon}
        </span>
        <p className="text-foreground text-xl font-semibold tracking-tight xl:text-2xl">
          {title}
        </p>
        <p className="text-muted-foreground text-base">{description}</p>
      </div>

      {children}
    </BrandCanvas>
  );
}
