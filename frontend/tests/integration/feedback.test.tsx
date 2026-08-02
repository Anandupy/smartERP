import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { ApiError } from "@/core/api";
import {
  ApiErrorState,
  EmptyState,
  ErrorState,
  ForbiddenState,
  InlineError,
  OfflineState,
  SelectionSkeleton,
  TableSkeleton,
} from "@/shared/components/feedback";
import { render, screen } from "@tests/setup/render";

describe("feedback components", () => {
  it("renders an empty state", () => {
    render(<EmptyState title="No students" description="Add one to begin" />);
    expect(screen.getByText("No students")).toBeInTheDocument();
    expect(screen.getByText("Add one to begin")).toBeInTheDocument();
  });

  it("renders an error state and fires retry", async () => {
    const onRetry = vi.fn();
    render(<ErrorState error={new Error("nope")} onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("does not announce an empty result as an event", () => {
    // Nothing happened — a filter simply matched nothing — so interrupting a
    // screen-reader user with an alert would inform no one.
    render(<EmptyState title="No results" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("ApiErrorState", () => {
  function apiError(kind: ApiError["kind"], message: string, status: number) {
    return new ApiError({ kind, status, message, code: "TestException" });
  }

  it("titles a connection failure differently from a server failure", () => {
    const { unmount } = render(
      <ApiErrorState error={apiError("network", "boom", 0)} />,
    );
    expect(screen.getByText(/can't reach the server/i)).toBeInTheDocument();
    unmount();

    render(<ApiErrorState error={apiError("server", "boom", 500)} />);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it("prefers the server's own explanation over the category's copy", () => {
    render(
      <ApiErrorState
        error={apiError("forbidden", "Your subscription has expired.", 403)}
      />,
    );
    expect(
      screen.getByText("Your subscription has expired."),
    ).toBeInTheDocument();
  });

  it("offers retry for a transient failure but not for a refusal", () => {
    const onRetry = vi.fn();
    const { unmount } = render(
      <ApiErrorState
        error={apiError("network", "boom", 0)}
        onRetry={onRetry}
      />,
    );
    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();
    unmount();

    render(
      <ApiErrorState
        error={apiError("forbidden", "no", 403)}
        onRetry={onRetry}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /try again/i }),
    ).not.toBeInTheDocument();
  });

  it("falls back to the generic treatment for a non-API error", () => {
    render(<ApiErrorState error={new Error("unexpected")} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

describe("access and connectivity states", () => {
  it("announces a refusal and offers no retry", () => {
    render(<ForbiddenState />);
    expect(screen.getByRole("alert")).toHaveTextContent(/don't have access/i);
    expect(
      screen.queryByRole("button", { name: /try again/i }),
    ).not.toBeInTheDocument();
  });

  it("makes retry the primary move when offline", async () => {
    const onRetry = vi.fn();
    render(<OfflineState onRetry={onRetry} />);

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("renders an inline error with its own retry", async () => {
    const onRetry = vi.fn();
    render(
      <InlineError description="Could not load campuses" onRetry={onRetry} />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not load campuses",
    );
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe("skeletons", () => {
  it("announces the region once instead of every bar", () => {
    render(<SelectionSkeleton label="Loading options" />);

    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading options")).toBeInTheDocument();
    // One announcement for the whole region — the bars are decoration.
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("builds the requested table shape", () => {
    render(<TableSkeleton rows={3} columns={2} label="Loading students" />);
    expect(screen.getByText("Loading students")).toBeInTheDocument();
  });
});
