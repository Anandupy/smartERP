import { vi } from "vitest";

/**
 * App Router mock shared by component tests.
 *
 * jsdom has no Next.js router, so screens that navigate need one. This is the
 * one place where module-boundary mocking is correct: the router is a framework
 * boundary, not a network boundary (those stay on MSW — see `tests/README.md`).
 *
 * Usage:
 *
 * ```ts
 * vi.mock("next/navigation", async () => {
 *   const { createNextNavigationMock } = await import(
 *     "@tests/mocks/next-navigation"
 *   );
 *   return createNextNavigationMock();
 * });
 * ```
 *
 * Assert against `routerMock.replace` / `routerMock.push`, and reset it in a
 * `beforeEach` with `resetRouterMock()`. Screens that read the query string
 * (e.g. the reset-password link) get it from `setSearchParams()`.
 */
export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
};

let searchParams = new URLSearchParams();
let pathname = "/";

/** Set the query string the mocked `useSearchParams` returns. */
export function setSearchParams(init: Record<string, string> = {}): void {
  searchParams = new URLSearchParams(init);
}

/**
 * Set the path the mocked `usePathname` returns.
 *
 * Navigation chrome derives its own state from the URL — which sidebar entry is
 * current, what the breadcrumb trail is — so testing it at all requires being
 * able to say where the user is.
 */
export function setPathname(next: string): void {
  pathname = next;
}

export function resetRouterMock(): void {
  for (const spy of Object.values(routerMock)) spy.mockReset();
  searchParams = new URLSearchParams();
  pathname = "/";
}

/** Module factory for `vi.mock("next/navigation", …)`. */
export function createNextNavigationMock() {
  return {
    useRouter: () => routerMock,
    usePathname: () => pathname,
    useSearchParams: () => searchParams,
    useParams: () => ({}),
    redirect: vi.fn(),
    notFound: vi.fn(),
  };
}
