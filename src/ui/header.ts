import chalk from "chalk";
import { LOGO_ART } from "../logo.js";
import type { Step } from "../steps/index.js";
import type { StepPhase, CompletedStepRecord } from "./state.js";

const LOGO_COLUMN_WIDTH = 32;
const LOGO_SEPARATOR = "    ";
const MIN_SIDE_BY_SIDE_COLS = LOGO_COLUMN_WIDTH + LOGO_SEPARATOR.length + 20; // 56

type LogoLayout = "side-by-side" | "stacked" | "none";

function determineLogoLayout(logoLines: string[]): LogoLayout {
  const cols = process.stdout.columns ?? 80;
  const rows = process.stdout.rows ?? 24;

  if (cols >= MIN_SIDE_BY_SIDE_COLS) {
    return "side-by-side";
  }

  // Not wide enough for side-by-side — stack if there are enough rows.
  if (rows >= logoLines.length + 6) {
    return "stacked";
  }

  return "none";
}

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
  showLogo: boolean;
  currentStepIndex: number;
  currentPhase: StepPhase;
  completedStepRecords: CompletedStepRecord[];
};

export function buildHeaderLines(options: BuildHeaderOptions): string[] {
  const { steps, version, showLogo, currentStepIndex, currentPhase, completedStepRecords } = options;

  const phases = deriveAllStepPhases(steps, currentStepIndex, currentPhase, completedStepRecords);

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

  if (!showLogo) {
    return rightColumnLines;
  }

  const logoLines = LOGO_ART.split("\n");
  const layout = determineLogoLayout(logoLines);

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

  // side-by-side
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
