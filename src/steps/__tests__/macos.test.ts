import { describe, it, expect, vi } from "vitest";
import type { StepRunContext } from "../index.js";
import type { CommandOutputLine } from "../../runner.js";
import macosStep from "../macos.js";

function createMockContext(overrides: Partial<{
  runStepCommands: string[];
  checkOutputLines: string[];
  runStepAndCaptureOutputResult: string;
  outputLines: CommandOutputLine[];
}> = {}): StepRunContext {
  const runStepCommands = overrides.runStepCommands ?? [];
  const checkOutputLines = overrides.checkOutputLines ?? [];
  const outputLines = overrides.outputLines ?? [];

  return {
    onOutputLine: (line) => { outputLines.push(line); },
    logWriter: async () => {},
    runStep: vi.fn(async (shellCommand: string) => { runStepCommands.push(shellCommand); }),
    runStepAndCaptureOutput: vi.fn(async (shellCommand: string) => {
      for (const line of checkOutputLines) {
        outputLines.push({ text: line, source: "stdout" });
      }

      return overrides.runStepAndCaptureOutputResult ?? "";
    }),
    captureOutput: vi.fn(async () => ""),
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
      const context = createMockContext({
        runStepAndCaptureOutputResult: "Software Update Tool\nNo new software available.",
        checkOutputLines: [
          "Software Update Tool",
          "No new software available.",
        ],
        outputLines,
      });

      await macosStep.run(context);

      expect(outputLines).toEqual([
        { text: "Checking for macOS updates...", source: "stdout" },
        { text: "Software Update Tool", source: "stdout" },
        { text: "No new software available.", source: "stdout" },
        { text: "macOS is already up to date.", source: "stdout" },
      ]);
      expect(context.runStep).not.toHaveBeenCalled();
    });

    it("shows a checking status line before invoking softwareupdate", async () => {
      const outputLines: CommandOutputLine[] = [];
      const context = createMockContext({
        runStepAndCaptureOutputResult: "No new software available.",
        outputLines,
      });

      await macosStep.run(context);

      expect(outputLines[0]).toEqual({
        text: "Checking for macOS updates...",
        source: "stdout",
      });
    });

    it("runs softwareupdate when updates are found", async () => {
      const runStepCommands: string[] = [];
      const outputLines: CommandOutputLine[] = [];
      const context = createMockContext({
        runStepAndCaptureOutputResult: "Software Update found the following:\n* macOS 15.1",
        checkOutputLines: [
          "Software Update found the following:",
          "* macOS 15.1",
        ],
        runStepCommands,
        outputLines,
      });

      await macosStep.run(context);

      expect(outputLines).toEqual([
        { text: "Checking for macOS updates...", source: "stdout" },
        { text: "Software Update found the following:", source: "stdout" },
        { text: "* macOS 15.1", source: "stdout" },
        { text: "Updates found — installing now...", source: "stdout" },
      ]);
      expect(runStepCommands).toEqual(["softwareupdate -ia --verbose"]);
    });

    it("starts installation after the update check output has streamed", async () => {
      const outputLines: CommandOutputLine[] = [];
      const context = createMockContext({
        runStepAndCaptureOutputResult: "Software Update found:\n* macOS 15.1",
        checkOutputLines: [
          "Software Update found:",
          "* macOS 15.1",
        ],
        outputLines,
      });

      await macosStep.run(context);

      expect(outputLines[1].text).toBe("Software Update found:");
      expect(outputLines[3].text).toContain("Updates found");
    });

    it("calls runStepAndCaptureOutput with softwareupdate -l", async () => {
      const context = createMockContext({
        runStepAndCaptureOutputResult: "No new software available.",
      });

      await macosStep.run(context);

      expect(context.runStepAndCaptureOutput).toHaveBeenCalledOnce();
      expect(vi.mocked(context.runStepAndCaptureOutput).mock.calls[0][0]).toContain("softwareupdate -l");
      expect(context.captureOutput).not.toHaveBeenCalled();
    });
  });
});
