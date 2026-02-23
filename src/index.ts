#!/usr/bin/env node
import { Command } from "commander";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  homebrewStep,
  masStep,
  ohmyzshStep,
  npmStep,
  pipStep,
  pyenvStep,
  nvmStep,
  dotnetStep,
  macosStep,
  cleanupStep,
  type Step,
} from "./steps/index.js";
import { runUpdateCommand } from "./commands/update.js";
import { runLogCommand, runLogListCommand } from "./commands/log.js";
import { runConfigCommand, runConfigUpdateCommand } from "./commands/config.js";
import { runSetupCommand } from "./commands/setup.js";
import { readConfig, isStepEnabled, isLogoEnabled, PROTECTED_STEP_IDS, configFileExists } from "./config.js";

const ALL_STEPS: Step[] = [
  homebrewStep,
  masStep,
  ohmyzshStep,
  npmStep,
  pipStep,
  pyenvStep,
  nvmStep,
  dotnetStep,
  macosStep,
  cleanupStep,
];

const STEP_IDS_BY_NAME = new Map<string, Step>(
  ALL_STEPS.map((step) => [step.id, step])
);

const requireFromThis = createRequire(import.meta.url);
const packageJson = requireFromThis(
  join(dirname(fileURLToPath(import.meta.url)), "..", "package.json")
) as { version: string };
const BRAEBURN_VERSION = packageJson.version;

const program = new Command();

program
  .name("braeburn")
  .description("macOS system updater")
  .version(BRAEBURN_VERSION)
  .helpCommand(false);

program
  .command("update", { isDefault: true })
  .description("Run system update steps (default command)")
  .argument(
    "[steps...]",
    `Steps to run — omit to run all.\nAvailable: ${ALL_STEPS.map((step) => step.id).join(", ")}`
  )
  .option("-y, --yes", "Auto-accept all prompts (default yes to everything)")
  .option("-f, --force", "Alias for --yes")
  .option("--no-logo", "Hide the logo")
  .addHelpText(
    "after",
    `
Step descriptions:
  homebrew   Update Homebrew itself and all installed formulae
  mas        Upgrade Mac App Store apps  (requires: mas)
  ohmyzsh    Update Oh My Zsh            (requires: ~/.oh-my-zsh)
  npm        Update global npm packages  (requires: npm)
  pip        Update global pip3 packages (requires: pip3) ⚠ may be fragile
  pyenv      Upgrade pyenv, install latest Python 3.x (requires: pyenv or brew)
  nvm        Update Node.js via nvm      (requires: ~/.nvm)
  dotnet     Update .NET global tools    (requires: dotnet)
  macos      Check for macOS updates, prompt to install
  cleanup    Clean up Homebrew cache and old downloads

Examples:
  braeburn                  Run all steps interactively
  braeburn -y               Run all steps, auto-accept everything
  braeburn -fy              Same as above
  braeburn homebrew npm     Run only the homebrew and npm steps
  braeburn homebrew -y      Run only homebrew, auto-accept
  `
  )
  .action(
    async (stepArguments: string[], options: { yes?: boolean; force?: boolean; logo?: boolean }) => {
      const autoYes = options.yes === true || options.force === true;

      if (!(await configFileExists())) {
        await runSetupCommand(ALL_STEPS);
      }

      const config = await readConfig();

      let stepsToRun =
        stepArguments.length === 0
          ? ALL_STEPS
          : resolveStepsByIds(stepArguments);

      if (stepArguments.length === 0) {
        stepsToRun = stepsToRun.filter((step) => isStepEnabled(config, step.id));
      }

      const logoIsEnabled = options.logo !== false && isLogoEnabled(config);

      await runUpdateCommand({
        steps: stepsToRun,
        promptMode: autoYes ? "auto-accept" : "interactive",
        logoVisibility: logoIsEnabled ? "visible" : "hidden",
        version: BRAEBURN_VERSION,
      });
    }
  );

program
  .command("log")
  .description("View the most recent output log for a given step")
  .argument("[step]", "Step ID to view logs for (e.g. homebrew, npm, pip)")
  .option("--homebrew", "Show latest Homebrew log")
  .option("--mas", "Show latest Mac App Store log")
  .option("--ohmyzsh", "Show latest Oh My Zsh log")
  .option("--npm", "Show latest npm log")
  .option("--pip", "Show latest pip3 log")
  .option("--pyenv", "Show latest pyenv log")
  .option("--nvm", "Show latest nvm log")
  .option("--dotnet", "Show latest .NET log")
  .option("--macos", "Show latest macOS update log")
  .option("--cleanup", "Show latest cleanup log")
  .addHelpText(
    "after",
    `
Examples:
  braeburn log              List all available step logs
  braeburn log homebrew     Show the latest Homebrew run log
  braeburn log --brew       Same as above
  braeburn log npm | less   Pipe log output through less
  `
  )
  .action(
    (
      stepArgument: string | undefined,
      options: Record<string, boolean | undefined>
    ) => {
      const stepIdFromFlag = ALL_STEPS.map((step) => step.id).find(
        (stepId) => options[stepId] === true
      );

      const resolvedStepId = stepArgument ?? stepIdFromFlag;

      if (!resolvedStepId) {
        runLogListCommand();
        return;
      }

      runLogCommand({ stepId: resolvedStepId });
    }
  );

const configCommand = program
  .command("config")
  .description("View or edit braeburn configuration")
  .action(async () => {
    await runConfigCommand({ allSteps: ALL_STEPS });
  });

const configurableSteps = ALL_STEPS.filter((step) => !PROTECTED_STEP_IDS.has(step.id));

const configUpdateCommand = configCommand
  .command("update")
  .description("Enable or disable individual update steps")
  .addHelpText(
    "after",
    `
Examples:
  braeburn config update --no-logo           Hide the logo
  braeburn config update --no-ohmyzsh        Disable Oh My Zsh updates
  braeburn config update --no-pip --no-nvm   Disable pip and nvm updates
  braeburn config update --ohmyzsh           Re-enable Oh My Zsh updates
    `
  );

configUpdateCommand.option(`--no-logo`, `Hide the logo`);
configUpdateCommand.option(`--logo`, `Show the logo`);

for (const step of configurableSteps) {
  configUpdateCommand.option(`--no-${step.id}`, `Disable ${step.name} updates`);
  configUpdateCommand.option(`--${step.id}`, `Enable ${step.name} updates`);
}

configUpdateCommand.action(function () {
  // Commander defaults --no-* to true, so we use getOptionValueSource to detect explicit CLI flags.
  const settingUpdates: Record<string, "enable" | "disable"> = {};

  for (const step of configurableSteps) {
    const source = configUpdateCommand.getOptionValueSource(step.id);
    if (source === "cli") {
      settingUpdates[step.id] = configUpdateCommand.opts()[step.id] ? "enable" : "disable";
    }
  }

  const logoSource = configUpdateCommand.getOptionValueSource("logo");
  if (logoSource === "cli") {
    settingUpdates["logo"] = configUpdateCommand.opts().logo ? "enable" : "disable";
  }

  runConfigUpdateCommand({ settingUpdates, allSteps: ALL_STEPS });
});

function resolveStepsByIds(stepIds: string[]): Step[] {
  const resolvedSteps: Step[] = [];

  for (const stepId of stepIds) {
    const step = STEP_IDS_BY_NAME.get(stepId);

    if (!step) {
      process.stderr.write(
        `Unknown step: "${stepId}". Run braeburn --help to see available steps.\n`
      );
      process.exit(1);
    }

    resolvedSteps.push(step!);
  }

  return resolvedSteps;
}

program.parse();
