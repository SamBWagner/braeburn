import { checkCommandExists, type Step, type StepRunContext } from "./index.js";

const npmStep: Step = {
  id: "npm",
  name: "npm",
  stage: "tools",
  description: "Update all globally installed npm packages",

  async checkIsAvailable(): Promise<boolean> {
    return checkCommandExists("npm");
  },

  async run(context: StepRunContext): Promise<void> {
    await context.runStep("npm update -g");
  },
};

export default npmStep;
