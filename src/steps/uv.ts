import { checkCommandExists } from "./runtime.js";
import type { Step, StepRunContext } from "./types.js";

const uvStep: Step = {
  id: "uv",
  name: "uv tools",
  categoryId: "cli-tools",
  description: "Upgrade all tools installed with uv",

  async checkIsAvailable(): Promise<boolean> {
    return checkCommandExists("uv");
  },

  async run(context: StepRunContext): Promise<void> {
    await context.runStep("uv tool upgrade --all");
  },
};

export default uvStep;
