import { checkCommandExists, type Step, type StepRunContext } from "./index.js";

const homebrewStep: Step = {
  id: "homebrew",
  name: "Homebrew",
  description: "Update Homebrew itself and upgrade all installed formulae",

  async checkIsAvailable(): Promise<boolean> {
    return checkCommandExists("brew");
  },

  async run(context: StepRunContext): Promise<void> {
    await context.runStep("brew update && brew upgrade");
  },
};

export default homebrewStep;
