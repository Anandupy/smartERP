import { fireEvent } from "@testing-library/react";
import type { TooltipRenderProps } from "react-joyride";
import { describe, expect, it, vi } from "vitest";

import { GuideTooltip } from "@/core/guides/guide-tooltip";

import { render, screen } from "@tests/setup/render";

/**
 * The guide card in isolation, exercised with hand-built `TooltipRenderProps`
 * rather than a real `<Joyride>` — this is the "component test: tooltip
 * rendering, next/back, skip" coverage `docs/guides.md` §13 calls for,
 * without needing a real tour running.
 */
function tooltipProps(
  overrides: Partial<TooltipRenderProps> = {},
): TooltipRenderProps {
  const noop = () => {};
  return {
    continuous: true,
    index: 0,
    isLastStep: true,
    size: 1,
    step: {
      target: '[data-guide="fixture"]',
      title: "Create your first academic year",
      content: "Academic years are the timeframes a branch operates in.",
      data: { advanceOn: "action", position: 1, total: 4 },
    } as TooltipRenderProps["step"],
    backProps: {
      "aria-label": "Back",
      "data-action": "back",
      onClick: noop,
      role: "button",
      title: "Back",
    },
    closeProps: {
      "aria-label": "Close",
      "data-action": "close",
      onClick: noop,
      role: "button",
      title: "Close",
    },
    primaryProps: {
      "aria-label": "Next",
      "data-action": "primary",
      onClick: noop,
      role: "button",
      title: "Next",
    },
    skipProps: {
      "aria-label": "Skip",
      "data-action": "skip",
      onClick: noop,
      role: "button",
      title: "Skip",
    },
    tooltipProps: { "aria-modal": true, role: "alertdialog" },
    controls: {
      close: noop,
      go: noop,
      info: () => ({}) as never,
      next: noop,
      open: noop,
      prev: noop,
      replay: noop,
      reset: noop,
      skip: noop,
      start: noop,
      stop: noop,
    },
    ...overrides,
  };
}

describe("GuideTooltip", () => {
  it("shows the step counter, title and description", () => {
    render(<GuideTooltip {...tooltipProps()} />);

    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
    expect(
      screen.getByText("Create your first academic year"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/academic years are the timeframes/i),
    ).toBeInTheDocument();
  });

  it("hides the Next button for an action step", () => {
    render(
      <GuideTooltip
        {...tooltipProps({
          step: {
            ...tooltipProps().step,
            data: { advanceOn: "action", position: 2, total: 4 },
          } as TooltipRenderProps["step"],
        })}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /^next$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/complete this step in the app/i),
    ).toBeInTheDocument();
  });

  it("shows the Next button for a next-button step, and calls through on click", () => {
    const onClick = vi.fn();
    render(
      <GuideTooltip
        {...tooltipProps({
          step: {
            ...tooltipProps().step,
            data: { advanceOn: "next-button", position: 1, total: 2 },
          } as TooltipRenderProps["step"],
          primaryProps: {
            "aria-label": "Next",
            "data-action": "primary",
            onClick,
            role: "button",
            title: "Next",
          },
        })}
      />,
    );

    const next = screen.getByRole("button", { name: /^next$/i });
    fireEvent.click(next);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText(/complete this step in the app/i),
    ).not.toBeInTheDocument();
  });

  it("keeps the Next button's accessible name stable even on the last step", () => {
    // Joyride's own `primaryProps` carries `aria-label: "Last"` (not "Next")
    // when this is the tour's final step — an explicit override is required
    // or the accessible name silently stops matching the visible text.
    render(
      <GuideTooltip
        {...tooltipProps({
          isLastStep: true,
          step: {
            ...tooltipProps().step,
            data: { advanceOn: "next-button", position: 3, total: 3 },
          } as TooltipRenderProps["step"],
          primaryProps: {
            "aria-label": "Last",
            "data-action": "primary",
            onClick: () => {},
            role: "button",
            title: "Last",
          },
        })}
      />,
    );

    expect(
      screen.getByRole("button", { name: /^next$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^last$/i }),
    ).not.toBeInTheDocument();
  });

  it("wires the skip control through to skipProps.onClick", () => {
    const onClick = vi.fn();
    render(
      <GuideTooltip
        {...tooltipProps({
          skipProps: {
            "aria-label": "Skip",
            "data-action": "skip",
            onClick,
            role: "button",
            title: "Skip",
          },
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Skip guide" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("wires the close control through to closeProps.onClick", () => {
    const onClick = vi.fn();
    render(
      <GuideTooltip
        {...tooltipProps({
          closeProps: {
            "aria-label": "Close",
            "data-action": "close",
            onClick,
            role: "button",
            title: "Close",
          },
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("omits the step counter when the step carries no guide data", () => {
    render(
      <GuideTooltip
        {...tooltipProps({
          step: {
            target: '[data-guide="fixture"]',
            title: "Untitled",
            content: "No data payload.",
          } as TooltipRenderProps["step"],
        })}
      />,
    );

    expect(screen.queryByText(/^step \d/i)).not.toBeInTheDocument();
  });
});
