import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StepRunContext } from "../index.js";

const { checkCommandExistsMock, checkPathExistsMock } = vi.hoisted(() => ({
  checkCommandExistsMock: vi.fn(),
  checkPathExistsMock: vi.fn(),
}));

vi.mock("../runtime.js", () => ({
  checkCommandExists: checkCommandExistsMock,
  checkPathExists: checkPathExistsMock,
}));

import cleanupStep from "../cleanup.js";
import dotnetStep from "../dotnet.js";
import homebrewStep from "../homebrew.js";
import masStep from "../mas.js";
import npmStep from "../npm.js";
import ohmyzshStep from "../ohmyzsh.js";
import pipStep from "../pip.js";

type CommandBackedStepSpec = {
  stepId: string;
  step: {
    checkIsAvailable: () => Promise<boolean>;
    run: (context: StepRunContext) => Promise<void>;
  };
  availabilityCommand: string;
  runShellCommand: string;
};

const commandBackedStepSpecs: CommandBackedStepSpec[] = [
  {
    stepId: homebrewStep.id,
    step: homebrewStep,
    availabilityCommand: "brew",
    runShellCommand: "brew update && brew upgrade",
  },
  {
    stepId: npmStep.id,
    step: npmStep,
    availabilityCommand: "npm",
    runShellCommand: "npm update -g",
  },
  {
    stepId: pipStep.id,
    step: pipStep,
    availabilityCommand: "pip3",
    runShellCommand: "pip3 list --outdated --format=columns | tail -n +3 | awk '{print $1}' | xargs -n1 pip3 install -U",
  },
  {
    stepId: dotnetStep.id,
    step: dotnetStep,
    availabilityCommand: "dotnet",
    runShellCommand: "dotnet tool update --global --all",
  },
  {
    stepId: masStep.id,
    step: masStep,
    availabilityCommand: "mas",
    runShellCommand: "mas upgrade",
  },
  {
    stepId: cleanupStep.id,
    step: cleanupStep,
    availabilityCommand: "brew",
    runShellCommand: "brew cleanup",
  },
];

function createRunOnlyContext(recordedCommands: string[]): StepRunContext {
  return {
    onOutputLine: () => {},
    logWriter: async () => {},
    runStep: vi.fn(async (shellCommand: string) => {
      recordedCommands.push(shellCommand);
    }),
    captureOutput: vi.fn(async () => ""),
  };
}

describe("tool step command isolation", () => {
  beforeEach(() => {
    checkCommandExistsMock.mockReset();
    checkPathExistsMock.mockReset();
  });

  for (const stepSpec of commandBackedStepSpecs) {
    it(`${stepSpec.stepId} checks availability with the expected command`, async () => {
      checkCommandExistsMock.mockResolvedValueOnce(true);

      await expect(stepSpec.step.checkIsAvailable()).resolves.toBe(true);
      expect(checkCommandExistsMock).toHaveBeenCalledWith(stepSpec.availabilityCommand);
    });

    it(`${stepSpec.stepId} runs the expected shell command`, async () => {
      const runStepCommands: string[] = [];
      const context = createRunOnlyContext(runStepCommands);

      await stepSpec.step.run(context);

      expect(runStepCommands).toEqual([stepSpec.runShellCommand]);
    });
  }

  it("mas step declares its brew package", () => {
    expect(masStep.brewPackageToInstall).toBe("mas");
  });

  it("ohmyzsh checks availability using the upgrade script path", async () => {
    checkPathExistsMock.mockResolvedValueOnce(true);

    await expect(ohmyzshStep.checkIsAvailable()).resolves.toBe(true);
    expect(checkPathExistsMock).toHaveBeenCalledWith(
      expect.stringContaining(".oh-my-zsh/tools/upgrade.sh"),
    );
  });

  it("ohmyzsh runs zsh against the upgrade script path", async () => {
    const runStepCommands: string[] = [];
    const context = createRunOnlyContext(runStepCommands);

    await ohmyzshStep.run(context);

    expect(runStepCommands).toHaveLength(1);
    expect(runStepCommands[0]).toContain('zsh "');
    expect(runStepCommands[0]).toContain(".oh-my-zsh/tools/upgrade.sh");
  });
});
