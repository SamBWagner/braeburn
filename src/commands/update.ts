import readline from "node:readline";
import { collectVersions } from "../update/versionCollector.js";
import { captureYesNo } from "../ui/prompt.js";
import { buildScreen, buildScreenWithAnimationFrame, createScreenRenderer } from "../ui/screen.js";
import { hideCursorDuringExecution } from "../ui/terminal.js";
import { runUpdateEngine, type PromptMode } from "../update/engine.js";
import type { LogoVisibility, UpdateState } from "../update/state.js";
import type { Step } from "../steps/index.js";
import { cancelActiveShellCommand } from "../runner.js";

type RunUpdateCommandOptions = {
  steps: Step[];
  promptMode: PromptMode;
  logoVisibility: LogoVisibility;
  version: string;
};

type UpdateKeypressKey = {
  name?: string;
  // Exception to the no-boolean-parameters rule: Node's keypress event shape exposes modifier flags as booleans.
  ctrl?: boolean;
};

function shouldCaptureRuntimeAbortKey(state: UpdateState | undefined): boolean {
  return state?.currentPhase === "running" || state?.currentPhase === "installing";
}

export async function runUpdateCommand(options: RunUpdateCommandOptions): Promise<void> {
  const renderScreen = createScreenRenderer();
  const restoreCursor = hideCursorDuringExecution({ screenBuffer: "alternate" });
  let finalScreen = "";
  let latestState: UpdateState | undefined = undefined;
  let runtimeAbortKeyCaptureEnabled = false;
  let animationFrameIndex = 0;

  const handleRuntimeKeypress = (typedCharacter: string, key: UpdateKeypressKey): void => {
    if (key?.ctrl && key?.name === "c") {
      process.stdout.write("\x1b[?25h\n");
      process.exit(130);
    }

    const isQuitRequest = typedCharacter === "q" || typedCharacter === "Q";
    if (!isQuitRequest) {
      return;
    }

    cancelActiveShellCommand();
  };

  const enableRuntimeAbortKeyCapture = (): void => {
    if (runtimeAbortKeyCaptureEnabled) {
      return;
    }

    readline.emitKeypressEvents(process.stdin);
    process.stdin.on("keypress", handleRuntimeKeypress);

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    process.stdin.resume();
    runtimeAbortKeyCaptureEnabled = true;
  };

  const disableRuntimeAbortKeyCapture = (): void => {
    if (!runtimeAbortKeyCaptureEnabled) {
      return;
    }

    process.stdin.removeListener("keypress", handleRuntimeKeypress);

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    process.stdin.pause();
    runtimeAbortKeyCaptureEnabled = false;
  };

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
        if (shouldCaptureRuntimeAbortKey(state)) {
          enableRuntimeAbortKeyCapture();
        } else {
          disableRuntimeAbortKeyCapture();
        }
        renderScreen(buildScreenWithAnimationFrame(state, animationFrameIndex));
      },
    });
    finalScreen = buildScreen(finalState);
  } finally {
    disableRuntimeAbortKeyCapture();
    clearInterval(animationTimer);
    restoreCursor();
  }

  if (finalScreen) {
    process.stdout.write(finalScreen);
  }
}
