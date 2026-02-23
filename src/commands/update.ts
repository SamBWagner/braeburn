import { runShellCommand } from "../runner.js";
import { createLogWriterForStep } from "../logger.js";
import { collectVersions } from "../ui/versionReport.js";
import { captureYesNo } from "../ui/prompt.js";
import { createInitialAppState } from "../ui/state.js";
import { buildScreen, renderScreen } from "../ui/screen.js";
import type { Step } from "../steps/index.js";

type RunUpdateCommandOptions = {
  steps: Step[];
  autoYes: boolean;
  showLogo: boolean;
  version: string;
};

export async function runUpdateCommand(options: RunUpdateCommandOptions): Promise<void> {
  const { steps, version } = options;
  let autoYes = options.autoYes;
  const state = createInitialAppState(steps, version, options.showLogo);

  process.stdout.write("\x1b[?25l");
  process.on("exit", () => process.stdout.write("\x1b[?25h"));
  process.on("SIGINT", () => {
    process.stdout.write("\x1b[?25h\n");
    process.exit(130);
  });

  renderScreen(buildScreen(state));

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    state.currentStepIndex = i;
    state.currentPhase = "checking-availability";
    state.currentOutputLines = [];
    state.currentPrompt = undefined;
    renderScreen(buildScreen(state));

    const isAvailable = await step.checkIsAvailable();

    if (!isAvailable && !step.brewPackageToInstall) {
      state.currentPhase = "not-available";
      renderScreen(buildScreen(state));
      state.completedStepRecords.push({ phase: "not-available", summaryNote: "not installed" });
      continue;
    }

    if (!isAvailable && step.brewPackageToInstall) {
      state.currentPhase = "prompting-to-install";
      state.currentPrompt = {
        question: `Install ${step.name} via Homebrew? (brew install ${step.brewPackageToInstall})`,
      };
      renderScreen(buildScreen(state));

      const installAnswer = autoYes ? "yes" : await captureYesNo();
      if (installAnswer === "force") autoYes = true;
      const shouldInstall = installAnswer !== "no";
      state.currentPrompt = undefined;

      if (!shouldInstall) {
        state.currentPhase = "skipped";
        renderScreen(buildScreen(state));
        state.completedStepRecords.push({ phase: "skipped" });
        continue;
      }

      state.currentPhase = "installing";
      renderScreen(buildScreen(state));

      try {
        const installLogWriter = await createLogWriterForStep(`${step.id}-install`);
        await runShellCommand({
          shellCommand: `brew install ${step.brewPackageToInstall}`,
          onOutputLine: (line) => {
            state.currentOutputLines.push(line);
            renderScreen(buildScreen(state));
          },
          logWriter: installLogWriter,
        });
      } catch {
        state.currentPhase = "failed";
        renderScreen(buildScreen(state));
        state.completedStepRecords.push({ phase: "failed", summaryNote: "install failed" });
        continue;
      }
    }

    const pipWarning =
      step.id === "pip"
        ? "This updates all global pip3 packages, which can occasionally break tools."
        : undefined;

    state.currentPhase = "prompting-to-run";
    state.currentPrompt = { question: `Run ${step.name} update?`, warning: pipWarning };
    renderScreen(buildScreen(state));

    const runAnswer = autoYes ? "yes" : await captureYesNo();
    if (runAnswer === "force") autoYes = true;
    const shouldRun = runAnswer !== "no";
    state.currentPrompt = undefined;

    if (!shouldRun) {
      state.currentPhase = "skipped";
      renderScreen(buildScreen(state));
      state.completedStepRecords.push({ phase: "skipped" });
      continue;
    }

    state.currentPhase = "running";
    state.currentOutputLines = [];
    renderScreen(buildScreen(state));

    const stepLogWriter = await createLogWriterForStep(step.id);

    try {
      await step.run({
        onOutputLine: (line) => {
          state.currentOutputLines.push(line);
          renderScreen(buildScreen(state));
        },
        logWriter: stepLogWriter,
      });
      state.currentPhase = "complete";
      state.currentOutputLines = [];
      renderScreen(buildScreen(state));
      state.completedStepRecords.push({ phase: "complete", summaryNote: "updated" });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      state.currentPhase = "failed";
      state.currentOutputLines = [];
      renderScreen(buildScreen(state));
      state.completedStepRecords.push({ phase: "failed", summaryNote: errorMessage });
    }
  }

  state.isFinished = true;
  state.currentOutputLines = [];
  state.currentPrompt = undefined;
  renderScreen(buildScreen(state));

  state.versionReport = await collectVersions();
  renderScreen(buildScreen(state));
}
