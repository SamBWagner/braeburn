import { checkCommandExists, type Step, type StepRunContext } from "./index.js";

const masStep: Step = {
  id: "mas",
  name: "Mac App Store",
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
