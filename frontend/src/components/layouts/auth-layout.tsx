import { appConfig } from "@/config";
import { cn } from "@/lib/utils";

export interface AuthLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Centered, single-column shell for authentication screens (login, forgot
 * password). Structure only — the login form itself is a feature concern.
 */
export function AuthLayout({ children, className }: AuthLayoutProps) {
  return (
    <div className="bg-muted/30 flex min-h-dvh flex-col items-center justify-center p-4 sm:p-6">
      <div className={cn("w-full max-w-sm space-y-6", className)}>
        <div className="text-center">
          <span className="text-lg font-semibold tracking-tight">
            {appConfig.name}
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
