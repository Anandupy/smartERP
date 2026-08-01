import { describe, expect, it } from "vitest";

import { ROUTES } from "@/constants";
import { WelcomeScreen } from "@/features/auth";
import { render, screen } from "@tests/setup/render";

describe("<WelcomeScreen />", () => {
  it("names the page with a single level-1 heading", () => {
    render(<WelcomeScreen />);

    expect(
      screen.getByRole("heading", { level: 1, name: /welcome to campusflow/i }),
    ).toBeInTheDocument();
  });

  it("offers a keyboard-operable link into the login flow", () => {
    render(<WelcomeScreen />);

    const cta = screen.getByRole("link", { name: /continue to login/i });
    expect(cta).toHaveAttribute("href", ROUTES.auth.login);
  });

  it("shows the release small print", () => {
    render(<WelcomeScreen />);

    expect(screen.getByText(/version/i)).toBeInTheDocument();
  });
});
