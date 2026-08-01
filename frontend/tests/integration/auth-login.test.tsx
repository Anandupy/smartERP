import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/core/api";
import { LoginForm, LoginScreen } from "@/features/auth";
import { render, screen, waitFor } from "@tests/setup/render";

describe("<LoginScreen />", () => {
  it("names the page and describes the task", () => {
    render(<LoginScreen />);

    expect(
      screen.getByRole("heading", { level: 1, name: /sign in/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/access your administrative workspace/i),
    ).toBeInTheDocument();
  });

  it("links to password recovery and support", () => {
    render(<LoginScreen />);

    expect(
      screen.getByRole("link", { name: /forgot password/i }),
    ).toHaveAttribute("href", "/forgot-password");
    expect(
      screen.getByRole("link", { name: /contact it support/i }),
    ).toBeInTheDocument();
  });
});

describe("<LoginForm />", () => {
  it("labels every control", () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/institutional email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /remember me on this device/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeEnabled();
  });

  it("blocks submission and reports invalid input", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LoginForm onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(
      await screen.findByText("Enter a valid email address"),
    ).toBeInTheDocument();
    expect(screen.getByText("Enter your password")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the validated credentials, including the remember-me choice", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LoginForm onSubmit={onSubmit} />);

    await userEvent.type(
      screen.getByLabelText(/institutional email/i),
      "admin@university.edu",
    );
    await userEvent.type(screen.getByLabelText(/^password$/i), "s3cret-pass");
    await userEvent.click(
      screen.getByRole("checkbox", { name: /remember me on this device/i }),
    );
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        email: "admin@university.edu",
        password: "s3cret-pass",
        rememberMe: true,
      }),
    );
  });

  it("toggles password visibility without losing the value", async () => {
    render(<LoginForm />);

    const password = screen.getByLabelText(/^password$/i);
    await userEvent.type(password, "s3cret-pass");
    expect(password).toHaveAttribute("type", "password");

    const toggle = screen.getByRole("button", { name: /show password/i });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(toggle);
    expect(password).toHaveAttribute("type", "text");
    expect(password).toHaveValue("s3cret-pass");
    expect(
      screen.getByRole("button", { name: /hide password/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("surfaces a normalized API failure as a form-level alert", async () => {
    const onSubmit = vi.fn().mockRejectedValue(
      new ApiError({
        kind: "unauthorized",
        message: "Bad credentials",
        status: 401,
      }),
    );
    render(<LoginForm onSubmit={onSubmit} />);

    await userEvent.type(
      screen.getByLabelText(/institutional email/i),
      "admin@university.edu",
    );
    await userEvent.type(screen.getByLabelText(/^password$/i), "wrong-pass");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/sign-in failed/i);
    expect(alert).toHaveTextContent(/your session has expired/i);
  });

  it("binds server field errors back onto the offending control", async () => {
    const onSubmit = vi.fn().mockRejectedValue(
      new ApiError({
        kind: "validation",
        message: "Invalid input",
        status: 422,
        fieldErrors: [
          { field: "email", message: "This account is not provisioned" },
        ],
      }),
    );
    render(<LoginForm onSubmit={onSubmit} />);

    await userEvent.type(
      screen.getByLabelText(/institutional email/i),
      "ghost@university.edu",
    );
    await userEvent.type(screen.getByLabelText(/^password$/i), "s3cret-pass");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(
      await screen.findByText("This account is not provisioned"),
    ).toBeInTheDocument();
    // Field-bound errors are not duplicated as a form-level alert.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("advertises single sign-on as unavailable rather than pretending it works", () => {
    render(<LoginForm />);

    expect(screen.getByRole("button", { name: /azure ad/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /google ws/i })).toBeDisabled();
  });
});
