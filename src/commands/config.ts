import chalk from "chalk";
import {
  readConfig,
  writeConfig,
  resolveConfigPath,
  isStepEnabled,
  PROTECTED_STEP_IDS,
  type BraeburnConfig,
} from "../config.js";
import type { Step } from "../steps/index.js";

type RunConfigCommandOptions = {
  allSteps: Step[];
};

type RunConfigUpdateCommandOptions = {
  stepUpdates: Record<string, boolean>;
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

export async function runConfigUpdateCommand(options: RunConfigUpdateCommandOptions): Promise<void> {
  const { stepUpdates, allSteps } = options;

  if (Object.keys(stepUpdates).length === 0) {
    const configurableSteps = allSteps.filter((s) => !PROTECTED_STEP_IDS.has(s.id));

    process.stdout.write(
      "No changes — pass flags to enable or disable steps:\n\n"
    );
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
  const changes: Array<{ stepId: string; from: boolean; to: boolean }> = [];

  for (const [stepId, newEnabled] of Object.entries(stepUpdates)) {
    const currentlyEnabled = isStepEnabled(config, stepId);
    if (currentlyEnabled !== newEnabled) {
      changes.push({ stepId, from: currentlyEnabled, to: newEnabled });
    }
    if (newEnabled) {
      // Re-enabling: remove from config so absent = enabled (keeps file minimal)
      delete config.steps[stepId];
    } else {
      config.steps[stepId] = false;
    }
  }

  // Write even if no visible changes, in case the user is re-confirming state
  await writeCleanConfig(config);

  if (changes.length === 0) {
    process.stdout.write("No changes — already set as requested.\n");
    return;
  }

  for (const { stepId, from, to } of changes) {
    const fromLabel = from ? chalk.green("enabled") : chalk.red("disabled");
    const toLabel = to ? chalk.green("enabled") : chalk.red("disabled");
    process.stdout.write(`  ${stepId.padEnd(12)} ${fromLabel} → ${toLabel}\n`);
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
  await writeConfig(cleaned);
}
