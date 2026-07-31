import { REQUEST_HEADERS } from "@/constants";
import type { Maybe } from "@/types/common";

/**
 * A header provider returns the current value for a request header, or a
 * nullish value to omit it. Providers are pure functions evaluated per request
 * so they always reflect the latest auth/tenant/workspace state.
 */
export type HeaderValueProvider = () => Maybe<string>;

/**
 * Configurable registry of dynamic request headers. The core client asks the
 * registry to `resolve()` headers on every request. Business modules (auth,
 * workspace, tenancy) register their providers here instead of reaching into
 * the Axios instance directly — keeping the client free of business logic.
 *
 * All multi-tenant / workspace headers ship as placeholders (registered but
 * returning `null`) so the wiring exists the day the backend needs them.
 */
class HeaderProviderRegistry {
  private providers = new Map<string, HeaderValueProvider>();

  register(name: string, provider: HeaderValueProvider): this {
    this.providers.set(name, provider);
    return this;
  }

  unregister(name: string): this {
    this.providers.delete(name);
    return this;
  }

  clear(): this {
    this.providers.clear();
    return this;
  }

  /** Evaluate every provider and drop the ones with no current value. */
  resolve(): Record<string, string> {
    const headers: Record<string, string> = {};
    for (const [name, provider] of this.providers) {
      const value = provider();
      if (value != null && value !== "") {
        headers[name] = value;
      }
    }
    return headers;
  }
}

/** Generate a request id even where `crypto.randomUUID` is unavailable. */
function generateRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const headerRegistry = new HeaderProviderRegistry();

/**
 * Register the platform's default header providers. Everything except the
 * request id is a placeholder returning `null` until the owning feature wires
 * a real source via `headerRegistry.register(...)`.
 */
export function registerDefaultHeaderProviders(): void {
  headerRegistry
    .register(REQUEST_HEADERS.requestId, generateRequestId)
    .register(REQUEST_HEADERS.authorization, () => null)
    .register(REQUEST_HEADERS.tenant, () => null)
    .register(REQUEST_HEADERS.branch, () => null)
    .register(REQUEST_HEADERS.academicYear, () => null)
    .register(REQUEST_HEADERS.workspace, () => null);
}
