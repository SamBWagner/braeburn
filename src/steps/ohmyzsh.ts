import { homedir } from "node:os";
import { join } from "node:path";
import { checkPathExists, type Step, type StepRunContext } from "./index.js";

const OH_MY_ZSH_UPGRADE_SCRIPT_PATH = join(
  homedir(),
  ".oh-my-zsh",
  "tools",
  "upgrade.sh"
);

const ohmyzshStep: Step = {
  id: "ohmyzsh",
  name: "Oh My Zsh",
  stage: "tools",
  description: "Update Oh My Zsh to the latest version",

  async checkIsAvailable(): Promise<boolean> {
    return checkPathExists(OH_MY_ZSH_UPGRADE_SCRIPT_PATH);
  },

  async run(context: StepRunContext): Promise<void> {
    await context.runStep(`zsh "${OH_MY_ZSH_UPGRADE_SCRIPT_PATH}"`);
  },
};

export default ohmyzshStep;
