import readline from "node:readline";
import chalk from "chalk";
import type { CurrentPrompt } from "./state.js";

type KeypressKey = {
  name?: string;
  ctrl?: boolean;
};

export function captureYesNo(): Promise<boolean> {
  return new Promise((resolve) => {
    readline.emitKeypressEvents(process.stdin);

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    const handleKeypress = (character: string, key: KeypressKey) => {
      if (key?.ctrl && key?.name === "c") {
        process.stdout.write("\x1b[?25h\n");
        process.exit(130);
      }

      const isConfirm = character === "y" || character === "Y" || key?.name === "return";
      const isDecline = character === "n" || character === "N";

      if (!isConfirm && !isDecline) return;

      process.stdin.removeListener("keypress", handleKeypress);

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }

      process.stdin.pause();
      resolve(isConfirm);
    };

    process.stdin.on("keypress", handleKeypress);
    process.stdin.resume();
  });
}

export function buildPromptLines(prompt: CurrentPrompt): string[] {
  const lines: string[] = [];

  if (prompt.warning) {
    lines.push(`  ${chalk.yellow("⚠")}  ${chalk.yellow(prompt.warning)}`);
    lines.push("");
  }

  lines.push(`  ${chalk.cyan("?")}  ${prompt.question} ${chalk.dim("[Y/n]")}`);
  return lines;
}
