import { describe, it, expect } from "vitest";
import { createInitialAppState } from "../state.js";
import type { Step } from "../../steps/index.js";

function makeStep(overrides: Partial<Step> = {}): Step {
  return {
    id: "test",
    name: "Test",
    description: "A test step",
    stage: "tools",
    checkIsAvailable: async () => true,
    run: async () => {},
    ...overrides,
  };
}

describe("createInitialAppState", () => {
  it("returns state with the provided steps", () => {
    const steps = [makeStep({ id: "a" }), makeStep({ id: "b" })];
    const state = createInitialAppState(steps, "1.0.0", "visible");
    expect(state.steps).toBe(steps);
  });

  it("sets the version", () => {
    const state = createInitialAppState([], "1.2.3", "visible");
    expect(state.version).toBe("1.2.3");
  });

  it("sets logoVisibility", () => {
    const visible = createInitialAppState([], "1.0.0", "visible");
    const hidden = createInitialAppState([], "1.0.0", "hidden");
    expect(visible.logoVisibility).toBe("visible");
    expect(hidden.logoVisibility).toBe("hidden");
  });

  it("starts at step index 0 with checking-availability phase", () => {
    const state = createInitialAppState([makeStep()], "1.0.0", "visible");
    expect(state.currentStepIndex).toBe(0);
    expect(state.currentPhase).toBe("checking-availability");
  });

  it("starts with empty completed records and output lines", () => {
    const state = createInitialAppState([makeStep()], "1.0.0", "visible");
    expect(state.completedStepRecords).toEqual([]);
    expect(state.currentOutputLines).toEqual([]);
  });

  it("starts with runCompletion as in-progress", () => {
    const state = createInitialAppState([], "1.0.0", "visible");
    expect(state.runCompletion).toBe("in-progress");
  });

  it("starts with no prompt and no version report", () => {
    const state = createInitialAppState([], "1.0.0", "visible");
    expect(state.currentPrompt).toBeUndefined();
    expect(state.versionReport).toBeUndefined();
  });
});
