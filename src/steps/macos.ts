import {
  runStep,
  type Step,
  type StepRunContext,
} from "./index.js";
import { captureShellCommandOutput } from "../runner.js";

const macosStep: Step = {
  id: "macos",
  name: "macOS",
  description: "Check for and optionally install macOS system software updates",

  async checkIsAvailable(): Promise<boolean> {
    return true;
  },

  async run(context: StepRunContext): Promise<void> {
    const updateListOutput = await captureShellCommandOutput({
      shellCommand: "softwareupdate -l 2>&1",
    });

    context.logWriter(updateListOutput);

    const noUpdatesAvailable = updateListOutput.includes(
      "No new software available"
    );

    if (noUpdatesAvailable) {
      context.onOutputLine({
        text: "macOS is already up to date.",
        source: "stdout",
      });
      return;
    }

    context.onOutputLine({ text: updateListOutput, source: "stdout" });
    context.onOutputLine({
      text: "Updates found — installing now...",
      source: "stdout",
    });

    await runStep("softwareupdate -ia --verbose", context);
  },
};

export default macosStep;
