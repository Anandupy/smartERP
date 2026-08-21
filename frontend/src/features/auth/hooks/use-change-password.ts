"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ROUTES } from "@/constants";
import { useAuth } from "@/core/auth";
import { getWorkspaceState } from "@/core/workspace";

import { authService } from "../api/auth.service";
import { toChangePasswordRequest } from "../mappers/auth.mapper";
import type { ChangePasswordFormValues } from "../schemas/change-password.schema";
import { clearTokens } from "../utils/session-manager";

/**
 * Change the signed-in user's password. Maps to `POST /auth/change-password`.
 *
 * That endpoint revokes every refresh token for the account, including the
 * one behind this tab — the same server-side effect a full sign-out has. The
 * access token already issued keeps working until it expires, but leaving the
 * user in that half-revoked state would be confusing, so success clears
 * local session state and returns to login, mirroring `useLogout`.
 */
export function useChangePassword() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { clearSession } = useAuth();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (values: ChangePasswordFormValues) =>
      authService.changePassword(toChangePasswordRequest(values)),
    onSuccess: () => {
      toast.success("Password changed. Please sign in again.");
      clearTokens();
      clearSession();
      getWorkspaceState().clear();
      queryClient.clear();
      router.replace(ROUTES.auth.login);
    },
  });
}
