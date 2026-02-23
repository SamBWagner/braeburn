import { runShellCommand } from "../runner.js";
import { createLogWriterForStep } from "../logger.js";
import { collectVersions } from "../ui/versionReport.js";
import { captureYesNo } from "../ui/prompt.js";
import { createInitialAppState } from "../ui/state.js";
import { buildScreen, createScreenRenderer } from "../ui/screen.js";
import { hideCursorDuringExecution } from "../ui/terminal.js";
import type { Step } from "../steps/index.js";
import { createDefaultStepRunContext } from "../steps/index.js";

type PromptMode = "interactive" | "auto-accept";
type LogoVisibility = "visible" | "hidden";

type RunUpdateCommandOptions = {
  steps: Step[];
  promptMode: PromptMode;
  logoVisibility: LogoVisibility;
  version: string;
};

export async function runUpdateCommand(options: RunUpdateCommandOptions): Promise<void> {
  const { steps, version } = options;
  let autoAccept = options.promptMode === "auto-accept";
  const state = createInitialAppState(steps, version, options.logoVisibility);
  const renderScreen = createScreenRenderer();

  hideCursorDuringExecution();

  renderScreen(buildScreen(state));

  for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
    const step = steps[stepIndex];

    state.currentStepIndex = stepIndex;
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

      const installAnswer = autoAccept ? "yes" : await captureYesNo();
      if (installAnswer === "force") autoAccept = true;
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

    state.currentPhase = "prompting-to-run";
    state.currentPrompt = { question: `Run ${step.name} update?`, warning: step.warning };
    renderScreen(buildScreen(state));

    const runAnswer = autoAccept ? "yes" : await captureYesNo();
    if (runAnswer === "force") autoAccept = true;
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
      await step.run(createDefaultStepRunContext(
        (line) => {
          state.currentOutputLines.push(line);
          renderScreen(buildScreen(state));
        },
        stepLogWriter,
      ));
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

  state.runCompletion = "finished";
  state.currentOutputLines = [];
  state.currentPrompt = undefined;
  renderScreen(buildScreen(state));

  state.versionReport = await collectVersions();
  renderScreen(buildScreen(state));
}
