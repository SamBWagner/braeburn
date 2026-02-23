import chalk from "chalk";
import { captureShellCommandOutput } from "../runner.js";
import type { ResolvedVersion } from "./state.js";

type VersionEntry = { label: string; shellCommand: string };

const VERSION_ENTRIES: VersionEntry[] = [
  { label: "macOS",    shellCommand: "sw_vers -productVersion" },
  { label: "Homebrew", shellCommand: "brew --version | head -n1" },
  { label: "Node",     shellCommand: "node -v 2>/dev/null" },
  { label: "NPM",      shellCommand: "npm -v 2>/dev/null" },
  { label: "Python",   shellCommand: "python3 --version 2>/dev/null" },
  { label: "pip3",     shellCommand: "pip3 --version 2>/dev/null | cut -d' ' -f1-2" },
  { label: "Zsh",      shellCommand: "zsh --version 2>/dev/null" },
];

export async function collectVersions(): Promise<ResolvedVersion[]> {
  return Promise.all(
    VERSION_ENTRIES.map(async ({ label, shellCommand }) => {
      const value = await captureShellCommandOutput({ shellCommand }).catch(() => "");
      return { label, value: value || "not installed" };
    })
  );
}

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
