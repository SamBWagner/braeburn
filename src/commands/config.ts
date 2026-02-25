import readline from "node:readline";
import chalk from "chalk";
import {
  readConfig,
  writeConfig,
  resolveConfigPath,
  isSettingEnabled,
  isStepEnabled,
  isLogoEnabled,
  applySettingToConfig,
  PROTECTED_STEP_IDS,
  DEFAULT_OFF_STEP_IDS,
  type BraeburnConfig,
} from "../config.js";
import type { Step } from "../steps/index.js";
import { createScreenRenderer } from "../ui/screen.js";
import { hideCursorDuringExecution } from "../ui/terminal.js";

type RunConfigCommandOptions = {
  allSteps: Step[];
  outputMode: "interactive" | "non-interactive";
};

type DesiredState = "enable" | "disable";

type SettingProtection = "configurable" | "protected";
type ConfigSelectionState = "enabled" | "disabled";

type ConfigKeypress = {
  name?: string;
  ctrl?: boolean;
};

type ConfigViewItem = {
  id: string;
  label: string;
  description: string;
  protection: SettingProtection;
  selection: ConfigSelectionState;
};

type RunConfigUpdateCommandOptions = {
  settingUpdates: Record<string, DesiredState>;
  allSteps: Step[];
};

export async function runConfigCommand(options: RunConfigCommandOptions): Promise<void> {
  const { allSteps, outputMode } = options;
  const config = await readConfig();
  const configPath = await resolveConfigPath();

  if (outputMode === "non-interactive") {
    process.stdout.write(buildConfigTableOutput({ config, configPath, allSteps }));
    return;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    process.stderr.write("Interactive mode requires a TTY. Showing non-interactive output.\n\n");
    process.stdout.write(buildConfigTableOutput({ config, configPath, allSteps }));
    return;
  }

  await runInteractiveConfigView({ config, configPath, allSteps });
}

type ConfigChange = { label: string; from: DesiredState; to: DesiredState };

type ConfigUpdateResult = {
  updatedConfig: BraeburnConfig;
  changes: ConfigChange[];
};

export function applyConfigUpdates(
  config: BraeburnConfig,
  settingUpdates: Record<string, DesiredState>,
): ConfigUpdateResult {
  let updatedConfig = config;
  const changes: ConfigChange[] = [];

  for (const [settingId, desiredState] of Object.entries(settingUpdates)) {
    const currentState: DesiredState = isSettingEnabled(config, settingId) ? "enable" : "disable";
    if (currentState !== desiredState) {
      changes.push({ label: settingId, from: currentState, to: desiredState });
    }
    updatedConfig = applySettingToConfig(updatedConfig, settingId, desiredState);
  }

  return { updatedConfig, changes };
}

export async function runConfigUpdateCommand(options: RunConfigUpdateCommandOptions): Promise<void> {
  const { settingUpdates, allSteps } = options;

  if (Object.keys(settingUpdates).length === 0) {
    const configurableSteps = allSteps.filter((step) => !PROTECTED_STEP_IDS.has(step.id));

    process.stdout.write(
      "No changes — pass flags to enable or disable steps:\n\n"
    );
    process.stdout.write(
      `  ${"--no-logo".padEnd(18)} hide the logo\n`
    );
    process.stdout.write(
      `  ${"--logo".padEnd(18)} show the logo\n`
    );
    process.stdout.write("\n");
    for (const step of configurableSteps) {
      process.stdout.write(
        `  ${`--no-${step.id}`.padEnd(18)} disable ${step.name}\n`
      );
    }
    process.stdout.write("\n");
    for (const step of configurableSteps) {
      process.stdout.write(
        `  ${`--${step.id}`.padEnd(18)} re-enable ${step.name}\n`
      );
    }
    process.stdout.write("\n");
    return;
  }

  const config = await readConfig();
  const { updatedConfig, changes } = applyConfigUpdates(config, settingUpdates);

  await writeCleanConfig(updatedConfig);

  if (changes.length === 0) {
    process.stdout.write("No changes — already set as requested.\n");
    return;
  }

  for (const { label, from, to } of changes) {
    const fromLabel = from === "enable" ? chalk.green("enabled") : chalk.red("disabled");
    const toLabel = to === "enable" ? chalk.green("enabled") : chalk.red("disabled");
    process.stdout.write(`  ${label.padEnd(12)} ${fromLabel} → ${toLabel}\n`);
  }

  const configPath = await resolveConfigPath();
  process.stdout.write(`\nConfig saved to ${chalk.dim(configPath)}\n`);
}

