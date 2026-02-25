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
