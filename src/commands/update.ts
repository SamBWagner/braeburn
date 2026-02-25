import { collectVersions } from "../update/versionCollector.js";
import { captureYesNo } from "../ui/prompt.js";
import { buildScreen, buildScreenWithAnimationFrame, createScreenRenderer } from "../ui/screen.js";
import { hideCursorDuringExecution } from "../ui/terminal.js";
import { runUpdateEngine, type PromptMode } from "../update/engine.js";
import type { LogoVisibility, UpdateState } from "../update/state.js";
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
  let latestState: UpdateState | undefined = undefined;
  let animationFrameIndex = 0;
  const animationTimer = setInterval(() => {
    if (!latestState) {
      return;
    }

    if (latestState.runCompletion === "finished") {
      return;
    }

    if (latestState.currentPhase !== "running" && latestState.currentPhase !== "installing") {
      return;
    }

    animationFrameIndex += 1;
    renderScreen(buildScreenWithAnimationFrame(latestState, animationFrameIndex));
  }, 100);

  try {
    const finalState = await runUpdateEngine({
      steps: options.steps,
      promptMode: options.promptMode,
      version: options.version,
      logoVisibility: options.logoVisibility,
      askForConfirmation: captureYesNo,
      collectVersions,
      onStateChanged: (state) => {
        latestState = state;
        renderScreen(buildScreenWithAnimationFrame(state, animationFrameIndex));
      },
    });
    finalScreen = buildScreen(finalState);
  } finally {
    clearInterval(animationTimer);
    restoreCursor();
  }

  if (finalScreen) {
    process.stdout.write(finalScreen);
  }
}
