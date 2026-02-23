import type { Step } from "../steps/index.js";
import type { CommandOutputLine } from "../runner.js";

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

export type AppState = {
  steps: Step[];
  version: string;
  showLogo: boolean;
  currentStepIndex: number;
  currentPhase: StepPhase;
  completedStepRecords: CompletedStepRecord[];
  currentOutputLines: CommandOutputLine[];
  currentPrompt: CurrentPrompt | undefined;
  isFinished: boolean;
  versionReport: ResolvedVersion[] | undefined;
};

export function createInitialAppState(steps: Step[], version: string, showLogo: boolean): AppState {
  return {
    steps,
    version,
    showLogo,
    currentStepIndex: 0,
    currentPhase: "checking-availability",
    completedStepRecords: [],
    currentOutputLines: [],
    currentPrompt: undefined,
    isFinished: false,
    versionReport: undefined,
  };
}
