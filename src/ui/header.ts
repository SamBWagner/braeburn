import chalk from "chalk";
import { LOGO_ART } from "../logo.js";
import type { Step } from "../steps/index.js";
import type { StepPhase, CompletedStepRecord, LogoVisibility } from "./state.js";

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
  return steps.map((_step, index) => {
    if (index < completedStepRecords.length) return completedStepRecords[index].phase;
    if (index === currentStepIndex) return currentPhase;
    return "pending";
  });
}

type BuildHeaderOptions = {
  steps: Step[];
  version: string;
  logoVisibility: LogoVisibility;
  currentStepIndex: number;
  currentPhase: StepPhase;
  completedStepRecords: CompletedStepRecord[];
};

export function buildHeaderLines(options: BuildHeaderOptions): string[] {
  const { steps, version, logoVisibility, currentStepIndex, currentPhase, completedStepRecords } = options;

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

  if (logoVisibility === "hidden") {
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
