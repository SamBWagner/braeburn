import { checkCommandExists } from "./runtime.js";
import type { Step, StepRunContext } from "./types.js";

const homebrewStep: Step = {
  id: "homebrew",
  name: "Homebrew",
  categoryId: "apps-packages",
  description: "Update Homebrew itself and upgrade all installed formulae",

  async checkIsAvailable(): Promise<boolean> {
    return checkCommandExists("brew");
  },

  async run(context: StepRunContext): Promise<void> {
    await context.runStep("brew update && brew upgrade");
  },
};

export default homebrewStep;
