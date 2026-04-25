import { Command } from "commander";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ALL_STEPS } from "./steps/catalog.js";
import type { Step } from "./steps/index.js";
import { applyUpdateCommandResult, runUpdateCommand } from "./commands/update.js";
import { runLogCommand, runLogListCommand } from "./commands/log.js";
import { runConfigCommand, runConfigUpdateCommand } from "./commands/config.js";
import { runSetupCommand } from "./commands/setup.js";
import {
  ConfigReadError,
  PROTECTED_STEP_IDS,
  configFileExists,
  isLogoEnabled,
  isStepEnabled,
  readConfig,
} from "./config.js";

type UpdateCommandCliOptions = {
  // Exception to the no-boolean-parameters rule: Commander provides flag values as booleans.
  yes?: boolean;
  force?: boolean;
  logo?: boolean;
};

type LogCommandCliOptions = Record<string, boolean | undefined>;

type CliProcess = Pick<NodeJS.Process, "stderr"> & {
  exitCode: string | number | null | undefined;
};

type CliCommandDependencies = {
  applyUpdateCommandResult: typeof applyUpdateCommandResult;
  configFileExists: typeof configFileExists;
  readConfig: typeof readConfig;
  runConfigCommand: typeof runConfigCommand;
  runConfigUpdateCommand: typeof runConfigUpdateCommand;
  runLogCommand: typeof runLogCommand;
  runLogListCommand: typeof runLogListCommand;
  runSetupCommand: typeof runSetupCommand;
  runUpdateCommand: typeof runUpdateCommand;
};

type CreateBraeburnProgramOptions = {
  allSteps?: Step[];
  dependencies?: Partial<CliCommandDependencies>;
  processLike?: CliProcess;
  version?: string;
};

export type StepResolution =
  | { status: "resolved"; steps: Step[] }
  | { status: "unknown-step"; stepId: string };

const requireFromThis = createRequire(import.meta.url);

function resolveBraeburnVersion(): string {
  const packageJson = requireFromThis(
    join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"),
  ) as { version: string };
  return packageJson.version;
}

function resolveDependencies(overrides: Partial<CliCommandDependencies> | undefined): CliCommandDependencies {
  return {
    applyUpdateCommandResult: overrides?.applyUpdateCommandResult ?? applyUpdateCommandResult,
    configFileExists: overrides?.configFileExists ?? configFileExists,
    readConfig: overrides?.readConfig ?? readConfig,
    runConfigCommand: overrides?.runConfigCommand ?? runConfigCommand,
    runConfigUpdateCommand: overrides?.runConfigUpdateCommand ?? runConfigUpdateCommand,
    runLogCommand: overrides?.runLogCommand ?? runLogCommand,
    runLogListCommand: overrides?.runLogListCommand ?? runLogListCommand,
    runSetupCommand: overrides?.runSetupCommand ?? runSetupCommand,
    runUpdateCommand: overrides?.runUpdateCommand ?? runUpdateCommand,
  };
}

export function resolveStepsByIds(stepIds: string[], allSteps: Step[]): StepResolution {
  const stepsById = new Map<string, Step>(
    allSteps.map((step) => [step.id, step]),
  );
  const resolvedSteps: Step[] = [];

  for (const stepId of stepIds) {
    const step = stepsById.get(stepId);

    if (!step) {
      return { status: "unknown-step", stepId };
    }

    resolvedSteps.push(step);
  }

  return { status: "resolved", steps: resolvedSteps };
}

