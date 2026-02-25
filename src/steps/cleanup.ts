import { checkCommandExists } from "./runtime.js";
import type { Step, StepRunContext } from "./types.js";

const cleanupStep: Step = {
  id: "cleanup",
  name: "Cleanup",
  stage: "tools",
  description: "Remove outdated Homebrew downloads and cached versions",

  async checkIsAvailable(): Promise<boolean> {
    return checkCommandExists("brew");
  },

  async run(context: StepRunContext): Promise<void> {
    await context.runStep("brew cleanup");
  },
};

export default cleanupStep;
