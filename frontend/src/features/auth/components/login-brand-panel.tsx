import { GraduationCap } from "@/assets/icons";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { appConfig } from "@/config";

import { AuthBrandPanel } from "./auth-brand-panel";

/** Illustrative rows for the decorative gradebook preview. */
const PREVIEW_ROWS = [
  { initials: "JD", name: "John Doe", grade: "A−" },
  { initials: "AS", name: "Alice Smith", grade: "B+" },
] as const;

/**
 * Brand panel for the login screen: the product name, its social proof, and a
 * decorative preview of a gradebook to hint at the workspace behind the door.
 *
 * Everything here is decorative and `lg`-and-up only; the panel is never part
 * of the sign-in task flow.
 */
export function LoginBrandPanel() {
  return (
    <AuthBrandPanel className="justify-center gap-6 p-10 xl:p-14">
      <div className="space-y-3">
        <p className="text-primary text-4xl font-bold tracking-tight xl:text-5xl">
          {appConfig.name} ERP
        </p>
        <p className="text-muted-foreground text-xl xl:text-2xl">
          Trusted by 500+ institutions.
        </p>
      </div>

      <div
        aria-hidden="true"
        className="bg-card shadow-ambient-lg mt-2 w-full max-w-md -rotate-2 rounded-xl p-6 ring-1 ring-current/10 transition-transform duration-500 hover:rotate-0"
      >
        <div className="border-border/60 mb-4 flex items-center justify-between border-b pb-3">
          <span className="text-foreground text-sm font-medium">
            Fall semester gradebook
          </span>
          <GraduationCap className="text-primary size-4" />
        </div>

        <ul className="space-y-3">
          {PREVIEW_ROWS.map((row) => (
            <li
              key={row.initials}
              className="flex items-center justify-between"
            >
              <span className="flex items-center gap-3">
                <Avatar size="sm">
                  <AvatarFallback className="bg-secondary text-secondary-foreground text-[0.625rem]">
                    {row.initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-foreground text-sm">{row.name}</span>
              </span>
              <span className="text-primary text-sm font-medium">
                {row.grade}
              </span>
            </li>
          ))}
          <li className="flex items-center gap-3 opacity-50">
            <Avatar size="sm">
              <AvatarFallback className="bg-secondary text-secondary-foreground text-[0.625rem]">
                …
              </AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground text-sm">Load more</span>
          </li>
        </ul>
      </div>
    </AuthBrandPanel>
  );
}
