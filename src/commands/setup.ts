import readline from "node:readline";
import chalk from "chalk";
import { writeConfig, PROTECTED_STEP_IDS } from "../config.js";
import { LOGO_ART } from "../logo.js";
import { createScreenRenderer } from "../ui/screen.js";
import { hideCursorDuringExecution } from "../ui/terminal.js";
import type { Step } from "../steps/index.js";

export type SelectionState = "selected" | "deselected";
export type ProtectionStatus = "protected" | "configurable";
export type AvailabilityStatus = "available" | "unavailable";

export type SelectableStep = {
  step: Step;
  selection: SelectionState;
  protection: ProtectionStatus;
  availability: AvailabilityStatus;
};

type KeypressKey = {
  name?: string;
  ctrl?: boolean;
};

export function buildLoadingScreen(): string {
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

export function buildSetupScreen(items: SelectableStep[], cursorIndex: number): string {
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

  const hasRuntimeItems = items.some((item) => item.step.stage === "runtime");
  const hasToolsItems = items.some((item) => item.step.stage === "tools");
  const showStageLabels = hasRuntimeItems && hasToolsItems;

  for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
    const item = items[itemIndex];
    const isCursor = itemIndex === cursorIndex;

    if (showStageLabels) {
      const isFirstRuntime = item.step.stage === "runtime" && (itemIndex === 0 || items[itemIndex - 1].step.stage !== "runtime");
      const isFirstTools = item.step.stage === "tools" && (itemIndex === 0 || items[itemIndex - 1].step.stage !== "tools");

      if (isFirstRuntime) {
        lines.push(`  ${chalk.dim("── Runtimes ─────────────────────────────────────────────────────────")}`);
      } else if (isFirstTools) {
        lines.push(`  ${chalk.dim("── Tools ────────────────────────────────────────────────────────────")}`);
      }
    }

    const cursor = isCursor ? chalk.cyan("\u203a") : " ";
    const checkbox = item.selection === "selected" ? chalk.green("\u25cf") : chalk.dim("\u25cb");

    const namePadded = item.step.name.padEnd(18);
    const name = isCursor ? chalk.bold.white(namePadded) : chalk.white(namePadded);

    let status: string;
    if (item.protection === "protected") {
      status = chalk.dim("required");
    } else if (item.availability === "available") {
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

  const enabledCount = items.filter((item) => item.selection === "selected").length;
  lines.push("");
  lines.push(`  ${chalk.dim(`${enabledCount} of ${items.length} tools selected`)}`);
  lines.push("");

  return lines.join("\n") + "\n";
}

export async function runSetupCommand(allSteps: Step[]): Promise<void> {
  const render = createScreenRenderer();

  hideCursorDuringExecution();

  render(buildLoadingScreen());

  const availabilityResults = await Promise.all(
    allSteps.map((step) => step.checkIsAvailable())
  );

  const items: SelectableStep[] = allSteps.map((step, stepIndex) => ({
    step,
    selection: PROTECTED_STEP_IDS.has(step.id) || step.stage === "tools" ? "selected" : "deselected",
    protection: PROTECTED_STEP_IDS.has(step.id) ? "protected" : "configurable",
    availability: availabilityResults[stepIndex] ? "available" : "unavailable",
  }));

  let cursorIndex = 0;

  render(buildSetupScreen(items, cursorIndex));

  await new Promise<void>((resolve) => {
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);

    const handleKeypress = (_char: string, key: KeypressKey) => {
      if (key?.ctrl && key?.name === "c") {
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
        if (item.protection === "configurable") {
          item.selection = item.selection === "selected" ? "deselected" : "selected";
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

  const stepsConfig: Record<string, boolean> = {};
  for (const item of items) {
    if (item.protection === "configurable" && item.selection === "deselected") {
      stepsConfig[item.step.id] = false;
    }
  }
  await writeConfig({ steps: stepsConfig });

  const confirmationLines = [
    chalk.yellow(LOGO_ART),
    "",
    `  ${chalk.green("\u2713")}  Setup complete! Starting your first update\u2026`,
    "",
  ];
  render(confirmationLines.join("\n") + "\n");

  await new Promise((resolve) => setTimeout(resolve, 800));
}
