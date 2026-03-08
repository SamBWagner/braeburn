import chalk from "chalk";
import type { CommandOutputLine } from "../runner.js";

export type TerminalDimensions = { columns: number; rows: number };

const INDENT = "  ";
const HEADER_LINES_APPROXIMATE = 18;
const MINIMUM_VISIBLE_LINES = 5;

function maxVisibleLines(rows: number): number {
  const available = rows - HEADER_LINES_APPROXIMATE;
  return Math.max(MINIMUM_VISIBLE_LINES, available);
}

function maxLineWidth(columns: number): number {
  return Math.max(0, Math.min(columns, 120) - INDENT.length);
}

function resolveTerminalDimensions(dimensions?: TerminalDimensions): TerminalDimensions {
  return dimensions ?? {
    columns: process.stdout.columns ?? 80,
    rows: process.stdout.rows ?? 40,
  };
}

function expandRenderedLines(lines: CommandOutputLine[]): CommandOutputLine[] {
  return lines.flatMap((line) =>
    line.text.split(/\r?\n|\r/).map((text) => ({
      text,
      source: line.source,
    }))
  );
}

export function buildStepOutputLines(
  lines: CommandOutputLine[],
  dimensions?: TerminalDimensions,
): string[] {
  const resolved = resolveTerminalDimensions(dimensions);
  const visibleLines = expandRenderedLines(lines).slice(-maxVisibleLines(resolved.rows));
  const width = maxLineWidth(resolved.columns);

  return visibleLines.map((line) => {
    const truncated = line.text.slice(0, width);
    const colored = line.source === "stderr" ? chalk.yellow(truncated) : chalk.dim(truncated);
    return `${INDENT}${colored}`;
  });
}
