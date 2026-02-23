import readline from "node:readline";
import chalk from "chalk";
import { writeConfig, PROTECTED_STEP_IDS } from "../config.js";
import { LOGO_ART } from "../logo.js";
import type { Step } from "../steps/index.js";

type SelectableStep = {
  step: Step;
  selected: boolean;
  isProtected: boolean;
  isAvailable: boolean;
};

type KeypressKey = {
  name?: string;
  ctrl?: boolean;
};

// Module-level render state (scoped to this screen, separate from update screen)
let prevLines = 0;

function render(content: string): void {
  if (prevLines > 0) {
    process.stdout.write(`\x1b[${prevLines}A\x1b[J`);
  }
  process.stdout.write(content);
  prevLines = (content.match(/\n/g) ?? []).length;
}

function buildLoadingScreen(): string {
  const lines: string[] = [
    chalk.yellow(LOGO_ART),
    "",
    `  ${chalk.bold.white("Welcome to braeburn!")}`,
    "",
    `  ${chalk.dim("Checking which tools are installed\u2026")}`,
    "",
  ];
  return lines.join("\n") + "\n";
}

function buildSetupScreen(items: SelectableStep[], cursorIndex: number): string {
  const lines: string[] = [
    chalk.yellow(LOGO_ART),
    "",
    `  ${chalk.bold.white("Welcome to braeburn!")}`,
    "",
    `  Select the update tools you\u2019d like to enable. For anything that isn\u2019t`,
    `  installed yet, braeburn will offer to set it up via Homebrew when you run it.`,
    "",
    `  ${chalk.dim("\u2191\u2193  navigate    Space  toggle    Return  confirm")}`,
    "",
  ];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isCursor = i === cursorIndex;

    const cursor = isCursor ? chalk.cyan("\u203a") : " ";
    const checkbox = item.selected ? chalk.green("\u25cf") : chalk.dim("\u25cb");

    const namePadded = item.step.name.padEnd(18);
    const name = isCursor ? chalk.bold.white(namePadded) : chalk.white(namePadded);

    let status: string;
    if (item.isProtected) {
      status = chalk.dim("required");
    } else if (item.isAvailable) {
      status = chalk.green("installed");
    } else if (item.step.brewPackageToInstall) {
      status = chalk.yellow(`not installed`) + chalk.dim(`  \u2192 will offer to install via Homebrew`);
    } else {
      status = chalk.dim("not installed");
    }

    lines.push(`  ${cursor} ${checkbox}  ${name}  ${status}`);

    if (isCursor) {
      lines.push(`           ${chalk.dim(item.step.description)}`);
    }
  }

  const enabledCount = items.filter((i) => i.selected).length;
  lines.push("");
  lines.push(`  ${chalk.dim(`${enabledCount} of ${items.length} tools selected`)}`);
  lines.push("");

  return lines.join("\n") + "\n";
}

export async function runSetupCommand(allSteps: Step[]): Promise<void> {
  // Hide cursor; restore on exit
  process.stdout.write("\x1b[?25l");
  process.on("exit", () => process.stdout.write("\x1b[?25h"));
  process.on("SIGINT", () => {
    process.stdout.write("\x1b[?25h\n");
    process.exit(130);
  });

  // Show loading screen while we check availability in parallel
  render(buildLoadingScreen());

  const availabilityResults = await Promise.all(
    allSteps.map((step) => step.checkIsAvailable())
  );

  const items: SelectableStep[] = allSteps.map((step, i) => ({
    step,
    selected: true, // all enabled by default — user opts out
    isProtected: PROTECTED_STEP_IDS.has(step.id),
    isAvailable: availabilityResults[i],
  }));

  let cursorIndex = 0;

  render(buildSetupScreen(items, cursorIndex));

  // Interactive selection loop
  await new Promise<void>((resolve) => {
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);

    const handleKeypress = (_char: string, key: KeypressKey) => {
      if (key?.ctrl && key?.name === "c") {
        process.stdout.write("\x1b[?25h\n");
        process.exit(130);
      }

      if (key?.name === "up" || key?.name === "k") {
        cursorIndex = Math.max(0, cursorIndex - 1);
        render(buildSetupScreen(items, cursorIndex));
      } else if (key?.name === "down" || key?.name === "j") {
        cursorIndex = Math.min(items.length - 1, cursorIndex + 1);
        render(buildSetupScreen(items, cursorIndex));
      } else if (key?.name === "space") {
        const item = items[cursorIndex];
        if (!item.isProtected) {
          item.selected = !item.selected;
          render(buildSetupScreen(items, cursorIndex));
        }
      } else if (key?.name === "return") {
        process.stdin.removeListener("keypress", handleKeypress);
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        process.stdin.pause();
        resolve();
      }
    };

    process.stdin.on("keypress", handleKeypress);
    process.stdin.resume();
  });

  // Restore cursor
  process.stdout.write("\x1b[?25h");

  // Persist choices — only write explicit false entries (keeps file minimal, matches
  // the opt-out convention used everywhere else in the codebase)
  const stepsConfig: Record<string, boolean> = {};
  for (const item of items) {
    if (!item.isProtected && !item.selected) {
      stepsConfig[item.step.id] = false;
    }
  }
  await writeConfig({ steps: stepsConfig });

  // Clear the setup screen and print a brief confirmation before the update starts
  if (prevLines > 0) {
    process.stdout.write(`\x1b[${prevLines}A\x1b[J`);
  }
  process.stdout.write(chalk.yellow(LOGO_ART) + "\n");
  process.stdout.write("\n");
  process.stdout.write(
    `  ${chalk.green("\u2713")}  Setup complete! Starting your first update\u2026\n`
  );
  process.stdout.write("\n");

  // Small pause so the confirmation is readable before the update screen takes over
  await new Promise((res) => setTimeout(res, 800));
}