type BuildConfigTableOutputOptions = {
  config: BraeburnConfig;
  configPath: string;
  allSteps: Step[];
};

export function buildConfigTableOutput(options: BuildConfigTableOutputOptions): string {
  const { config, configPath, allSteps } = options;
  const lines: string[] = [];
  const stepColumnWidth = 12;
  const divider = "─".repeat(stepColumnWidth + 16);

  lines.push(`Config: ${chalk.dim(configPath)}`);
  lines.push("");
  lines.push(`${"Step".padEnd(stepColumnWidth)}Status`);
  lines.push(divider);

  const logoEnabled = isLogoEnabled(config);
  lines.push(`${"logo".padEnd(stepColumnWidth)}${logoEnabled ? chalk.green("enabled") : chalk.red("disabled")}`);
  lines.push(divider);

  for (const step of allSteps) {
    const isProtected = PROTECTED_STEP_IDS.has(step.id);
    const enabled = isStepEnabled(config, step.id);

    let statusText: string;
    if (isProtected) {
      statusText = chalk.dim("always enabled");
    } else if (enabled) {
      statusText = chalk.green("enabled");
    } else {
      statusText = chalk.red("disabled");
    }

    lines.push(`${step.id.padEnd(stepColumnWidth)}${statusText}`);
  }

  lines.push("");
  return lines.join("\n") + "\n";
}

function buildConfigViewItems(config: BraeburnConfig, allSteps: Step[]): ConfigViewItem[] {
  const viewItems: ConfigViewItem[] = [
    {
      id: "logo",
      label: "logo",
      description: "Show the braeburn logo in command output",
      protection: "configurable",
      selection: isLogoEnabled(config) ? "enabled" : "disabled",
    },
  ];

  for (const step of allSteps) {
    viewItems.push({
      id: step.id,
      label: step.id,
      description: step.description,
      protection: PROTECTED_STEP_IDS.has(step.id) ? "protected" : "configurable",
      selection: isStepEnabled(config, step.id) ? "enabled" : "disabled",
    });
  }

  return viewItems;
}

type BuildInteractiveConfigScreenOptions = {
  configPath: string;
  items: ConfigViewItem[];
  cursorIndex: number;
};

function buildInteractiveConfigScreen(options: BuildInteractiveConfigScreenOptions): string {
  const { configPath, items, cursorIndex } = options;
  const lines: string[] = [];

  lines.push(`Config: ${chalk.dim(configPath)}`);
  lines.push("");
  lines.push(`  ${chalk.dim("↑↓ navigate    Space toggle    Return save    q quit")}`);
  lines.push("");

  for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
    const item = items[itemIndex];
    const isCursor = itemIndex === cursorIndex;
    const cursor = isCursor ? chalk.cyan("›") : " ";
    const marker = item.selection === "enabled" ? chalk.green("●") : chalk.dim("○");
    const label = isCursor ? chalk.bold.white(item.label.padEnd(12)) : chalk.white(item.label.padEnd(12));

    let status: string;
    if (item.protection === "protected") {
      status = chalk.dim("always enabled");
    } else if (item.selection === "enabled") {
      status = chalk.green("enabled");
    } else {
      status = chalk.red("disabled");
    }

    lines.push(`  ${cursor} ${marker}  ${label} ${status}`);

    if (isCursor) {
      lines.push(`        ${chalk.dim(item.description)}`);
    }
  }

  const enabledCount = items.filter((item) => item.selection === "enabled").length;
  lines.push("");
  lines.push(`  ${chalk.dim(`${enabledCount} of ${items.length} settings enabled`)}`);
  lines.push("");
  return lines.join("\n") + "\n";
}

