import readline from "node:readline";
import { collectVersions } from "../update/versionCollector.js";
import { captureYesNo } from "../ui/prompt.js";
import { buildScreen, buildScreenWithAnimationFrame, createScreenRenderer } from "../ui/screen.js";
import { hideCursorDuringExecution } from "../ui/terminal.js";
import { runUpdateEngine, type PromptMode } from "../update/engine.js";
import { countFailedSteps, type LogoVisibility, type UpdateState } from "../update/state.js";
import type { Step } from "../steps/index.js";
import { cancelActiveShellCommand } from "../runner.js";

const RUNTIME_RENDER_INTERVAL_MS = 100;

type RunUpdateCommandOptions = {
  steps: Step[];
  promptMode: PromptMode;
  logoVisibility: LogoVisibility;
  version: string;
};

export type UpdateCommandResult = {
  failedStepCount: number;
};

type ExitCodeWritable = {
  exitCode: string | number | null | undefined;
};

type UpdateKeypressKey = {
  name?: string;
  // Exception to the no-boolean-parameters rule: Node's keypress event shape exposes modifier flags as booleans.
  ctrl?: boolean;
};

function shouldCaptureRuntimeAbortKey(state: UpdateState | undefined): boolean {
  return state?.currentPhase === "running" || state?.currentPhase === "installing";
}

function shouldThrottleRuntimeRender(state: UpdateState): boolean {
  return state.runCompletion !== "finished" && shouldCaptureRuntimeAbortKey(state);
}

export function shouldRenderRuntimeStateImmediately(
  state: UpdateState,
  lastRuntimeRenderTime: number,
  currentTime: number,
): boolean {
  if (!shouldThrottleRuntimeRender(state)) {
    return true;
  }

  return currentTime - lastRuntimeRenderTime >= RUNTIME_RENDER_INTERVAL_MS;
}

export function applyUpdateCommandResult(
  updateCommandResult: UpdateCommandResult,
  processWithExitCode: ExitCodeWritable,
): void {
  if (updateCommandResult.failedStepCount > 0) {
    processWithExitCode.exitCode = 1;
  }
}

export async function runUpdateCommand(options: RunUpdateCommandOptions): Promise<UpdateCommandResult> {
  const renderScreen = createScreenRenderer();
  const restoreCursor = hideCursorDuringExecution({ screenBuffer: "alternate" });
  let finalScreen = "";
  let latestState: UpdateState | undefined = undefined;
  let runtimeAbortKeyCaptureEnabled = false;
  let animationFrameIndex = 0;
  let updateCommandResult: UpdateCommandResult = { failedStepCount: 0 };
  let lastRuntimeRenderTime = 0;

  const renderState = (state: UpdateState): void => {
    renderScreen(buildScreenWithAnimationFrame(state, animationFrameIndex));
    if (shouldThrottleRuntimeRender(state)) {
      lastRuntimeRenderTime = Date.now();
    }
  };

  const renderStateWithRuntimeThrottle = (state: UpdateState): void => {
    if (!shouldThrottleRuntimeRender(state)) {
      renderState(state);
      return;
    }

    const currentTime = Date.now();
    if (shouldRenderRuntimeStateImmediately(state, lastRuntimeRenderTime, currentTime)) {
      renderState(state);
      return;
    }

    // The animation timer renders the latest runtime state at the next frame.
  };

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
    renderState(latestState);
  }, RUNTIME_RENDER_INTERVAL_MS);

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
        renderStateWithRuntimeThrottle(state);
      },
    });
    finalScreen = buildScreen(finalState);
    updateCommandResult = {
      failedStepCount: countFailedSteps(finalState.completedStepRecords),
    };
  } finally {
    disableRuntimeAbortKeyCapture();
    clearInterval(animationTimer);
    restoreCursor();
  }

  if (finalScreen) {
    process.stdout.write(finalScreen);
  }

  return updateCommandResult;
}
