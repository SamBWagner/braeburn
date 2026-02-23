import { checkCommandExists, runStep, type Step, type StepRunContext } from "./index.js";

const homebrewStep: Step = {
  id: "homebrew",
  name: "Homebrew",
  description: "Update Homebrew itself and upgrade all installed formulae",

  async checkIsAvailable(): Promise<boolean> {
    return checkCommandExists("brew");
  },

  async run(context: StepRunContext): Promise<void> {
    await runStep("brew update && brew upgrade", context);
  },
};

export default homebrewStep;
