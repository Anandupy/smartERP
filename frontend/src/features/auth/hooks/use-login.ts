"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { ROUTES } from "@/constants";
import { useAuth } from "@/core/auth";
import { resolvePostAuthRoute } from "@/core/workspace";

import { authService } from "../api/auth.service";
import {
  toAuthUser,
  toLoginRequest,
  toTokenPair,
} from "../mappers/auth.mapper";
import type { LoginFormValues } from "../schemas/login.schema";
import { useLockoutStore } from "../store/lockout-store";
import { getAccountLockedMessage } from "../utils/auth-errors";
import { configureTokenStorage, persistTokens } from "../utils/session-manager";
import { decodeAccessToken } from "../utils/jwt";

/**
 * Sign in.
 *
 * Owns everything that must happen around a successful login: choosing where
 * tokens live (that is all "remember me" means), storing them, deriving the
 * session identity from the access token's claims, and routing onward.
 *
 * A locked account is not an ordinary failure — it gets its own screen, so it
 * is intercepted here rather than surfaced on the form. Detection lives in
 * `utils/auth-errors`; this hook only reacts to it. Every other failure is
 * re-thrown for `LoginForm` to render inline, which is why the toast is
 * suppressed via `meta`.
 *
 * Where a successful sign-in *leads* is deliberately not decided here.
 * `resolvePostAuthRoute` owns that, so this hook never learns what a workspace
 * is: at this moment the scope is still unresolved, and the route it returns
 * resolves it — forwarding straight to the app when there is nothing to choose.
 */
export function useLogin() {
  const router = useRouter();
  const { setSession } = useAuth();
  const setLockoutMessage = useLockoutStore((state) => state.setMessage);

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: async (values: LoginFormValues) => {
      configureTokenStorage(values.rememberMe);
      return authService.login(toLoginRequest(values));
    },
    onSuccess: (tokens) => {
      persistTokens(tokens);

      const claims = decodeAccessToken(tokens.accessToken);
      if (claims) setSession(toAuthUser(claims), toTokenPair(tokens));

      router.replace(resolvePostAuthRoute());
    },
    onError: (error) => {
      const lockedMessage = getAccountLockedMessage(error);
      if (lockedMessage) {
        // Handed to the screen verbatim — not re-worded, and no duration is
        // parsed out of it, so backend copy changes need no frontend release.
        setLockoutMessage(lockedMessage);
        router.push(ROUTES.auth.accountLocked);
      }
    },
  });
}
