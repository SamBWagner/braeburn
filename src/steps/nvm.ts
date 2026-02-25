import { homedir } from "node:os";
import { join } from "node:path";
import { checkPathExists } from "./runtime.js";
import type { Step, StepRunContext } from "./types.js";

const NVM_DIRECTORY = join(homedir(), ".nvm");
const NVM_SCRIPT_PATH = join(NVM_DIRECTORY, "nvm.sh");

// nvm is a shell function sourced from nvm.sh — it cannot be invoked as a
// standalone binary, so we source it explicitly inside each bash invocation.
const NVM_SOURCE_PREFIX = `export NVM_DIR="${NVM_DIRECTORY}" && source "$NVM_DIR/nvm.sh" --no-use`;
const NVM_INSTALL_COMMAND =
  `${NVM_SOURCE_PREFIX} && ` +
  `CURRENT_NODE_VERSION="$(nvm current)" && ` +
  `if [ "$CURRENT_NODE_VERSION" = "none" ] || [ "$CURRENT_NODE_VERSION" = "system" ]; then ` +
  `nvm install node; ` +
  `else ` +
  `nvm install node --reinstall-packages-from="$CURRENT_NODE_VERSION"; ` +
  `fi`;

const nvmStep: Step = {
  id: "nvm",
  name: "Node.js (nvm)",
  stage: "runtime",
  description:
    "Install the latest Node.js via nvm, migrating packages from the current version",

  async checkIsAvailable(): Promise<boolean> {
    return checkPathExists(NVM_SCRIPT_PATH);
  },

  async run(context: StepRunContext): Promise<void> {
    await context.runStep(NVM_INSTALL_COMMAND);
  },
};

export default nvmStep;
