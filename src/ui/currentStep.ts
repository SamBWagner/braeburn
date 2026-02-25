import chalk from "chalk";
import type { DisplayStep, StepPhase } from "./state.js";
import { getActivityIndicatorFrame } from "./activityIndicator.js";

type ActiveStepOptions = {
  step: DisplayStep;
  stepNumber: number;
  totalSteps: number;
  phase: StepPhase;
  activityFrameIndex?: number;
};

export function buildActiveStepLines(options: ActiveStepOptions): string[] {
  const { step, stepNumber, totalSteps, phase } = options;
  const activityFrameIndex = options.activityFrameIndex ?? 0;
  const isRunning = phase === "running" || phase === "installing";

  const lines: string[] = [
    chalk.dim(`  ${"─".repeat(3)} Step ${stepNumber}/${totalSteps}  `) +
      chalk.bold.white(step.name) +
      chalk.dim(`  ${"─".repeat(20)}`),
    `  ${chalk.dim("·")} ${chalk.dim.italic(step.description)}`,
  ];

  if (isRunning) {
    const label = phase === "installing" ? "Installing..." : "Running...";
    lines.push(`  ${chalk.blue(getActivityIndicatorFrame(activityFrameIndex))} ${label}`);
  }

  return lines;
}
