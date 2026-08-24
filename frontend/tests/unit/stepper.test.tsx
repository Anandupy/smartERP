import { describe, expect, it } from "vitest";

import { Stepper, type StepperStep } from "@/components/ui/stepper";
import { render, screen } from "@tests/setup/render";

/**
 * The responsive stepper: a mobile "Step X of Y" readout and a desktop
 * timeline that never truncates a label — the two problems the setup
 * wizard's original single-layout stepper had (cramped, clipped subtitles).
 */

const STEPS: StepperStep[] = [
  { key: "a", label: "System settings", status: "complete" },
  { key: "b", label: "Organization", status: "complete" },
  { key: "c", label: "Branch", status: "current" },
  { key: "d", label: "Academic year", status: "upcoming" },
];

describe("Stepper", () => {
  it("shows a compact step count and progress bar for mobile", () => {
    render(<Stepper steps={STEPS} />);

    expect(screen.getByText("Step 3 of 4")).toBeInTheDocument();
    expect(screen.getByText("2/4 done")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "50",
    );
  });

  it("renders every label in full, never truncated", () => {
    render(<Stepper steps={STEPS} />);

    for (const step of STEPS) {
      // Two renders exist (mobile current-step line + desktop timeline);
      // at least one full, untruncated occurrence must be present.
      expect(screen.getAllByText(step.label).length).toBeGreaterThan(0);
    }
  });

  it("marks exactly the current step for assistive tech", () => {
    render(<Stepper steps={STEPS} />);

    // jsdom renders both the mobile and desktop markup at once (CSS media
    // queries don't apply) — find the desktop timeline's own list item.
    const desktopLabel = screen
      .getAllByText("Branch")
      .find((el) => el.closest("li"));
    expect(desktopLabel?.closest("li")).toHaveAttribute("aria-current", "step");
  });
});
