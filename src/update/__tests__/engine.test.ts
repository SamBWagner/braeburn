import { describe, it, expect, vi } from "vitest";
import { runUpdateEngine, type ConfirmationAnswer } from "../engine.js";
import type { Step, StepRunContext } from "../../steps/index.js";
import type { CommandOutputLine } from "../../runner.js";

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

function createEngineDependencies() {
  const shellCommands: string[] = [];
  const logLines: string[] = [];

  const createLogWriter = vi.fn(async () => {
    return async (line: string) => {
      logLines.push(line);
    };
  });

  const runCommand = vi.fn(async (options: {
    shellCommand: string;
    onOutputLine: (line: CommandOutputLine) => void;
    logWriter: (line: string) => Promise<void>;
  }) => {
    shellCommands.push(options.shellCommand);
    await options.logWriter(options.shellCommand);
    options.onOutputLine({ text: options.shellCommand, source: "stdout" });
  });

  const createStepRunContext = (
    onOutputLine: (line: CommandOutputLine) => void,
    logWriter: (line: string) => Promise<void>,
  ): StepRunContext => ({
    onOutputLine,
    logWriter,
    runStep: async (shellCommand) => {
      shellCommands.push(shellCommand);
      await logWriter(shellCommand);
      onOutputLine({ text: shellCommand, source: "stdout" });
    },
    captureOutput: async () => "",
  });

  return {
    shellCommands,
    logLines,
    dependencies: {
      createLogWriter,
      runCommand,
      createStepRunContext,
    },
  };
}

describe("runUpdateEngine", () => {
  it("runs an available step and marks it complete", async () => {
    const { shellCommands, dependencies } = createEngineDependencies();
    const runStep = vi.fn(async (context: StepRunContext) => {
      await context.runStep("npm update -g");
    });
    const states: string[] = [];

    const result = await runUpdateEngine({
      steps: [makeStep({ id: "npm", name: "npm", run: runStep })],
      promptMode: "interactive",
      version: "1.0.0",
      logoVisibility: "hidden",
      askForConfirmation: async () => "yes",
      collectVersions: async () => [{ label: "Node", value: "v24.0.0" }],
      onStateChanged: (state) => {
        states.push(state.currentPhase);
      },
      dependencies,
    });

    expect(runStep).toHaveBeenCalledOnce();
    expect(shellCommands).toEqual(["npm update -g"]);
    expect(result.completedStepRecords).toEqual([{ phase: "complete", summaryNote: "updated" }]);
    expect(result.versionReport).toEqual([{ label: "Node", value: "v24.0.0" }]);
    expect(states).toContain("running");
    expect(states.at(-1)).toBe("complete");
  });

  it("skips installable unavailable steps when the user declines install", async () => {
    const { dependencies } = createEngineDependencies();
    const runStep = vi.fn(async () => {});

    const result = await runUpdateEngine({
      steps: [
        makeStep({
          id: "mas",
          name: "Mac App Store",
          brewPackageToInstall: "mas",
          checkIsAvailable: async () => false,
          run: runStep,
        }),
      ],
      promptMode: "interactive",
      version: "1.0.0",
      logoVisibility: "hidden",
      askForConfirmation: async () => "no",
      collectVersions: async () => [],
      onStateChanged: () => {},
      dependencies,
    });

    expect(runStep).not.toHaveBeenCalled();
    expect(result.completedStepRecords).toEqual([{ phase: "skipped" }]);
  });

  it("marks unavailable non-installable steps as not available", async () => {
    const { dependencies } = createEngineDependencies();
    const runStep = vi.fn(async () => {});

    const result = await runUpdateEngine({
      steps: [
        makeStep({
          id: "custom",
          name: "Custom Tool",
          checkIsAvailable: async () => false,
          run: runStep,
        }),
      ],
      promptMode: "interactive",
      version: "1.0.0",
      logoVisibility: "hidden",
      askForConfirmation: async () => "yes",
      collectVersions: async () => [],
      onStateChanged: () => {},
      dependencies,
    });

    expect(runStep).not.toHaveBeenCalled();
    expect(result.completedStepRecords).toEqual([{ phase: "not-available", summaryNote: "not installed" }]);
  });

  it("switches to auto-accept after a force answer", async () => {
    const { shellCommands, dependencies } = createEngineDependencies();
    const answers: ConfirmationAnswer[] = ["force"];
    let answerIndex = 0;

    const stepOneRun = vi.fn(async (context: StepRunContext) => {
      await context.runStep("step-one");
    });
    const stepTwoRun = vi.fn(async (context: StepRunContext) => {
      await context.runStep("step-two");
    });

    const result = await runUpdateEngine({
      steps: [
        makeStep({ id: "one", name: "One", run: stepOneRun }),
        makeStep({ id: "two", name: "Two", run: stepTwoRun }),
      ],
      promptMode: "interactive",
      version: "1.0.0",
      logoVisibility: "hidden",
      askForConfirmation: async () => {
        const answer = answers[answerIndex] ?? "yes";
        answerIndex += 1;
        return answer;
      },
      collectVersions: async () => [],
      onStateChanged: () => {},
      dependencies,
    });

    expect(answerIndex).toBe(1);
    expect(stepOneRun).toHaveBeenCalledOnce();
    expect(stepTwoRun).toHaveBeenCalledOnce();
    expect(shellCommands).toEqual(["step-one", "step-two"]);
    expect(result.completedStepRecords).toEqual([
      { phase: "complete", summaryNote: "updated" },
      { phase: "complete", summaryNote: "updated" },
    ]);
  });
});
