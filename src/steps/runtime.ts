import {
  doesShellCommandSucceed,
  runShellCommand,
  captureShellCommandOutput,
  type OutputLineCallback,
} from "../runner.js";
import type { StepLogWriter } from "../logger.js";
import type { StepRunContext } from "./types.js";

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
