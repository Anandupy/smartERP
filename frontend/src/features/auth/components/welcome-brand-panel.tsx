import { ShieldCheck } from "@/assets/icons";
import { Badge } from "@/components/ui/badge";
import { appConfig } from "@/config";
import { BrandCanvas } from "@/shared";

import { AUTH_TRUST_BADGES } from "../constants";
import { WorkspacePreview } from "./workspace-preview";

/**
 * Brand panel for the welcome screen: product name, a decorative workspace
 * preview, the positioning statement on a glass panel, and compliance signals.
 *
 * Rendered only from `lg` up by `AuthSplitLayout`, so small screens never pay
 * for the decoration.
 */
export function WelcomeBrandPanel() {
  return (
    <BrandCanvas className="justify-between gap-8 p-10 xl:p-14">
      <p className="text-primary text-3xl font-semibold tracking-tight xl:text-4xl">
        {appConfig.name} ERP
      </p>

      <WorkspacePreview className="mx-auto w-full max-w-md" />

      <div className="space-y-6">
        <div className="bg-panel border-panel-border shadow-ambient rounded-xl border p-6 backdrop-blur-md xl:p-8">
          <p className="text-foreground text-xl font-semibold tracking-tight xl:text-2xl">
            The operating system for modern education.
          </p>
          <p className="text-muted-foreground mt-3 text-base">
            Streamline administration, empower faculty, and enhance student
            outcomes with an enterprise-grade platform.
          </p>
        </div>

        <ul className="flex flex-wrap items-center gap-3">
          {AUTH_TRUST_BADGES.map((badge) => (
            <li key={badge.id}>
              <Badge
                variant="outline"
                className="bg-card shadow-ambient h-8 gap-1.5 px-3"
              >
                <ShieldCheck aria-hidden="true" className="text-primary" />
                {badge.label}
              </Badge>
            </li>
          ))}
        </ul>
      </div>
    </BrandCanvas>
  );
}
