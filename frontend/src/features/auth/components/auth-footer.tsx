import { appConfig } from "@/config";
import { cn } from "@/lib/utils";

export interface AuthFooterProps extends React.ComponentProps<"p"> {
  /** Extra small print rendered after the copyright line. */
  children?: React.ReactNode;
}

/**
 * The legal/version small print shared by every auth screen. Reads the release
 * string from `appConfig` so a deployment bumps it via env, never via a code
 * change.
 */
export function AuthFooter({ className, children, ...props }: AuthFooterProps) {
  return (
    <p className={cn("text-muted-foreground text-xs", className)} {...props}>
      © {new Date().getFullYear()} {appConfig.legalEntity}. Version{" "}
      {appConfig.version}
      {children ? <> · {children}</> : null}
    </p>
  );
}
