import type { CommandOutputLine } from "../runner.js";

export type StepStage = "runtime" | "tools";

export type DisplayStep = {
  id: string;
  name: string;
  description: string;
  stage: StepStage;
};

export type StepPhase =
  | "pending"
  | "checking-availability"
  | "prompting-to-install"
  | "installing"
  | "prompting-to-run"
  | "running"
  | "complete"
  | "failed"
  | "skipped"
  | "not-available";

export type CompletedStepRecord = {
  phase: StepPhase;
  summaryNote?: string;
};

export type CurrentPrompt = {
  question: string;
  warning?: string;
};

export type ResolvedVersion = {
  label: string;
  value: string;
};

export type LogoVisibility = "visible" | "hidden";

export type RunCompletion = "in-progress" | "finished";

export type UpdateState = {
  steps: DisplayStep[];
  version: string;
  logoVisibility: LogoVisibility;
  currentStepIndex: number;
  currentPhase: StepPhase;
  completedStepRecords: CompletedStepRecord[];
  currentOutputLines: CommandOutputLine[];
  currentPrompt: CurrentPrompt | undefined;
  runCompletion: RunCompletion;
  versionReport: ResolvedVersion[] | undefined;
};

export type AppState = UpdateState;

export function createInitialUpdateState(
  steps: DisplayStep[],
  version: string,
  logoVisibility: LogoVisibility,
): UpdateState {
  return {
    steps,
    version,
    logoVisibility,
    currentStepIndex: 0,
    currentPhase: "checking-availability",
    completedStepRecords: [],
    currentOutputLines: [],
    currentPrompt: undefined,
    runCompletion: "in-progress",
    versionReport: undefined,
  };
}

export const createInitialAppState = createInitialUpdateState;
