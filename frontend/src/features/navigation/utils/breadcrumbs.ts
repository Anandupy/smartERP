import { ROUTES } from "@/constants";

import { BREADCRUMB_LABELS } from "../constants";
import type { Breadcrumb } from "../types";

/** Title-cases an unlabelled URL segment: `system-information` → `System Information`. */
function humanize(segment: string): string {
  return segment
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * The trail from the app root to `pathname`, one step per path segment.
 *
 * A pure function over the path so it can be unit-tested and so nothing has to
 * be threaded down from a page: the header derives the trail itself, and a new
 * route gets breadcrumbs by adding a label to `BREADCRUMB_LABELS` — or by
 * having a readable slug and adding nothing at all.
 *
 * The last step is the current page and carries no `href`; linking a crumb to
 * the page it is already on is a dead control for keyboard and screen-reader
 * users. Paths outside `/app` produce an empty trail.
 */
export function resolveBreadcrumbs(pathname: string): Breadcrumb[] {
  const root = ROUTES.app.root;
  if (pathname !== root && !pathname.startsWith(`${root}/`)) {
    return [];
  }

  const trailing = pathname.slice(root.length).split("/").filter(Boolean);

  const crumbs: Breadcrumb[] = [
    { label: BREADCRUMB_LABELS[root] ?? "Dashboard", href: root },
  ];

  let path = root;
  for (const segment of trailing) {
    path = `${path}/${segment}`;
    crumbs.push({
      label: BREADCRUMB_LABELS[path] ?? humanize(segment),
      href: path,
    });
  }

  return crumbs.map((crumb, index) =>
    index === crumbs.length - 1 ? { label: crumb.label } : crumb,
  );
}

/**
 * Whether a sidebar entry should read as current for `pathname`.
 *
 * Section roots match their descendants so "System Settings" stays lit while
 * the user is on one of its pages; `exact` entries — the dashboard, which is
 * the prefix of every other route — match only themselves.
 */
export function isNavItemActive(
  pathname: string,
  item: { href: string; exact?: boolean },
): boolean {
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
