import { createLogWriterForStep, type StepLogWriter } from "../logger.js";
import {
  runShellCommand,
  ShellCommandCanceledError,
  type CommandOutputLine,
} from "../runner.js";
import { createDefaultStepRunContext, type Step } from "../steps/index.js";
import { toDisplaySteps } from "./displayStep.js";
import {
  createInitialUpdateState,
  type CompletedStepRecord,
  type LogoVisibility,
  type ResolvedVersion,
  type UpdateState,
} from "./state.js";

export type PromptMode = "interactive" | "auto-accept";
export type ConfirmationAnswer = "yes" | "no" | "skip" | "force";

type UpdateEngineDependencies = {
  createLogWriter: (stepId: string) => Promise<StepLogWriter>;
  runCommand: typeof runShellCommand;
  createStepRunContext: typeof createDefaultStepRunContext;
};

type PromptDecision = "run" | "skip";

type PromptResolution = {
  promptMode: PromptMode;
  decision: PromptDecision;
};

type RunUpdateEngineOptions = {
  steps: Step[];
  promptMode: PromptMode;
  version: string;
  logoVisibility: LogoVisibility;
  askForConfirmation: () => Promise<ConfirmationAnswer>;
  collectVersions: () => Promise<ResolvedVersion[]>;
  onStateChanged: (state: UpdateState) => void;
  dependencies?: Partial<UpdateEngineDependencies>;
};

function resolveDependencies(
  dependencyOverrides: Partial<UpdateEngineDependencies> | undefined,
): UpdateEngineDependencies {
  return {
    createLogWriter: dependencyOverrides?.createLogWriter ?? createLogWriterForStep,
    runCommand: dependencyOverrides?.runCommand ?? runShellCommand,
    createStepRunContext: dependencyOverrides?.createStepRunContext ?? createDefaultStepRunContext,
  };
}

async function resolvePrompt(
  promptMode: PromptMode,
  askForConfirmation: () => Promise<ConfirmationAnswer>,
): Promise<PromptResolution> {
  if (promptMode === "auto-accept") {
    return { promptMode: "auto-accept", decision: "run" };
  }

  const answer = await askForConfirmation();

  if (answer === "no" || answer === "skip") {
    return { promptMode: "interactive", decision: "skip" };
  }

  if (answer === "force") {
    return { promptMode: "auto-accept", decision: "run" };
  }

  return { promptMode: "interactive", decision: "run" };
}

function reportState(
  state: UpdateState,
  onStateChanged: (state: UpdateState) => void,
): void {
  onStateChanged(state);
}

function wasStepCanceledByUser(error: unknown): boolean {
  return error instanceof ShellCommandCanceledError;
}

function createFailureOutputLines(
  currentOutputLines: CommandOutputLine[],
  error: unknown,
): CommandOutputLine[] {
  if (currentOutputLines.length > 0) {
    return [...currentOutputLines];
  }

  const errorMessage = error instanceof Error && error.message.length > 0
    ? error.message
    : "Command failed.";

  return [{ text: errorMessage, source: "stderr" }];
}

function createFailedStepRecord(options: {
  error: unknown;
  failureOutputLines: CommandOutputLine[];
  logStepId: string;
}): CompletedStepRecord {
  const errorMessage = options.error instanceof Error ? options.error.message : String(options.error);

  return {
    phase: "failed",
    summaryNote: wasStepCanceledByUser(options.error) ? "canceled by user" : errorMessage,
    logStepId: options.logStepId,
    failureOutputLines: [...options.failureOutputLines],
  };
}

