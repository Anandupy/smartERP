import type { AccessTokenClaims } from "../types/auth.dto";

/**
 * Decode the payload of a JWT **without verifying it**.
 *
 * The server is the only party that may trust a token; this exists solely so
 * the UI can name the signed-in user, because the backend returns just tokens
 * from `/auth/login` and exposes no `/auth/me`. Never gate a security decision
 * on the result — pair every client check with a server check.
 */
export function decodeAccessToken(token: string): AccessTokenClaims | null {
  const payload = token.split(".")[1];
  if (!payload) return null;

  try {
    // JWT uses base64url; restore the standard alphabet and the padding.
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    const json = atob(padded);
    const claims: unknown = JSON.parse(json);

    if (!claims || typeof claims !== "object") return null;
    const record = claims as Record<string, unknown>;
    if (typeof record.sub !== "string" || typeof record.email !== "string") {
      return null;
    }

    return {
      sub: record.sub,
      email: record.email,
      role: typeof record.role === "string" ? record.role : "",
      organizationId:
        typeof record.organizationId === "string"
          ? record.organizationId
          : null,
      branchId: typeof record.branchId === "string" ? record.branchId : null,
      exp: typeof record.exp === "number" ? record.exp : undefined,
      iat: typeof record.iat === "number" ? record.iat : undefined,
    };
  } catch {
    // A malformed token is treated as "no claims"; callers fall back to
    // requiring a fresh login rather than trusting a half-parsed identity.
    return null;
  }
}
