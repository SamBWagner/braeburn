import readline from "node:readline";
import chalk from "chalk";
import {
  writeConfig,
  PROTECTED_STEP_IDS,
  CONSERVATIVE_DEFAULT_ON_STEP_IDS,
  cleanConfigForWrite,
  type BraeburnConfig,
} from "../config.js";
import { LOGO_ART } from "../logo.js";
import { createScreenRenderer } from "../ui/screen.js";
import { hideCursorDuringExecution } from "../ui/terminal.js";
import {
  type Step,
  type StepCategoryId,
  getStepCategoryLabel,
} from "../steps/index.js";

export type SelectionState = "selected" | "deselected";
export type ProtectionStatus = "protected" | "configurable";
export type AvailabilityStatus = "available" | "unavailable";

export type SetupStepView = {
  id: string;
  name: string;
  description: string;
  categoryId: StepCategoryId;
  brewPackageToInstall?: string;
};

export type SelectableStep = {
  step: SetupStepView;
  selection: SelectionState;
  protection: ProtectionStatus;
  availability: AvailabilityStatus;
};

type KeypressKey = {
  name?: string;
  // Exception to the no-boolean-parameters rule: Node's keypress event shape exposes modifier flags as booleans.
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

  for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
    const item = items[itemIndex];
    const isCursor = itemIndex === cursorIndex;

    const previousItem = items[itemIndex - 1];
    if (!previousItem || previousItem.step.categoryId !== item.step.categoryId) {
      const categoryLabel = getStepCategoryLabel(item.step.categoryId);
      lines.push(`  ${chalk.dim(`── System / ${categoryLabel} ──────────────────────────────────────────`)}`);
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
  const restoreCursor = hideCursorDuringExecution({ screenBuffer: "alternate" });

  try {
    render(buildLoadingScreen());

    const availabilityResults = await Promise.all(
      allSteps.map((step) => step.checkIsAvailable())
    );

    const items: SelectableStep[] = allSteps.map((step, stepIndex) => ({
      step: {
        id: step.id,
        name: step.name,
        description: step.description,
        categoryId: step.categoryId,
        brewPackageToInstall: step.brewPackageToInstall,
      },
      selection:
        PROTECTED_STEP_IDS.has(step.id) || CONSERVATIVE_DEFAULT_ON_STEP_IDS.has(step.id)
          ? "selected"
          : "deselected",
      protection: PROTECTED_STEP_IDS.has(step.id) ? "protected" : "configurable",
      availability: availabilityResults[stepIndex] ? "available" : "unavailable",
    }));

    let cursorIndex = 0;

    render(buildSetupScreen(items, cursorIndex));

    await new Promise<void>((resolve) => {
      readline.emitKeypressEvents(process.stdin);
      if (process.stdin.isTTY) process.stdin.setRawMode(true);

      const handleKeypress = (_typedCharacter: string, key: KeypressKey) => {
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

    const draftConfig: BraeburnConfig = {
      defaultsProfile: "conservative-v2",
      steps: {},
    };
    for (const item of items) {
      if (item.protection === "protected") {
        continue;
      }
      draftConfig.steps[item.step.id] = item.selection === "selected";
    }
    await writeConfig(cleanConfigForWrite(draftConfig));

    const confirmationLines = [
      chalk.yellow(LOGO_ART),
      "",
      `  ${chalk.green("\u2713")}  Setup complete! Starting your first update\u2026`,
      "",
    ];
    render(confirmationLines.join("\n") + "\n");

    await new Promise((resolve) => setTimeout(resolve, 800));
  } finally {
    restoreCursor();
  }
}
