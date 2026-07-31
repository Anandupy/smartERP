import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { EmptyState, ErrorState } from "@/shared/components/feedback";
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
});
