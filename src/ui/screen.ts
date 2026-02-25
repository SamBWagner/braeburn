import { buildHeaderLines } from "./header.js";
import { buildActiveStepLines } from "./currentStep.js";
import { buildOutputBoxLines, type TerminalDimensions } from "./outputBox.js";
import { buildPromptLines } from "./prompt.js";
import { buildVersionReportLines } from "./versionReport.js";
import type { AppState } from "./state.js";

export type ScreenRenderer = (content: string) => void;

export function createScreenRenderer(
  output: NodeJS.WritableStream = process.stdout,
): ScreenRenderer {
  let hasAnchor = false;

  return (content: string): void => {
    if (!hasAnchor) {
      output.write("\x1b7");
      hasAnchor = true;
    }
    output.write("\x1b8\x1b[J");
    output.write(content);
  };
}

export function buildScreen(state: AppState, terminalDimensions?: TerminalDimensions): string {
  const lines: string[] = [];

  lines.push(
    ...buildHeaderLines({
      steps: state.steps,
      version: state.version,
      logoVisibility: state.logoVisibility,
      currentStepIndex: state.currentStepIndex,
      currentPhase: state.currentPhase,
      completedStepRecords: state.completedStepRecords,
      terminalDimensions,
    })
  );
  lines.push("");

  if (state.runCompletion === "finished") {
    if (state.versionReport) {
      lines.push("");
      lines.push(...buildVersionReportLines(state.versionReport));
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
        })
      );

      const isShowingOutput =
        (state.currentPhase === "running" || state.currentPhase === "installing") &&
        state.currentOutputLines.length > 0;

      if (isShowingOutput) {
        lines.push("");
        lines.push(...buildOutputBoxLines(state.currentOutputLines, currentStep.name, terminalDimensions));
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
