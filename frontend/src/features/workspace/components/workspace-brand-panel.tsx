import { appConfig } from "@/config";
import { BrandCanvas, BrandMark } from "@/shared";

import { WORKSPACE_ASSURANCES } from "../constants";
import { firstNameOf } from "../utils/identity-display";

export interface WorkspaceBrandPanelProps {
  /** The signed-in user's full name, when identity has loaded. */
  name?: string | null;
}

/**
 * Brand panel for workspace selection: the lockup, a greeting, and the session
 * assurances.
 *
 * Rendered only from `lg` up by `AuthSplitLayout`, so small screens never pay
 * for the decoration — which is why the greeting is never the page's heading.
 * The `<h1>` lives in the content column, where every viewport can see it.
 */
export function WorkspaceBrandPanel({ name }: WorkspaceBrandPanelProps) {
  const firstName = firstNameOf(name);

  return (
    <BrandCanvas className="justify-between gap-8 p-10 xl:p-14">
      <BrandMark />

      <div className="space-y-4">
        <p className="text-primary text-3xl font-semibold tracking-tight text-balance xl:text-4xl">
          {firstName ? `Welcome back, ${firstName}.` : "Welcome back."}
        </p>
        <p className="text-muted-foreground max-w-sm text-sm">
          Choose where you are working today. Students, fees, attendance and
          reports all belong to the scope you pick here.
        </p>
      </div>

      <div className="space-y-3">
        <ul className="space-y-2">
          {WORKSPACE_ASSURANCES.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="text-muted-foreground flex items-center gap-2 text-xs"
            >
              <Icon aria-hidden="true" className="text-primary size-3.5" />
              {label}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground/80 text-xs">
          {appConfig.version} · {appConfig.edition}
        </p>
      </div>
    </BrandCanvas>
  );
}
