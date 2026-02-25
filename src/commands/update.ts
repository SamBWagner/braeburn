import { collectVersions } from "../update/versionCollector.js";
import { captureYesNo } from "../ui/prompt.js";
import { buildScreen, createScreenRenderer } from "../ui/screen.js";
import { hideCursorDuringExecution } from "../ui/terminal.js";
import { runUpdateEngine, type PromptMode } from "../update/engine.js";
import type { LogoVisibility } from "../update/state.js";
import type { Step } from "../steps/index.js";

type RunUpdateCommandOptions = {
  steps: Step[];
  promptMode: PromptMode;
  logoVisibility: LogoVisibility;
  version: string;
};

export async function runUpdateCommand(options: RunUpdateCommandOptions): Promise<void> {
  const renderScreen = createScreenRenderer();
  const restoreCursor = hideCursorDuringExecution({ screenBuffer: "alternate" });
  let finalScreen = "";

  try {
    const finalState = await runUpdateEngine({
      steps: options.steps,
      promptMode: options.promptMode,
      version: options.version,
      logoVisibility: options.logoVisibility,
      askForConfirmation: captureYesNo,
      collectVersions,
      onStateChanged: (state) => {
        renderScreen(buildScreen(state));
      },
    });
    finalScreen = buildScreen(finalState);
  } finally {
    restoreCursor();
  }

  if (finalScreen) {
    process.stdout.write(finalScreen);
  }
}
