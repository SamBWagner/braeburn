import { checkCommandExists, runStep, type Step, type StepRunContext } from "./index.js";

const cleanupStep: Step = {
  id: "cleanup",
  name: "Cleanup",
  description: "Remove outdated Homebrew downloads and cached versions",

  async checkIsAvailable(): Promise<boolean> {
    return checkCommandExists("brew");
  },

  async run(context: StepRunContext): Promise<void> {
    await runStep("brew cleanup", context);
  },
};

export default cleanupStep;
