import { buildHeaderLines } from "./header.js";
import { buildActiveStepLines } from "./currentStep.js";
import { buildStepOutputLines, type TerminalDimensions } from "./outputLines.js";
import { buildPromptLines } from "./prompt.js";
import { buildFailedStepLogHintLines, buildVersionReportLines } from "./versionReport.js";
import { countFailedSteps, type AppState, type DisplayStep } from "./state.js";
import type { CommandOutputLine } from "../runner.js";

export type ScreenRenderer = (content: string) => void;

export function createScreenRenderer(
  output: NodeJS.WritableStream = process.stdout,
): ScreenRenderer {
  return (content: string): void => {
    output.write("\x1b[H\x1b[2J");
    output.write(content);
  };
}

export function buildScreen(state: AppState, terminalDimensions?: TerminalDimensions): string {
  return buildScreenWithAnimationFrame(state, 0, terminalDimensions);
}

type FailedStepDisplay = {
  step: DisplayStep;
  stepNumber: number;
  failureOutputLines: CommandOutputLine[];
};

function buildFailedStepLogHints(state: AppState): { stepId: string; logStepId: string }[] {
  return state.completedStepRecords.flatMap((completedStepRecord, stepIndex) => {
    if (completedStepRecord.phase !== "failed") {
      return [];
    }

    const failedStep = state.steps[stepIndex];
    if (!failedStep) {
      return [];
    }

    return [{
      stepId: failedStep.id,
      logStepId: completedStepRecord.logStepId ?? failedStep.id,
    }];
  });
}

function findLatestFailedStepDisplay(state: AppState): FailedStepDisplay | undefined {
  for (let stepIndex = state.completedStepRecords.length - 1; stepIndex >= 0; stepIndex -= 1) {
    const completedStepRecord = state.completedStepRecords[stepIndex];
    if (completedStepRecord?.phase !== "failed") {
      continue;
    }

    const failedStep = state.steps[stepIndex];
    if (!failedStep) {
      continue;
    }

    const failureOutputLines = completedStepRecord.failureOutputLines;
    if (!failureOutputLines || failureOutputLines.length === 0) {
      continue;
    }

    return {
      step: failedStep,
      stepNumber: stepIndex + 1,
      failureOutputLines,
    };
  }

  return undefined;
}

export function buildScreenWithAnimationFrame(
  state: AppState,
  activityFrameIndex: number,
  terminalDimensions?: TerminalDimensions,
): string {
  const lines: string[] = [];
  const failedStepCount = countFailedSteps(state.completedStepRecords);
  const failedStepLogHints = buildFailedStepLogHints(state);
  const latestFailedStepDisplay = findLatestFailedStepDisplay(state);

  lines.push(
    ...buildHeaderLines({
      steps: state.steps,
      version: state.version,
      logoVisibility: state.logoVisibility,
      currentStepIndex: state.currentStepIndex,
      currentPhase: state.currentPhase,
      completedStepRecords: state.completedStepRecords,
      activityFrameIndex,
      terminalDimensions,
    })
  );
  lines.push("");

  if (state.runCompletion === "finished") {
    if (state.versionReport) {
      lines.push("");
      lines.push(...buildVersionReportLines({
        versions: state.versionReport,
        failedStepCount,
      }));
    }

    if (failedStepLogHints.length > 0) {
      lines.push("");
      lines.push(...buildFailedStepLogHintLines(failedStepLogHints));
    }

    if (latestFailedStepDisplay) {
      lines.push("");
      lines.push(
        ...buildActiveStepLines({
          step: latestFailedStepDisplay.step,
          stepNumber: latestFailedStepDisplay.stepNumber,
          totalSteps: state.steps.length,
          phase: "failed",
          activityFrameIndex,
        })
      );
      lines.push("");
      lines.push(...buildStepOutputLines(latestFailedStepDisplay.failureOutputLines, terminalDimensions));
    }
  } else {
    const currentStep = state.steps[state.currentStepIndex];

    if (currentStep) {
      lines.push("");
      lines.push(
        ...buildActiveStepLines({
          step: currentStep,
          stepNumber: state.currentStepIndex + 1,
          totalSteps: state.steps.length,
          phase: state.currentPhase,
          activityFrameIndex,
        })
      );

      const isShowingOutput =
        (
          state.currentPhase === "running" ||
          state.currentPhase === "installing" ||
          state.currentPhase === "failed"
        ) &&
        state.currentOutputLines.length > 0;

      if (isShowingOutput) {
        lines.push("");
        lines.push(...buildStepOutputLines(state.currentOutputLines, terminalDimensions));
      }

      if (state.currentPrompt) {
        lines.push("");
        lines.push(...buildPromptLines(state.currentPrompt));
      }
    }
  }

  lines.push("");
  return lines.join("\n") + "\n";
}
