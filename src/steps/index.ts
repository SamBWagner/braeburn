import {
  doesShellCommandSucceed,
  runShellCommand,
  captureShellCommandOutput,
  type OutputLineCallback,
} from "../runner.js";
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

export { default as homebrewStep } from "./homebrew.js";
export { default as masStep } from "./mas.js";
export { default as ohmyzshStep } from "./ohmyzsh.js";
export { default as npmStep } from "./npm.js";
export { default as pipStep } from "./pip.js";
export { default as pyenvStep } from "./pyenv.js";
export { default as nvmStep } from "./nvm.js";
export { default as dotnetStep } from "./dotnet.js";
export { default as macosStep } from "./macos.js";
export { default as cleanupStep } from "./cleanup.js";

export async function checkCommandExists(command: string): Promise<boolean> {
  return doesShellCommandSucceed({ shellCommand: `command -v ${command}` });
}

export async function checkPathExists(filePath: string): Promise<boolean> {
  return doesShellCommandSucceed({ shellCommand: `test -e "${filePath}"` });
}

export async function runStep(
  shellCommand: string,
  context: StepRunContext
): Promise<void> {
  await runShellCommand({
    shellCommand,
    onOutputLine: context.onOutputLine,
    logWriter: context.logWriter,
  });
}

export function createDefaultStepRunContext(
  onOutputLine: OutputLineCallback,
  logWriter: StepLogWriter,
): StepRunContext {
  const context: StepRunContext = {
    onOutputLine,
    logWriter,
    runStep: (shellCommand) => runStep(shellCommand, context),
    captureOutput: captureShellCommandOutput,
  };
  return context;
}