export async function runUpdateEngine(options: RunUpdateEngineOptions): Promise<UpdateState> {
  const dependencies = resolveDependencies(options.dependencies);
  const state = createInitialUpdateState(
    toDisplaySteps(options.steps),
    options.version,
    options.logoVisibility,
  );
  let promptMode = options.promptMode;

  reportState(state, options.onStateChanged);

  for (let stepIndex = 0; stepIndex < options.steps.length; stepIndex++) {
    const step = options.steps[stepIndex];

    state.currentStepIndex = stepIndex;
    state.currentPhase = "checking-availability";
    state.currentOutputLines = [];
    state.currentPrompt = undefined;
    reportState(state, options.onStateChanged);

    const availabilityStatus = (await step.checkIsAvailable())
      ? "available"
      : "unavailable";

    if (availabilityStatus === "unavailable" && !step.brewPackageToInstall) {
      state.currentPhase = "not-available";
      reportState(state, options.onStateChanged);
      state.completedStepRecords.push({ phase: "not-available", summaryNote: "not installed" });
      continue;
    }

    if (availabilityStatus === "unavailable" && step.brewPackageToInstall) {
      state.currentPhase = "prompting-to-install";
      state.currentPrompt = {
        question: `Install ${step.name} via Homebrew? (brew install ${step.brewPackageToInstall})`,
      };
      reportState(state, options.onStateChanged);

      const installPrompt = await resolvePrompt(promptMode, options.askForConfirmation);
      promptMode = installPrompt.promptMode;
      state.currentPrompt = undefined;

      if (installPrompt.decision === "skip") {
        state.currentPhase = "skipped";
        reportState(state, options.onStateChanged);
        state.completedStepRecords.push({ phase: "skipped" });
        continue;
      }

      state.currentPhase = "installing";
      reportState(state, options.onStateChanged);

      try {
        const installLogWriter = await dependencies.createLogWriter(`${step.id}-install`);
        await dependencies.runCommand({
          shellCommand: `brew install ${step.brewPackageToInstall}`,
          onOutputLine: (line) => {
            state.currentOutputLines.push(line);
            reportState(state, options.onStateChanged);
          },
          logWriter: installLogWriter,
        });
      } catch (error) {
        if (wasStepCanceledByUser(error)) {
          promptMode = "interactive";
        }

        const failureOutputLines = createFailureOutputLines(state.currentOutputLines, error);
        state.currentPhase = "failed";
        state.currentOutputLines = failureOutputLines;
        reportState(state, options.onStateChanged);
        state.completedStepRecords.push(createFailedStepRecord({
          error,
          failureOutputLines,
          logStepId: `${step.id}-install`,
        }));
        continue;
      }
    }

    state.currentPhase = "prompting-to-run";
    state.currentPrompt = { question: `Run ${step.name} update?`, warning: step.warning };
    reportState(state, options.onStateChanged);

    const runPrompt = await resolvePrompt(promptMode, options.askForConfirmation);
    promptMode = runPrompt.promptMode;
    state.currentPrompt = undefined;

    if (runPrompt.decision === "skip") {
      state.currentPhase = "skipped";
      reportState(state, options.onStateChanged);
      state.completedStepRecords.push({ phase: "skipped" });
      continue;
    }

    state.currentPhase = "running";
    state.currentOutputLines = [];
    reportState(state, options.onStateChanged);

    const stepLogWriter = await dependencies.createLogWriter(step.id);

    try {
      await step.run(
        dependencies.createStepRunContext(
          (line) => {
            state.currentOutputLines.push(line);
            reportState(state, options.onStateChanged);
          },
          stepLogWriter,
        ),
      );
      state.currentPhase = "complete";
      state.currentOutputLines = [];
      reportState(state, options.onStateChanged);
      state.completedStepRecords.push({ phase: "complete", summaryNote: "updated" });
    } catch (error) {
      if (wasStepCanceledByUser(error)) {
        promptMode = "interactive";
      }

      const failureOutputLines = createFailureOutputLines(state.currentOutputLines, error);
      state.currentPhase = "failed";
      state.currentOutputLines = failureOutputLines;
      reportState(state, options.onStateChanged);
      state.completedStepRecords.push(createFailedStepRecord({
        error,
        failureOutputLines,
        logStepId: step.id,
      }));
    }
  }

  state.runCompletion = "finished";
  state.currentOutputLines = [];
  state.currentPrompt = undefined;
  reportState(state, options.onStateChanged);

  state.versionReport = await options.collectVersions();
  reportState(state, options.onStateChanged);

  return state;
}
