import { env } from "@/config/env";

/**
 * True when the backend accepts the caller's bearer token (`GET /auth/me`).
 * The scanning routes run on the Next server, outside the backend's own
 * guards, so they check the session themselves before doing any work.
 */
export async function isAuthenticated(
  authorization: string | null,
): Promise<boolean> {
  if (!authorization?.startsWith("Bearer ")) return false;
  try {
    const res = await fetch(
      `${env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "")}/${env.NEXT_PUBLIC_API_VERSION}/auth/me`,
      { headers: { Authorization: authorization }, cache: "no-store" },
    );
    return res.ok;
  } catch {
    return false;
  }
}
