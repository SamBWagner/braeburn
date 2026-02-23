import { describe, it, expect, vi } from "vitest";
import type { StepRunContext } from "../index.js";
import type { CommandOutputLine } from "../../runner.js";
import macosStep from "../macos.js";

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

describe("macosStep", () => {
  it("has the correct id and name", () => {
    expect(macosStep.id).toBe("macos");
    expect(macosStep.name).toBe("macOS");
  });

  it("is always available", async () => {
    expect(await macosStep.checkIsAvailable()).toBe(true);
  });

  describe("run", () => {
    it("reports up to date when no updates are available", async () => {
      const outputLines: CommandOutputLine[] = [];
      const logLines: string[] = [];
      const context = createMockContext({
        captureOutputResult: "Software Update Tool\nNo new software available.",
        outputLines,
        logLines,
      });

      await macosStep.run(context);

      expect(outputLines).toEqual([
        { text: "macOS is already up to date.", source: "stdout" },
      ]);
      expect(context.runStep).not.toHaveBeenCalled();
    });

    it("logs the update list output regardless of path", async () => {
      const logLines: string[] = [];
      const context = createMockContext({
        captureOutputResult: "No new software available.",
        logLines,
      });

      await macosStep.run(context);

      expect(logLines).toContain("No new software available.");
    });

    it("runs softwareupdate when updates are found", async () => {
      const runStepCommands: string[] = [];
      const outputLines: CommandOutputLine[] = [];
      const context = createMockContext({
        captureOutputResult: "Software Update found the following:\n* macOS 15.1",
        runStepCommands,
        outputLines,
      });

      await macosStep.run(context);

      expect(outputLines).toEqual([
        { text: "Software Update found the following:\n* macOS 15.1", source: "stdout" },
        { text: "Updates found — installing now...", source: "stdout" },
      ]);
      expect(runStepCommands).toEqual(["softwareupdate -ia --verbose"]);
    });

    it("outputs the update list before installing", async () => {
      const outputLines: CommandOutputLine[] = [];
      const updateOutput = "Software Update found:\n* macOS 15.1";
      const context = createMockContext({
        captureOutputResult: updateOutput,
        outputLines,
      });

      await macosStep.run(context);

      expect(outputLines[0].text).toBe(updateOutput);
      expect(outputLines[1].text).toContain("Updates found");
    });

    it("calls captureOutput with softwareupdate -l", async () => {
      const context = createMockContext({
        captureOutputResult: "No new software available.",
      });

      await macosStep.run(context);

      expect(context.captureOutput).toHaveBeenCalledOnce();
      const callArgs = vi.mocked(context.captureOutput).mock.calls[0][0];
      expect(callArgs.shellCommand).toContain("softwareupdate -l");
    });
  });
});
