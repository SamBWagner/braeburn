import { checkCommandExists, runStep, type Step, type StepRunContext } from "./index.js";

const PIP_UPDATE_ALL_OUTDATED_SHELL_COMMAND =
  "pip3 list --outdated --format=columns | tail -n +3 | awk '{print $1}' | xargs -n1 pip3 install -U";

const pipStep: Step = {
  id: "pip",
  name: "pip3",
  description: "Update all globally installed pip3 packages",
  warning: "This updates all global pip3 packages, which can occasionally break tools.",

  async checkIsAvailable(): Promise<boolean> {
    return checkCommandExists("pip3");
  },

  async run(context: StepRunContext): Promise<void> {
    await runStep(PIP_UPDATE_ALL_OUTDATED_SHELL_COMMAND, context);
  },
};

export default pipStep;