type RunInteractiveConfigViewOptions = {
  config: BraeburnConfig;
  configPath: string;
  allSteps: Step[];
};

async function runInteractiveConfigView(options: RunInteractiveConfigViewOptions): Promise<void> {
  const { config, configPath, allSteps } = options;
  const render = createScreenRenderer();
  const restoreCursor = hideCursorDuringExecution({ screenBuffer: "alternate" });
  const items = buildConfigViewItems(config, allSteps);
  let cursorIndex = 0;
  let completionOutput = "";

  try {
    render(buildInteractiveConfigScreen({ configPath, items, cursorIndex }));

    const interactionResult = await new Promise<"save" | "cancel">((resolve) => {
      readline.emitKeypressEvents(process.stdin);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }

      const completeInteraction = (result: "save" | "cancel") => {
        process.stdin.removeListener("keypress", onKeypress);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        process.stdin.pause();
        resolve(result);
      };

      const onKeypress = (_char: string, key: ConfigKeypress) => {
        if (key.ctrl && key.name === "c") {
          process.exit(130);
        }

        if (key.name === "up" || key.name === "k") {
          cursorIndex = Math.max(0, cursorIndex - 1);
          render(buildInteractiveConfigScreen({ configPath, items, cursorIndex }));
          return;
        }

        if (key.name === "down" || key.name === "j") {
          cursorIndex = Math.min(items.length - 1, cursorIndex + 1);
          render(buildInteractiveConfigScreen({ configPath, items, cursorIndex }));
          return;
        }

        if (key.name === "space") {
          const selectedItem = items[cursorIndex];
          if (selectedItem.protection === "configurable") {
            selectedItem.selection = selectedItem.selection === "enabled" ? "disabled" : "enabled";
            render(buildInteractiveConfigScreen({ configPath, items, cursorIndex }));
          }
          return;
        }

        if (key.name === "return") {
          completeInteraction("save");
          return;
        }

        if (key.name === "q" || key.name === "escape") {
          completeInteraction("cancel");
        }
      };

      process.stdin.on("keypress", onKeypress);
      process.stdin.resume();
    });

    if (interactionResult === "cancel") {
      completionOutput = "No changes saved.\n";
    } else {
      const settingUpdates: Record<string, DesiredState> = {};
      for (const item of items) {
        if (item.protection === "protected") {
          continue;
        }
        settingUpdates[item.id] = item.selection === "enabled" ? "enable" : "disable";
      }

      const { updatedConfig, changes } = applyConfigUpdates(config, settingUpdates);
      if (changes.length === 0) {
        completionOutput = "No changes — already set as requested.\n";
      } else {
        await writeCleanConfig(updatedConfig);
        const outputLines: string[] = [];
        for (const { label, from, to } of changes) {
          const fromLabel = from === "enable" ? chalk.green("enabled") : chalk.red("disabled");
          const toLabel = to === "enable" ? chalk.green("enabled") : chalk.red("disabled");
          outputLines.push(`  ${label.padEnd(12)} ${fromLabel} → ${toLabel}`);
        }
        outputLines.push("");
        outputLines.push(`Config saved to ${chalk.dim(configPath)}`);
        completionOutput = `${outputLines.join("\n")}\n`;
      }
    }
  } finally {
    restoreCursor();
  }

  process.stdout.write(completionOutput);
}

async function writeCleanConfig(config: BraeburnConfig): Promise<void> {
  const cleaned: BraeburnConfig = { steps: {} };
  for (const [stepId, value] of Object.entries(config.steps)) {
    if (value === false && !DEFAULT_OFF_STEP_IDS.has(stepId)) {
      cleaned.steps[stepId] = false;
    } else if (value === true && DEFAULT_OFF_STEP_IDS.has(stepId)) {
      cleaned.steps[stepId] = true;
    }
  }
  if (config.logo === false) {
    cleaned.logo = false;
  }
  await writeConfig(cleaned);
}
