import type { OutputLineCallback } from "../runner.js";
import type { StepLogWriter } from "../logger.js";
import type { StepCategoryId } from "./categories.js";

export type StepRunContext = {
  onOutputLine: OutputLineCallback;
  logWriter: StepLogWriter;
  runStep: (shellCommand: string) => Promise<void>;
  captureOutput: (options: { shellCommand: string }) => Promise<string>;
};

export type Step = {
  id: string;
  name: string;
  description: string;
  categoryId: StepCategoryId;
  warning?: string;
  brewPackageToInstall?: string;
  checkIsAvailable: () => Promise<boolean>;
  run: (context: StepRunContext) => Promise<void>;
};
