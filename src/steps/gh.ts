import { checkCommandExists } from "./runtime.js";
import type { Step, StepRunContext } from "./types.js";

const ghStep: Step = {
  id: "gh",
  name: "GitHub CLI extensions",
  categoryId: "cli-tools",
  description: "Upgrade all installed GitHub CLI extensions",

  async checkIsAvailable(): Promise<boolean> {
    return checkCommandExists("gh");
  },

  async run(context: StepRunContext): Promise<void> {
    await context.runStep("gh extension upgrade --all");
  },
};

export default ghStep;
