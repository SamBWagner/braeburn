import { checkCommandExists } from "./runtime.js";
import type { Step, StepRunContext } from "./types.js";

const masStep: Step = {
  id: "mas",
  name: "Mac App Store",
  stage: "tools",
  description: "Upgrade all Mac App Store apps via the mas CLI tool",
  brewPackageToInstall: "mas",

  async checkIsAvailable(): Promise<boolean> {
    return checkCommandExists("mas");
  },

  async run(context: StepRunContext): Promise<void> {
    await context.runStep("mas upgrade");
  },
};

export default masStep;
