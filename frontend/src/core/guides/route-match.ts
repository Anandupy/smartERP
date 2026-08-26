/**
 * Route matching for guide steps.
 *
 * Guides are cross-route (a step's target may not exist until the user
 * navigates), so each step declares which route it belongs to and the
 * provider only ever runs the one whose route matches the current pathname.
 */

/**
 * Matches a route pattern against a pathname. Supports one dynamic segment per
 * path component, written `:name` (e.g. `/app/academic-years/:id` matches
 * `/app/academic-years/abc-123` but not `/app/academic-years/abc-123/edit`).
 * This is the only pattern shape the guide system's routes need — no
 * wildcards, no optional segments.
 */
export function matchesRoute(pattern: string, pathname: string): boolean {
  const patternSegments = pattern.split("/").filter(Boolean);
  const pathSegments = pathname.split("/").filter(Boolean);

  if (patternSegments.length !== pathSegments.length) return false;

  return patternSegments.every(
    (segment, index) =>
      segment.startsWith(":") || segment === pathSegments[index],
  );
}

/** Every step of a guide whose route matches the given pathname, in order. */
export function stepsForRoute<T extends { route: string }>(
  steps: readonly T[],
  pathname: string,
): T[] {
  return steps.filter((step) => matchesRoute(step.route, pathname));
}

/**
 * Reads the value a route pattern's `:name` segment matched in a pathname, or
 * `null` if the pattern has no such segment or does not match at all.
 */
export function extractRouteParam(
  pattern: string,
  pathname: string,
  paramName: string,
): string | null {
  const patternSegments = pattern.split("/").filter(Boolean);
  const pathSegments = pathname.split("/").filter(Boolean);

  if (patternSegments.length !== pathSegments.length) return null;

  for (let index = 0; index < patternSegments.length; index += 1) {
    if (patternSegments[index] === `:${paramName}`) {
      return pathSegments[index] ?? null;
    }
  }

  return null;
}
