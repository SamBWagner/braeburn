import { execa } from "execa";
import type { StepLogWriter } from "./logger.js";

export type CommandOutputLine = { text: string; isError: boolean };
export type OutputLineCallback = (line: CommandOutputLine) => void;

type RunCommandOptions = {
  shellCommand: string;
  onOutputLine: OutputLineCallback;
  logWriter: StepLogWriter;
};

export async function runShellCommand(
  options: RunCommandOptions
): Promise<void> {
  const subprocess = execa("bash", ["-c", options.shellCommand], {
    all: true,
    reject: true,
  });

  subprocess.stdout?.on("data", (chunk: unknown) => {
    const lines = String(chunk).split("\n").filter(Boolean);
    for (const line of lines) {
      options.onOutputLine({ text: line, isError: false });
      options.logWriter(line);
    }
  });

  subprocess.stderr?.on("data", (chunk: unknown) => {
    const lines = String(chunk).split("\n").filter(Boolean);
    for (const line of lines) {
      options.onOutputLine({ text: line, isError: true });
      options.logWriter(line);
    }
  });

  await subprocess;
}

type CheckCommandOptions = {
  shellCommand: string;
};

export async function doesShellCommandSucceed(
  options: CheckCommandOptions
): Promise<boolean> {
  const result = await execa("bash", ["-c", options.shellCommand], {
    reject: false,
  });

  return result.exitCode === 0;
}

type CaptureCommandOptions = {
  shellCommand: string;
};

export async function captureShellCommandOutput(
  options: CaptureCommandOptions
): Promise<string> {
  const result = await execa("bash", ["-c", options.shellCommand], {
    reject: false,
  });

  return result.stdout.trim();
}
