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
  type BraeburnConfig,
} from "../config.js";
import type { Step } from "../steps/index.js";

type RunConfigCommandOptions = {
  allSteps: Step[];
};

type DesiredState = "enable" | "disable";

type RunConfigUpdateCommandOptions = {
  settingUpdates: Record<string, DesiredState>;
  allSteps: Step[];
};

export async function runConfigCommand(options: RunConfigCommandOptions): Promise<void> {
  const { allSteps } = options;
  const config = await readConfig();
  const configPath = await resolveConfigPath();

  const STEP_COL = 12;
  const DIVIDER = "─".repeat(STEP_COL + 16);

  process.stdout.write(`Config: ${chalk.dim(configPath)}\n\n`);
  process.stdout.write(`${"Step".padEnd(STEP_COL)}Status\n`);
  process.stdout.write(`${DIVIDER}\n`);

  const logoEnabled = isLogoEnabled(config);
  process.stdout.write(`${"logo".padEnd(STEP_COL)}${logoEnabled ? chalk.green("enabled") : chalk.red("disabled")}\n`);
  process.stdout.write(`${DIVIDER}\n`);

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

    process.stdout.write(`${step.id.padEnd(STEP_COL)}${statusText}\n`);
  }

  process.stdout.write(`\n`);
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

async function writeCleanConfig(config: BraeburnConfig): Promise<void> {
  const cleaned: BraeburnConfig = { steps: {} };
  for (const [stepId, enabled] of Object.entries(config.steps)) {
    if (enabled === false) {
      cleaned.steps[stepId] = false;
    }
  }
  if (config.logo === false) {
    cleaned.logo = false;
  }
  await writeConfig(cleaned);
}
