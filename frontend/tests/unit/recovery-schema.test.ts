import { describe, expect, it } from "vitest";

import {
  OTP_LENGTH,
  forgotPasswordFormSchema,
  otpFormSchema,
  resetPasswordFormSchema,
} from "@/features/auth";

describe("forgotPasswordFormSchema", () => {
  it("accepts a well-formed email", () => {
    expect(
      forgotPasswordFormSchema.safeParse({ email: "admin@institution.edu" })
        .success,
    ).toBe(true);
  });

  it("rejects a malformed email with display-ready copy", () => {
    const result = forgotPasswordFormSchema.safeParse({ email: "nope" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Enter a valid email address",
      );
    }
  });
});

describe("otpFormSchema", () => {
  it("accepts exactly six digits", () => {
    expect(otpFormSchema.safeParse({ otp: "123456" }).success).toBe(true);
  });

  it.each([
    ["too short", "12345"],
    ["too long", "1234567"],
    ["non-numeric", "12345a"],
    ["empty", ""],
  ])("rejects a %s code", (_label, otp) => {
    const result = otpFormSchema.safeParse({ otp });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        `Enter the ${OTP_LENGTH}-digit code`,
      );
    }
  });
});

describe("resetPasswordFormSchema", () => {
  const valid = {
    password: "Str0ng-Passphrase!",
    confirmPassword: "Str0ng-Passphrase!",
  };

  it("accepts a password meeting every policy rule", () => {
    expect(resetPasswordFormSchema.safeParse(valid).success).toBe(true);
  });

  it("reports the unmet policy rule as the field message", () => {
    const result = resetPasswordFormSchema.safeParse({
      password: "short1!A",
      confirmPassword: "short1!A",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.message.includes("At least 12 characters"),
        ),
      ).toBe(true);
    }
  });

  it("blames the confirmation field when the two do not match", () => {
    const result = resetPasswordFormSchema.safeParse({
      ...valid,
      confirmPassword: "Different-Passphrase1!",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const mismatch = result.error.issues.find(
        (issue) => issue.path[0] === "confirmPassword",
      );
      expect(mismatch?.message).toBe("Passwords do not match");
    }
  });

  it("requires a confirmation at all", () => {
    const result = resetPasswordFormSchema.safeParse({
      ...valid,
      confirmPassword: "",
    });
    expect(result.success).toBe(false);
  });
});
