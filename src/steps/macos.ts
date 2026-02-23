import {
  runStep,
  type Step,
  type StepRunContext,
} from "./index.js";
import { captureShellCommandOutput } from "../runner.js";

// softwareupdate always exists on macOS — no availability check needed
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
        isError: false,
      });
      return;
    }

    context.onOutputLine({ text: updateListOutput, isError: false });
    context.onOutputLine({
      text: "Updates found — installing now...",
      isError: false,
    });

    await runStep("softwareupdate -ia --verbose", context);
  },
};

export default macosStep;
