import { checkCommandExists, runStep, type Step, type StepRunContext } from "./index.js";

const npmStep: Step = {
  id: "npm",
  name: "npm",
  description: "Update all globally installed npm packages",
  // No brewPackageToInstall — npm comes bundled with Node.js

  async checkIsAvailable(): Promise<boolean> {
    return checkCommandExists("npm");
  },

  async run(context: StepRunContext): Promise<void> {
    await runStep("npm update -g", context);
  },
};

export default npmStep;
