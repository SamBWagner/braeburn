import chalk from "chalk";
import { LOGO_ART } from "../logo.js";
import type { Step } from "../steps/index.js";
import type { StepPhase, CompletedStepRecord } from "./state.js";

const LOGO_COLUMN_WIDTH = 32;
const LOGO_SEPARATOR = "    ";

function stepTrackerIcon(phase: StepPhase): string {
  if (phase === "complete")                              return chalk.green("✓ ");
  if (phase === "failed")                               return chalk.red("✗ ");
  if (phase === "skipped" || phase === "not-available") return chalk.dim("– ");
  if (
    phase === "running" ||
    phase === "installing" ||
    phase === "prompting-to-run" ||
    phase === "prompting-to-install" ||
    phase === "checking-availability"
  )                                                     return chalk.cyan("→ ");

  return chalk.dim("· ");
}

function isActivePhase(phase: StepPhase): boolean {
  return (
    phase === "running" ||
    phase === "installing" ||
    phase === "prompting-to-run" ||
    phase === "prompting-to-install" ||
    phase === "checking-availability"
  );
}

function deriveAllStepPhases(
  steps: Step[],
  currentStepIndex: number,
  currentPhase: StepPhase,
  completedStepRecords: CompletedStepRecord[]
): StepPhase[] {
  return steps.map((_, index) => {
    if (index < completedStepRecords.length) return completedStepRecords[index].phase;
    if (index === currentStepIndex) return currentPhase;
    return "pending";
  });
}

type BuildHeaderOptions = {
  steps: Step[];
  version: string;
  currentStepIndex: number;
  currentPhase: StepPhase;
  completedStepRecords: CompletedStepRecord[];
};

export function buildHeaderLines(options: BuildHeaderOptions): string[] {
  const { steps, version, currentStepIndex, currentPhase, completedStepRecords } = options;

  const phases = deriveAllStepPhases(steps, currentStepIndex, currentPhase, completedStepRecords);

  const logoLines = LOGO_ART.split("\n");

  const rightColumnLines: string[] = [
    `${chalk.bold.white("braeburn")} ${chalk.dim("v" + version)}`,
    chalk.dim("macOS system updater"),
    "",
    ...steps.map((step, index) => {
      const icon = stepTrackerIcon(phases[index]);
      const name = isActivePhase(phases[index]) ? chalk.white(step.name) : chalk.dim(step.name);
      return `${icon}${name}`;
    }),
  ];

  const totalLines = Math.max(logoLines.length, rightColumnLines.length);
  const result: string[] = [];

  for (let i = 0; i < totalLines; i++) {
    // Pad the raw logo line to a fixed width before applying colour, so the
    // ANSI escape codes don't affect visual alignment.
    const rawLogoLine = (logoLines[i] ?? "").padEnd(LOGO_COLUMN_WIDTH);
    const logoColumn = chalk.yellow(rawLogoLine);
    const rightColumn = rightColumnLines[i] ?? "";
    result.push(`${logoColumn}${LOGO_SEPARATOR}${rightColumn}`);
  }

  return result;
}
