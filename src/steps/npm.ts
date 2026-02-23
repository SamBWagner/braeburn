import { checkCommandExists, runStep, type Step, type StepRunContext } from "./index.js";

const npmStep: Step = {
  id: "npm",
  name: "npm",
  description: "Update all globally installed npm packages",

  async checkIsAvailable(): Promise<boolean> {
    return checkCommandExists("npm");
  },

  async run(context: StepRunContext): Promise<void> {
    await runStep("npm update -g", context);
  },
};

export default npmStep;
