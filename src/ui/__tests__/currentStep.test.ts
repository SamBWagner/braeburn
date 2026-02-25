import { describe, it, expect } from "vitest";
import { buildActiveStepLines } from "../currentStep.js";
import { stripAnsi } from "../../__tests__/helpers.js";
import type { DisplayStep, StepPhase } from "../state.js";

function makeStep(overrides: Partial<DisplayStep> = {}): DisplayStep {
  return {
    id: "test",
    name: "Test Step",
    description: "A step for testing",
    categoryId: "cli-tools",
    ...overrides,
  };
}

describe("buildActiveStepLines", () => {
  it("renders the step header, description, and running indicator", () => {
    const lines = buildActiveStepLines({
      step: makeStep({ name: "Homebrew", description: "Update Homebrew and installed packages" }),
      stepNumber: 1,
      totalSteps: 5,
      phase: "running",
    });
    expect(lines.map(stripAnsi)).toEqual([
      "  ─── Step 1/5  Homebrew  ────────────────────",
      "  · Update Homebrew and installed packages",
      "  ◐ Running...",
    ]);
  });

  it("includes step number and total in the header", () => {
    const lines = buildActiveStepLines({
      step: makeStep(),
      stepNumber: 3,
      totalSteps: 10,
      phase: "running",
    });
    expect(lines.map(stripAnsi)).toEqual([
      "  ─── Step 3/10  Test Step  ────────────────────",
      "  · A step for testing",
      "  ◐ Running...",
    ]);
  });

  it("shows Installing indicator for the installing phase", () => {
    const lines = buildActiveStepLines({
      step: makeStep(),
      stepNumber: 1,
      totalSteps: 1,
      phase: "installing",
    });
    expect(lines.map(stripAnsi)).toEqual([
      "  ─── Step 1/1  Test Step  ────────────────────",
      "  · A step for testing",
      "  ◐ Installing...",
    ]);
  });

  it("omits the running indicator for non-active phases", () => {
    const nonActivePhases: StepPhase[] = ["pending", "complete", "failed", "skipped"];
    for (const phase of nonActivePhases) {
      const lines = buildActiveStepLines({
        step: makeStep(),
        stepNumber: 1,
        totalSteps: 1,
        phase,
      });
      expect(lines.map(stripAnsi)).toEqual([
        "  ─── Step 1/1  Test Step  ────────────────────",
        "  · A step for testing",
      ]);
    }
  });
});
