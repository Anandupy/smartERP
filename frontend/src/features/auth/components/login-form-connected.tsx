"use client";

import { useLogin } from "../hooks/use-login";
import { LoginForm } from "./login-form";

/**
 * Binds the sign-in mutation to the presentational `LoginForm`.
 *
 * The form stays free of transport concerns: it receives one `onSubmit` that
 * rejects on failure, which is exactly the contract it already implements for
 * loading state, field errors and the inline alert. Account-lock routing
 * happens inside the mutation, so nothing here branches on error shape.
 */
export function LoginFormConnected() {
  const login = useLogin();

  return (
    <LoginForm
      onSubmit={async (values) => {
        await login.mutateAsync(values);
      }}
    />
  );
}
