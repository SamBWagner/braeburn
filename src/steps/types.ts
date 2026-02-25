import type { OutputLineCallback } from "../runner.js";
import type { StepLogWriter } from "../logger.js";

export type StepRunContext = {
  onOutputLine: OutputLineCallback;
  logWriter: StepLogWriter;
  runStep: (shellCommand: string) => Promise<void>;
  captureOutput: (options: { shellCommand: string }) => Promise<string>;
};

export type StepStage = "runtime" | "tools";

export type Step = {
  id: string;
  name: string;
  description: string;
  stage: StepStage;
  warning?: string;
  brewPackageToInstall?: string;
  checkIsAvailable: () => Promise<boolean>;
  run: (context: StepRunContext) => Promise<void>;
};
