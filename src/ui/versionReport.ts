import chalk from "chalk";
import type { ResolvedVersion } from "./state.js";

export type VersionReportOptions = {
  versions: ResolvedVersion[];
  failedStepCount: number;
};

export type FailedStepLogHint = {
  stepId: string;
  logStepId: string;
};

function buildCompletionSummaryLine(failedStepCount: number): string {
  if (failedStepCount === 0) {
    return `  ${chalk.green.bold("✓")} ${chalk.bold("All done!")}`;
  }

  const failureLabel = failedStepCount === 1 ? "1 step failed" : `${failedStepCount} steps failed`;
  return `  ${chalk.red.bold("✗")} ${chalk.bold(`Done (${failureLabel})`)}`;
}

export function buildVersionReportLines(options: VersionReportOptions): string[] {
  return [
    chalk.dim("  ─── Versions ─────────────────────────"),
    ...options.versions.map(({ label, value }) =>
      `  ${chalk.dim("·")} ${chalk.bold(label + ":")} ${chalk.dim(value)}`
    ),
    "",
    buildCompletionSummaryLine(options.failedStepCount),
  ];
}

export function buildFailedStepLogHintLines(failedStepLogHints: FailedStepLogHint[]): string[] {
  return failedStepLogHints.map(({ stepId, logStepId }) =>
    `  ${chalk.red.bold("✗")} ${chalk.bold(`Step ${stepId} failed.`)} ${chalk.dim(`Please run braeburn log ${logStepId} to see what happened.`)}`
  );
}
