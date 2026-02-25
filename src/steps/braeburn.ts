import { checkCommandExists } from "./runtime.js";
import type { Step, StepRunContext } from "./types.js";

const braeburnStep: Step = {
  id: "braeburn",
  name: "braeburn",
  categoryId: "cli-tools",
  description: "Update the braeburn CLI to the latest npm release",

  async checkIsAvailable(): Promise<boolean> {
    return checkCommandExists("npm");
  },

  async run(context: StepRunContext): Promise<void> {
    await context.runStep("npm install -g braeburn@latest");
  },
};

export default braeburnStep;
