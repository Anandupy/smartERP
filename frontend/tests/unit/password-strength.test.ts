import { describe, expect, it } from "vitest";

import { PASSWORD_RULES, getPasswordStrength } from "@/lib";

describe("getPasswordStrength", () => {
  it("reports an empty password as empty, not weak", () => {
    const strength = getPasswordStrength("");
    expect(strength.level).toBe("empty");
    expect(strength.score).toBe(0);
    expect(strength.meetsPolicy).toBe(false);
  });

  it("scores a password that satisfies every rule as strong", () => {
    const strength = getPasswordStrength("Str0ng-Passphrase!");
    expect(strength.satisfied).toBe(PASSWORD_RULES.length);
    expect(strength.score).toBe(100);
    expect(strength.level).toBe("strong");
    expect(strength.meetsPolicy).toBe(true);
  });

  it("rates a long lowercase-only password as weak", () => {
    const strength = getPasswordStrength("aaaaaaaaaaaaaa");
    expect(strength.level).toBe("weak");
    expect(strength.meetsPolicy).toBe(false);
  });

  it("returns one checklist result per rule, in policy order", () => {
    const strength = getPasswordStrength("Short1!");
    expect(strength.results.map((result) => result.id)).toEqual(
      PASSWORD_RULES.map((rule) => rule.id),
    );

    const length = strength.results.find((result) => result.id === "length");
    expect(length?.satisfied).toBe(false);
    expect(
      strength.results.find((result) => result.id === "uppercase")?.satisfied,
    ).toBe(true);
  });

  it("counts only characters outside the alphanumeric set as symbols", () => {
    expect(getPasswordStrength("Passw0rdPassw0rd").meetsPolicy).toBe(false);
    expect(getPasswordStrength("Passw0rdPassw0rd#").meetsPolicy).toBe(true);
  });
});
