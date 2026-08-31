import { checkCommandExists } from "./runtime.js";
import type { Step, StepRunContext } from "./types.js";

const ASPIRE_SELF_UPDATE_STABLE_CHANNEL_COMMAND = "aspire update --self --channel stable";

const aspireStep: Step = {
  id: "aspire",
  name: "Aspire",
  categoryId: "aspire",
  description: "Update the Aspire CLI on the stable channel",

  async checkIsAvailable(): Promise<boolean> {
    return checkCommandExists("aspire");
  },

  async run(context: StepRunContext): Promise<void> {
    await context.runStep(ASPIRE_SELF_UPDATE_STABLE_CHANNEL_COMMAND);
  },
};

export default aspireStep;
