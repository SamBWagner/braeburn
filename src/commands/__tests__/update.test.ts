import { describe, it, expect } from "vitest";
import { applyUpdateCommandResult } from "../update.js";

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
