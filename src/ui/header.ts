import chalk from "chalk";
import { LOGO_ART } from "../logo.js";
import { buildCategorySectionsInOrder, getStepCategoryLabel } from "../steps/index.js";
import type { DisplayStep, StepPhase, CompletedStepRecord, LogoVisibility } from "./state.js";
import type { TerminalDimensions } from "./outputBox.js";
import { getActivityIndicatorFrame } from "./activityIndicator.js";

const LOGO_COLUMN_WIDTH = 32;
const LOGO_SEPARATOR = "    ";
const MIN_SIDE_BY_SIDE_COLS = LOGO_COLUMN_WIDTH + LOGO_SEPARATOR.length + 20; // 56

type LogoLayout = "side-by-side" | "stacked" | "none";

export function determineLogoLayout(
  logoLines: string[],
  dimensions?: TerminalDimensions,
): LogoLayout {
  const cols = dimensions?.columns ?? process.stdout.columns ?? 80;
  const rows = dimensions?.rows ?? process.stdout.rows ?? 24;

  if (cols >= MIN_SIDE_BY_SIDE_COLS) {
    return "side-by-side";
  }

  if (rows >= logoLines.length + 6) {
    return "stacked";
  }

  return "none";
}

export function stepTrackerIcon(phase: StepPhase, activityFrameIndex = 0): string {
  if (phase === "complete")                              return chalk.green("✓ ");
  if (phase === "failed")                               return chalk.red("✗ ");
  if (phase === "skipped" || phase === "not-available") return chalk.dim("– ");
  if (phase === "running" || phase === "installing")    return chalk.cyan(`${getActivityIndicatorFrame(activityFrameIndex)} `);
  if (
    phase === "prompting-to-run" ||
    phase === "prompting-to-install" ||
    phase === "checking-availability"
  )                                                     return chalk.cyan("→ ");

  return chalk.dim("· ");
}

export function isActivePhase(phase: StepPhase): boolean {
  return (
    phase === "running" ||
    phase === "installing" ||
    phase === "prompting-to-run" ||
    phase === "prompting-to-install" ||
    phase === "checking-availability"
  );
}

export function deriveAllStepPhases(
  steps: DisplayStep[],
  currentStepIndex: number,
  currentPhase: StepPhase,
  completedStepRecords: CompletedStepRecord[]
): StepPhase[] {
  return steps.map((_step, index) => {
    if (index < completedStepRecords.length) return completedStepRecords[index].phase;
    if (index === currentStepIndex) return currentPhase;
    return "pending";
  });
}

type BuildHeaderOptions = {
  steps: DisplayStep[];
  version: string;
  logoVisibility: LogoVisibility;
  currentStepIndex: number;
  currentPhase: StepPhase;
  completedStepRecords: CompletedStepRecord[];
  activityFrameIndex?: number;
  terminalDimensions?: TerminalDimensions;
};

export function buildHeaderLines(options: BuildHeaderOptions): string[] {
  const { steps, version, logoVisibility, currentStepIndex, currentPhase, completedStepRecords } = options;
  const activityFrameIndex = options.activityFrameIndex ?? 0;

  const phases = deriveAllStepPhases(steps, currentStepIndex, currentPhase, completedStepRecords);

  const stepLines: string[] = [];
  const indexedSteps = steps.map((step, stepIndex) => ({ step, stepIndex, categoryId: step.categoryId }));
  for (const section of buildCategorySectionsInOrder(indexedSteps)) {
    stepLines.push(chalk.dim(`System / ${getStepCategoryLabel(section.categoryId)}`));
    for (const indexedStep of section.items) {
      const icon = stepTrackerIcon(phases[indexedStep.stepIndex], activityFrameIndex);
      const name = isActivePhase(phases[indexedStep.stepIndex]) ? chalk.white(indexedStep.step.name) : chalk.dim(indexedStep.step.name);
      stepLines.push(`${icon}${name}`);
    }
  }

  const rightColumnLines: string[] = [
    `${chalk.bold.white("braeburn")} ${chalk.dim("v" + version)}`,
    chalk.dim("macOS system updater"),
    "",
    ...stepLines,
  ];

  if (logoVisibility === "hidden") {
    return rightColumnLines;
  }

  const logoLines = LOGO_ART.split("\n");
  const layout = determineLogoLayout(logoLines, options.terminalDimensions);

  if (layout === "none") {
    return rightColumnLines;
  }

  if (layout === "stacked") {
    return [
      ...logoLines.map((line) => chalk.yellow(line)),
      "",
      ...rightColumnLines,
    ];
  }

  const totalLines = Math.max(logoLines.length, rightColumnLines.length);
  const result: string[] = [];

  for (let lineIndex = 0; lineIndex < totalLines; lineIndex++) {
    // Padding must happen before chalk; ANSI escape codes break .padEnd() alignment.
    const rawLogoLine = (logoLines[lineIndex] ?? "").padEnd(LOGO_COLUMN_WIDTH);
    const logoColumn = chalk.yellow(rawLogoLine);
    const rightColumn = rightColumnLines[lineIndex] ?? "";
    result.push(`${logoColumn}${LOGO_SEPARATOR}${rightColumn}`);
  }

  return result;
}
