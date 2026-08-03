"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

import { resolveBreadcrumbs } from "../utils/breadcrumbs";

export interface NavBreadcrumbsProps {
  className?: string;
}

/**
 * The trail to the current page, derived from the URL.
 *
 * Nothing is passed down from the page: a route that follows the registry gets
 * its breadcrumbs for free, and a route that needs a nicer word for a segment
 * adds one to `BREADCRUMB_LABELS`. That is what keeps 100+ screens from each
 * owning a hand-written trail that drifts the moment a path changes.
 *
 * Intermediate steps collapse below `sm`, where six words of trail would push
 * the header controls off screen; the current page always survives, because it
 * is the one crumb that says where you are.
 */
export function NavBreadcrumbs({ className }: NavBreadcrumbsProps) {
  const pathname = usePathname();
  const crumbs = resolveBreadcrumbs(pathname);

  if (crumbs.length === 0) {
    return null;
  }

  return (
    <Breadcrumb className={cn("min-w-0", className)}>
      <BreadcrumbList className="flex-nowrap">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <Fragment key={crumb.href ?? crumb.label}>
              <BreadcrumbItem
                className={cn(!isLast && "hidden sm:inline-flex")}
              >
                {crumb.href ? (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="truncate">
                    {crumb.label}
                  </BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {!isLast ? (
                <BreadcrumbSeparator className="hidden sm:block" />
              ) : null}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
