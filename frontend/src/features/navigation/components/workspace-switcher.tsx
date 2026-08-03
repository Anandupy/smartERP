"use client";

import { useRouter } from "next/navigation";

import {
  ArrowLeftRight,
  Building2,
  CalendarDays,
  ChevronsUpDown,
  MapPin,
} from "@/assets/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROUTES } from "@/constants";
import { useWorkspace } from "@/core/workspace";
import { cn } from "@/lib/utils";

export interface WorkspaceSwitcherProps {
  /** `full` shows the whole scope; `compact` fits the header bar. */
  variant?: "full" | "compact";
  className?: string;
}

/**
 * Reads and changes the active workspace scope.
 *
 * The scope comes from `useWorkspace()` and nowhere else, and changing it goes
 * back through the same seam — `select` cascades the levels below whatever
 * changed, `confirm` persists the result and republishes the scope headers. So
 * switching campus here has exactly the effect it has on the selection screen,
 * without this component knowing how either works.
 *
 * Only levels with a real alternative are offered: a user with one campus gets
 * no campus list, because a menu whose every option is already chosen is noise.
 * Re-running the full selection stays available as an explicit escape.
 */
export function WorkspaceSwitcher({
  variant = "full",
  className,
}: WorkspaceSwitcherProps) {
  const router = useRouter();
  const { organization, branch, academicYear, options, select, confirm } =
    useWorkspace();

  if (!organization) {
    return null;
  }

  const scope = [branch?.name, academicYear?.name].filter(Boolean).join(" · ");
  const canSwitchBranch = options.branches.length > 1;
  const canSwitchYear = options.academicYears.length > 1;

  const apply = (next: Parameters<typeof select>[0]) => {
    select(next);
    confirm();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "h-auto w-full justify-start gap-2 px-2 py-1.5 text-left",
            variant === "compact" && "max-w-56",
            className,
          )}
        >
          <Building2 aria-hidden="true" className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {organization.name}
            </span>
            {scope ? (
              <span className="text-muted-foreground block truncate text-xs">
                {scope}
              </span>
            ) : null}
          </span>
          <ChevronsUpDown aria-hidden="true" className="shrink-0 opacity-60" />
          <span className="sr-only">Change workspace</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          {organization.name}
          {organization.code ? ` · ${organization.code}` : ""}
        </DropdownMenuLabel>

        {canSwitchBranch ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground flex items-center gap-2 text-xs">
              <MapPin aria-hidden="true" className="size-3.5" />
              Campus
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={branch?.id ?? ""}
              onValueChange={(branchId) => apply({ branchId })}
            >
              {options.branches.map((option) => (
                <DropdownMenuRadioItem key={option.id} value={option.id}>
                  <span className="truncate">{option.name}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        ) : null}

        {canSwitchYear ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground flex items-center gap-2 text-xs">
              <CalendarDays aria-hidden="true" className="size-3.5" />
              Academic year
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={academicYear?.id ?? ""}
              onValueChange={(academicYearId) => apply({ academicYearId })}
            >
              {options.academicYears.map((option) => (
                <DropdownMenuRadioItem key={option.id} value={option.id}>
                  <span className="truncate">{option.name}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        ) : null}

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push(ROUTES.workspace.root)}>
          <ArrowLeftRight aria-hidden="true" />
          Change workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
