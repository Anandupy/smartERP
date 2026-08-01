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
 * `beforeEach` with `resetRouterMock()`.
 */
export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
};

export function resetRouterMock() {
  for (const spy of Object.values(routerMock)) spy.mockReset();
}

/** Module factory for `vi.mock("next/navigation", …)`. */
export function createNextNavigationMock() {
  return {
    useRouter: () => routerMock,
    usePathname: () => "/",
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
    redirect: vi.fn(),
    notFound: vi.fn(),
  };
}
