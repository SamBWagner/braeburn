import chalk from "chalk";
import type { CommandOutputLine } from "../runner.js";

const INDENT = "  ";
const HEADER_LINES_APPROXIMATE = 18;
const OUTPUT_BOX_CHROME_LINES = 3;
const MINIMUM_VISIBLE_LINES = 5;

function maxVisibleLines(): number {
  const rows = process.stdout.rows ?? 40;
  const available = rows - HEADER_LINES_APPROXIMATE - OUTPUT_BOX_CHROME_LINES;
  return Math.max(MINIMUM_VISIBLE_LINES, available);
}

function boxWidth(): number {
  return Math.min(process.stdout.columns ?? 80, 120) - INDENT.length * 2;
}

export function buildOutputBoxLines(lines: CommandOutputLine[], stepName: string): string[] {
  const visibleLines = lines.slice(-maxVisibleLines());
  const width = boxWidth();

  const headerLabel = `─ ${stepName} output `;
  const topDashes = "─".repeat(Math.max(0, width - headerLabel.length - 2));
  const topBorder = chalk.dim(`${INDENT}┌${headerLabel}${topDashes}┐`);
  const bottomBorder = chalk.dim(`${INDENT}└${"─".repeat(width - 2)}┘`);

  const result: string[] = [topBorder];

  for (const line of visibleLines) {
    const truncated = line.text.slice(0, width - 4);
    const colored = line.isError ? chalk.yellow(truncated) : chalk.dim(truncated);
    result.push(`${INDENT}${chalk.dim("│")} ${colored}`);
  }

  result.push(bottomBorder);
  return result;
}
