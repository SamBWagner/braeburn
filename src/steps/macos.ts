import {
  type Step,
  type StepRunContext,
} from "./types.js";

const macosStep: Step = {
  id: "macos",
  name: "macOS",
  stage: "tools",
  description: "Check for and optionally install macOS system software updates",

  async checkIsAvailable(): Promise<boolean> {
    return true;
  },

  async run(context: StepRunContext): Promise<void> {
    const updateListOutput = await context.captureOutput({
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

    await context.runStep("softwareupdate -ia --verbose");
  },
};

export default macosStep;
