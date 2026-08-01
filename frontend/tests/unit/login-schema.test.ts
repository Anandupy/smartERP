import { describe, expect, it } from "vitest";

import { loginFormDefaults, loginFormSchema } from "@/features/auth";

describe("loginFormSchema", () => {
  it("accepts a well-formed credential set", () => {
    const result = loginFormSchema.safeParse({
      email: "admin@university.edu",
      password: "correct horse battery staple",
      rememberMe: true,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a malformed email with a display-ready message", () => {
    const result = loginFormSchema.safeParse({
      email: "not-an-email",
      password: "secret",
      rememberMe: false,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "email");
      expect(issue?.message).toBe("Enter a valid email address");
    }
  });

  it("requires a password", () => {
    const result = loginFormSchema.safeParse({
      email: "admin@university.edu",
      password: "",
      rememberMe: false,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "password");
      expect(issue?.message).toBe("Enter your password");
    }
  });

  it("ships defaults that are themselves invalid until filled in", () => {
    // Guards against a default that would let an empty form submit.
    expect(loginFormSchema.safeParse(loginFormDefaults).success).toBe(false);
    expect(loginFormDefaults.rememberMe).toBe(false);
  });
});
