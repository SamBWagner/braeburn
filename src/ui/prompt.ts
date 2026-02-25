import readline from "node:readline";
import chalk from "chalk";
import type { CurrentPrompt } from "./state.js";

type KeypressKey = {
  name?: string;
  // Exception to the no-boolean-parameters rule: Node's keypress event shape exposes modifier flags as booleans.
  ctrl?: boolean;
};

export type YesNoForceAnswer = "yes" | "no" | "force";

export function captureYesNo(): Promise<YesNoForceAnswer> {
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
      const isForce = character === "f" || character === "F";

      if (!isConfirm && !isDecline && !isForce) return;

      process.stdin.removeListener("keypress", handleKeypress);

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }

      process.stdin.pause();

      if (isForce) resolve("force");
      else if (isConfirm) resolve("yes");
      else resolve("no");
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

  lines.push(`  ${chalk.cyan("?")}  ${prompt.question} ${chalk.dim("[Y/n/f]")}`);
  return lines;
}
