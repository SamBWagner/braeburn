import {
  checkCommandExists,
} from "./runtime.js";
import type { Step, StepRunContext } from "./types.js";

const FIND_LATEST_STABLE_PYTHON_SHELL_COMMAND =
  "pyenv install -l | grep -E '^\\s+3\\.[0-9]+\\.[0-9]+$' | grep -vE 'dev|a[0-9]|b[0-9]|rc[0-9]' | tail -1 | tr -d ' '";

const pyenvStep: Step = {
  id: "pyenv",
  name: "pyenv",
  categoryId: "runtimes",
  description: "Upgrade pyenv via Homebrew and install the latest Python 3.x",
  brewPackageToInstall: "pyenv",

  async checkIsAvailable(): Promise<boolean> {
    return checkCommandExists("pyenv");
  },

  async run(context: StepRunContext): Promise<void> {
    await context.runStep("brew upgrade pyenv");

    const latestPythonVersion = await context.captureOutput({
      shellCommand: FIND_LATEST_STABLE_PYTHON_SHELL_COMMAND,
    });

    if (!latestPythonVersion) {
      context.onOutputLine({
        text: "Could not determine latest Python version — skipping pyenv install.",
        source: "stderr",
      });
      return;
    }

    await context.runStep(
      `pyenv install --skip-existing ${latestPythonVersion}`,
    );
  },
};

export default pyenvStep;
