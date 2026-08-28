import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { z } from "zod";
import { beforeEach, describe, expect, it } from "vitest";

import { apiConfig } from "@/config";
import {
  createMemoryWorkspaceStorage,
  setWorkspaceStorage,
  useWorkspaceStore,
} from "@/core/workspace";
import { Form, useZodForm } from "@/components/form";
import { AcademicUnitPicker } from "@/features/academic-unit";
import { toWorkspaceAvailability } from "@/features/workspace";

import {
  academicUnitDto,
  childUnitDto,
  secondChildUnitDto,
} from "@tests/fixtures/academic-unit";
import { successEnvelope } from "@tests/fixtures/api";
import { identityDto } from "@tests/fixtures/workspace";
import { server } from "@tests/mocks/server";
import { render, screen } from "@tests/setup/render";

/**
 * `AcademicUnitPicker` is the frontend half of the backend's leaf-only
 * placement rule (`backend/docs/planning/academic-placement-refinement.md`
 * §4): a structural node ("Grade 1") must never be offered as somewhere a
 * learner can be placed, only its leaves ("Grade 1 → Division A"). These
 * tests cover the picker in isolation, the same way `academic-units.test.tsx`
 * exercises `ProgramPicker` — a minimal host form, real MSW responses, no
 * mocked module boundary.
 */

const API_BASE = apiConfig.baseURL.replace(/\/$/, "");

const pickerFormSchema = z.object({ academicUnitId: z.string().optional() });

/** The picker, hosted in the same minimal form shape every real caller uses. */
function PickerHost(
  props: Omit<React.ComponentProps<typeof AcademicUnitPicker>, "name">,
) {
  const form = useZodForm(pickerFormSchema, {
    defaultValues: { academicUnitId: "" },
  });

  return (
    <Form {...form}>
      <form>
        <AcademicUnitPicker {...props} />
      </form>
    </Form>
  );
}

beforeEach(() => {
  setWorkspaceStorage(createMemoryWorkspaceStorage());
  useWorkspaceStore.setState({
    availability: toWorkspaceAvailability(identityDto()),
    selection: {
      organizationId: "org-1",
      branchId: "branch-1",
      academicYearId: "ay-2026",
    },
    status: "ready",
    reason: null,
  });
});

function withUnits(...units: ReturnType<typeof academicUnitDto>[]) {
  server.use(
    http.get(`${API_BASE}/academic-units`, () =>
      HttpResponse.json(successEnvelope(units)),
    ),
  );
}

/** Every rendered option's own text, trimmed — sidesteps accessible-name whitespace quirks around the `code` hint span. */
async function optionTexts(): Promise<string[]> {
  const options = await screen.findAllByRole("option");
  return options.map((option) => option.textContent?.trim() ?? "");
}

describe("AcademicUnitPicker — placement targets", () => {
  it("offers only leaves, never the structural parent above them", async () => {
    const user = userEvent.setup();
    // "Std 1" has two live children — exactly "Grade 1" with "Division A/B"
    // under it — so it must not appear as a choosable placement.
    withUnits(
      academicUnitDto({ isPlacementTarget: false }),
      childUnitDto(),
      secondChildUnitDto(),
    );

    render(<PickerHost />);

    await user.click(
      await screen.findByRole("combobox", { name: /academic placement/i }),
    );

    const texts = await optionTexts();
    expect(texts.some((text) => text.startsWith("Std 1 → Div A"))).toBe(true);
    expect(texts.some((text) => text.startsWith("Std 1 → Div B"))).toBe(true);
    expect(texts.some((text) => text.startsWith("Std 1H"))).toBe(false);
  });

  it("shows the full path as the option label, not the bare name", async () => {
    const user = userEvent.setup();
    withUnits(academicUnitDto({ isPlacementTarget: false }), childUnitDto());

    render(<PickerHost />);

    await user.click(
      await screen.findByRole("combobox", { name: /academic placement/i }),
    );

    // "Division A" alone is exactly the ambiguity this picker exists to
    // remove — every option must read as the full path, not the bare name.
    const texts = await optionTexts();
    expect(texts.some((text) => text.startsWith("Std 1 → Div A"))).toBe(true);
    expect(texts).not.toContain("Div A");
  });

  it("tells a structural-only program apart from an empty one", async () => {
    // Only "Std 1" exists, with no leaf beneath it — a registrar needs to
    // know the structure exists but nothing is placeable yet, not that
    // nothing was configured at all.
    withUnits(academicUnitDto({ isPlacementTarget: false }));

    render(<PickerHost />);

    expect(
      await screen.findByText(/none is itself a placement target yet/i),
    ).toBeInTheDocument();
  });

  it("reports a genuinely empty program distinctly", async () => {
    withUnits();

    render(<PickerHost />);

    expect(
      await screen.findByText(
        /there are no academic units in the active branch and year yet/i,
      ),
    ).toBeInTheDocument();
  });

  it("opts back into every unit when placementTargetsOnly is off", async () => {
    const user = userEvent.setup();
    withUnits(academicUnitDto({ isPlacementTarget: false }), childUnitDto());

    render(<PickerHost placementTargetsOnly={false} />);

    await user.click(
      await screen.findByRole("combobox", { name: /academic placement/i }),
    );

    const texts = await optionTexts();
    expect(texts.some((text) => text.startsWith("Std 1H"))).toBe(true);
  });
});
