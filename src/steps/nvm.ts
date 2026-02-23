import { homedir } from "node:os";
import { join } from "node:path";
import { checkPathExists, runStep, type Step, type StepRunContext } from "./index.js";

const NVM_DIRECTORY = join(homedir(), ".nvm");

// nvm is a shell function sourced from nvm.sh — it cannot be invoked as a
// standalone binary, so we source it explicitly inside each bash invocation.
const NVM_SOURCE_PREFIX = `export NVM_DIR="${NVM_DIRECTORY}" && source "$NVM_DIR/nvm.sh"`;

const nvmStep: Step = {
  id: "nvm",
  name: "Node.js (nvm)",
  description:
    "Install the latest Node.js via nvm, migrating packages from the current version",
  // No brewPackageToInstall — nvm is installed via a curl script, not Homebrew

  async checkIsAvailable(): Promise<boolean> {
    return checkPathExists(NVM_DIRECTORY);
  },

  async run(context: StepRunContext): Promise<void> {
    await runStep(
      `${NVM_SOURCE_PREFIX} && nvm install node --reinstall-packages-from=node`,
      context
    );
  },
};

export default nvmStep;
