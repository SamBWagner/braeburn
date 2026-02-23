import { describe, it, expect, vi } from "vitest";
import type { StepRunContext } from "../index.js";
import type { CommandOutputLine } from "../../runner.js";
import pyenvStep from "../pyenv.js";

function createMockContext(overrides: Partial<{
  runStepCommands: string[];
  captureOutputResult: string;
  outputLines: CommandOutputLine[];
  logLines: string[];
}> = {}): StepRunContext {
  const runStepCommands = overrides.runStepCommands ?? [];
  const outputLines = overrides.outputLines ?? [];
  const logLines = overrides.logLines ?? [];

  return {
    onOutputLine: (line) => { outputLines.push(line); },
    logWriter: async (line) => { logLines.push(line); },
    runStep: vi.fn(async (cmd: string) => { runStepCommands.push(cmd); }),
    captureOutput: vi.fn(async () => overrides.captureOutputResult ?? ""),
  };
}

describe("pyenvStep", () => {
  it("has the correct id and name", () => {
    expect(pyenvStep.id).toBe("pyenv");
    expect(pyenvStep.name).toBe("pyenv");
  });

  it("has brewPackageToInstall set", () => {
    expect(pyenvStep.brewPackageToInstall).toBe("pyenv");
  });

  describe("run", () => {
    it("upgrades pyenv via brew then installs the detected Python version", async () => {
      const runStepCommands: string[] = [];
      const context = createMockContext({
        runStepCommands,
        captureOutputResult: "3.12.5",
      });

      await pyenvStep.run(context);

      expect(runStepCommands).toEqual([
        "brew upgrade pyenv",
        "pyenv install --skip-existing 3.12.5",
      ]);
    });

    it("skips install when version detection returns empty string", async () => {
      const runStepCommands: string[] = [];
      const outputLines: CommandOutputLine[] = [];
      const context = createMockContext({
        runStepCommands,
        captureOutputResult: "",
        outputLines,
      });

      await pyenvStep.run(context);

      expect(runStepCommands).toEqual(["brew upgrade pyenv"]);
      expect(outputLines).toContainEqual({
        text: "Could not determine latest Python version — skipping pyenv install.",
        source: "stderr",
      });
    });

    it("calls captureOutput with the version detection command", async () => {
      const context = createMockContext({ captureOutputResult: "3.11.0" });
      await pyenvStep.run(context);

      expect(context.captureOutput).toHaveBeenCalledOnce();
      const callArgs = vi.mocked(context.captureOutput).mock.calls[0][0];
      expect(callArgs.shellCommand).toContain("pyenv install -l");
    });

    it("passes the detected version to pyenv install", async () => {
      const runStepCommands: string[] = [];
      const context = createMockContext({
        runStepCommands,
        captureOutputResult: "3.13.0",
      });

      await pyenvStep.run(context);

      expect(runStepCommands[1]).toBe("pyenv install --skip-existing 3.13.0");
    });
  });
});
