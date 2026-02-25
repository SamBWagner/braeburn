import { checkCommandExists } from "./runtime.js";
import type { Step, StepRunContext } from "./types.js";

const npmStep: Step = {
  id: "npm",
  name: "npm",
  categoryId: "cli-tools",
  description: "Update all globally installed npm packages",

  async checkIsAvailable(): Promise<boolean> {
    return checkCommandExists("npm");
  },

  async run(context: StepRunContext): Promise<void> {
    await context.runStep("npm update -g");
  },
};

export default npmStep;
