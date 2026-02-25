import chalk from "chalk";
import type { ResolvedVersion } from "./state.js";

export function buildVersionReportLines(versions: ResolvedVersion[]): string[] {
  return [
    chalk.dim("  ─── Versions ─────────────────────────"),
    ...versions.map(({ label, value }) =>
      `  ${chalk.dim("·")} ${chalk.bold(label + ":")} ${chalk.dim(value)}`
    ),
    "",
    `  ${chalk.green.bold("✓")} ${chalk.bold("All done!")}`,
  ];
}

export function buildFailedStepLogHintLines(failedStepIds: string[]): string[] {
  return failedStepIds.map((stepId) =>
    `  ${chalk.red.bold("✗")} ${chalk.bold(`Step ${stepId} failed.`)} ${chalk.dim(`Please run braeburn log --${stepId} to see what happened.`)}`
  );
}
