import { describe, it, expect } from "vitest";
import { applyUpdateCommandResult, shouldRenderRuntimeStateImmediately } from "../update.js";
import type { UpdateState } from "../../update/state.js";

function makeUpdateState(overrides: Partial<UpdateState> = {}): UpdateState {
  return {
    steps: [],
    version: "1.0.0",
    logoVisibility: "hidden",
    currentStepIndex: 0,
    currentPhase: "running",
    completedStepRecords: [],
    currentOutputLines: [],
    currentPrompt: undefined,
    runCompletion: "in-progress",
    versionReport: undefined,
    ...overrides,
  };
}

describe("applyUpdateCommandResult", () => {
  it("sets a non-zero exit code when any step fails", () => {
    const processWithExitCode = { exitCode: 0 };

    applyUpdateCommandResult({ failedStepCount: 1 }, processWithExitCode);

    expect(processWithExitCode.exitCode).toBe(1);
  });

  it("leaves the exit code unchanged when all steps succeed", () => {
    const processWithExitCode = { exitCode: 0 };

    applyUpdateCommandResult({ failedStepCount: 0 }, processWithExitCode);

    expect(processWithExitCode.exitCode).toBe(0);
  });
});

describe("shouldRenderRuntimeStateImmediately", () => {
  it("throttles repeated running-state renders inside the runtime interval", () => {
    const state = makeUpdateState();

    expect(shouldRenderRuntimeStateImmediately(state, 1000, 1040)).toBe(false);
  });

  it("allows running-state renders after the runtime interval", () => {
    const state = makeUpdateState();

    expect(shouldRenderRuntimeStateImmediately(state, 1000, 1100)).toBe(true);
  });

  it("always allows non-runtime phase renders", () => {
    const state = makeUpdateState({ currentPhase: "prompting-to-run" });

    expect(shouldRenderRuntimeStateImmediately(state, 1000, 1001)).toBe(true);
  });
});
