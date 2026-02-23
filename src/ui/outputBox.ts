import chalk from "chalk";
import type { CommandOutputLine } from "../runner.js";

export type TerminalDimensions = { columns: number; rows: number };

const INDENT = "  ";
const HEADER_LINES_APPROXIMATE = 18;
const OUTPUT_BOX_CHROME_LINES = 3;
const MINIMUM_VISIBLE_LINES = 5;

function maxVisibleLines(rows: number): number {
  const available = rows - HEADER_LINES_APPROXIMATE - OUTPUT_BOX_CHROME_LINES;
  return Math.max(MINIMUM_VISIBLE_LINES, available);
}

function boxWidth(columns: number): number {
  return Math.min(columns, 120) - INDENT.length * 2;
}

function resolveTerminalDimensions(dimensions?: TerminalDimensions): TerminalDimensions {
  return dimensions ?? {
    columns: process.stdout.columns ?? 80,
    rows: process.stdout.rows ?? 40,
  };
}

export function buildOutputBoxLines(
  lines: CommandOutputLine[],
  stepName: string,
  dimensions?: TerminalDimensions,
): string[] {
  const resolved = resolveTerminalDimensions(dimensions);
  const visibleLines = lines.slice(-maxVisibleLines(resolved.rows));
  const width = boxWidth(resolved.columns);

  const headerLabel = `─ ${stepName} output `;
  const topDashes = "─".repeat(Math.max(0, width - headerLabel.length - 2));
  const topBorder = chalk.dim(`${INDENT}┌${headerLabel}${topDashes}┐`);
  const bottomBorder = chalk.dim(`${INDENT}└${"─".repeat(width - 2)}┘`);

  const result: string[] = [topBorder];

  for (const line of visibleLines) {
    const truncated = line.text.slice(0, width - 4);
    const colored = line.source === "stderr" ? chalk.yellow(truncated) : chalk.dim(truncated);
    result.push(`${INDENT}${chalk.dim("│")} ${colored}`);
  }

  result.push(bottomBorder);
  return result;
}