export function reportCliError(error: unknown, processLike: CliProcess = process): void {
  if (error instanceof ConfigReadError) {
    processLike.stderr.write(`${error.message}\n`);
    processLike.exitCode = 1;
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  processLike.stderr.write(`${message}\n`);
  processLike.exitCode = 1;
}

export function createBraeburnProgram(options: CreateBraeburnProgramOptions = {}): Command {
  const allSteps = options.allSteps ?? ALL_STEPS;
  const dependencies = resolveDependencies(options.dependencies);
  const processLike = options.processLike ?? process;
  const braeburnVersion = options.version ?? resolveBraeburnVersion();

  const program = new Command();

  program
    .name("braeburn")
    .description("macOS system updater")
    .version(braeburnVersion)
    .helpCommand(false);

  program
    .command("update", { isDefault: true })
    .description("Run system update steps (default command)")
    .argument(
      "[steps...]",
      `Steps to run — omit to run all.\nAvailable: ${allSteps.map((step) => step.id).join(", ")}`,
    )
    .option("-y, --yes", "Auto-accept all prompts (default yes to everything)")
    .option("-f, --force", "Alias for --yes")
    .option("--no-logo", "Hide the logo")
    .addHelpText(
      "after",
      `
Step descriptions:
  System / Runtimes (default: off — larger changes, enabled intentionally):
  pyenv      Upgrade pyenv, install latest Python 3.x  (requires: pyenv or brew)
  nvm        Install latest Node.js via nvm             (requires: ~/.nvm)

  System / Apps & Packages:
  homebrew   Update Homebrew itself and all installed formulae
  mas        Upgrade Mac App Store apps  (requires: mas)
  macos      Check for macOS updates, prompt to install

  System / CLI Tools:
  npm        Update global npm packages  (requires: npm)
  braeburn   Update braeburn CLI itself  (requires: npm)
  pip        Update global pip3 packages (requires: pip3) ⚠ may be fragile
  dotnet     Update .NET global tools    (requires: dotnet)

  System / Shell:
  ohmyzsh    Update Oh My Zsh            (requires: ~/.oh-my-zsh)

  System / Maintenance:
  cleanup    homebrew cleanup (remove outdated Homebrew cache/downloads)

Examples:
  braeburn                  Run all enabled steps interactively
  braeburn -y               Run all enabled steps, auto-accept everything
  braeburn -fy              Same as above
  braeburn homebrew npm     Run only the homebrew and npm steps
  braeburn homebrew -y      Run only homebrew, auto-accept
  braeburn nvm pyenv        Run only the runtime steps
  `
    )
    .action(
      async (stepArguments: string[], updateOptions: UpdateCommandCliOptions) => {
        const autoYes = updateOptions.yes === true || updateOptions.force === true;

        if (!(await dependencies.configFileExists())) {
          await dependencies.runSetupCommand(allSteps);
        }

        const config = await dependencies.readConfig();

        let stepsToRun = allSteps;
        if (stepArguments.length > 0) {
          const stepResolution = resolveStepsByIds(stepArguments, allSteps);
          if (stepResolution.status === "unknown-step") {
            processLike.stderr.write(
              `Unknown step: "${stepResolution.stepId}". Run braeburn --help to see available steps.\n`,
            );
            processLike.exitCode = 1;
            return;
          }
          stepsToRun = stepResolution.steps;
        }

        if (stepArguments.length === 0) {
          stepsToRun = stepsToRun.filter((step) => isStepEnabled(config, step.id));
        }

        const logoIsEnabled = updateOptions.logo !== false && isLogoEnabled(config);

        const updateCommandResult = await dependencies.runUpdateCommand({
          steps: stepsToRun,
          promptMode: autoYes ? "auto-accept" : "interactive",
          logoVisibility: logoIsEnabled ? "visible" : "hidden",
          version: braeburnVersion,
        });

        dependencies.applyUpdateCommandResult(updateCommandResult, processLike);
      },
    );

  program
    .command("log")
    .description("View the most recent output log for a given step")
    .argument("[step]", "Step ID to view logs for (e.g. homebrew, npm, pip)")
    .option("--homebrew", "Show latest Homebrew log")
    .option("--brew", "Alias for --homebrew")
    .option("--mas", "Show latest Mac App Store log")
    .option("--ohmyzsh", "Show latest Oh My Zsh log")
    .option("--npm", "Show latest npm log")
    .option("--braeburn", "Show latest braeburn log")
    .option("--pip", "Show latest pip3 log")
    .option("--pyenv", "Show latest pyenv log")
    .option("--nvm", "Show latest nvm log")
    .option("--dotnet", "Show latest .NET log")
    .option("--macos", "Show latest macOS update log")
    .option("--cleanup", "Show latest homebrew cleanup log")
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
      async (
        stepArgument: string | undefined,
        logOptions: LogCommandCliOptions,
      ) => {
        const stepIdFromFlag = logOptions.brew === true
          ? "homebrew"
          : allSteps.map((step) => step.id).find(
            (stepId) => logOptions[stepId] === true,
          );

        const resolvedStepId = stepArgument ?? stepIdFromFlag;

        if (!resolvedStepId) {
          dependencies.runLogListCommand();
          return;
        }

        await dependencies.runLogCommand({ stepId: resolvedStepId });
      },
    );

  const configCommand = program
    .command("config")
    .description("View or edit braeburn configuration")
    .action(() => {
      configCommand.outputHelp();
    });

  configCommand
    .command("list")
    .description("Print current configuration")
    .action(async () => {
      await dependencies.runConfigCommand({
        allSteps,
        outputMode: "non-interactive",
      });
    });

  const configurableSteps = allSteps.filter((step) => !PROTECTED_STEP_IDS.has(step.id));

  const configUpdateCommand = configCommand
    .command("update")
    .description("Edit configuration (interactive by default, flags for direct updates)")
    .addHelpText(
      "after",
      `
Examples:
  braeburn config update                     Open interactive config editor
  braeburn config update --no-logo           Hide the logo
  braeburn config update --no-ohmyzsh        Disable Oh My Zsh updates
  braeburn config update --no-pip --no-nvm   Disable pip and nvm updates
  braeburn config update --ohmyzsh           Re-enable Oh My Zsh updates
    `
    );

  configUpdateCommand.option("--no-logo", "Hide the logo");
  configUpdateCommand.option("--logo", "Show the logo");

  for (const step of configurableSteps) {
    configUpdateCommand.option(`--no-${step.id}`, `Disable ${step.name} updates`);
    configUpdateCommand.option(`--${step.id}`, `Enable ${step.name} updates`);
  }

  configUpdateCommand.action(async function () {
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
      settingUpdates.logo = configUpdateCommand.opts().logo ? "enable" : "disable";
    }

    if (Object.keys(settingUpdates).length === 0) {
      await dependencies.runConfigCommand({
        allSteps,
        outputMode: "interactive",
      });
      return;
    }

    await dependencies.runConfigUpdateCommand({ settingUpdates, allSteps });
  });

  return program;
}

export async function runBraeburnCli(argv: string[] = process.argv): Promise<void> {
  try {
    await createBraeburnProgram().parseAsync(argv);
  } catch (error) {
    reportCliError(error);
  }
}
