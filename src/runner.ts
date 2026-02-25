import { execa } from "execa";
import type { StepLogWriter } from "./logger.js";

export type OutputSource = "stdout" | "stderr";
export type CommandOutputLine = { text: string; source: OutputSource };
export type OutputLineCallback = (line: CommandOutputLine) => void;

type RunCommandOptions = {
  shellCommand: string;
  onOutputLine: OutputLineCallback;
  logWriter: StepLogWriter;
};

const FAILURE_OUTPUT_TAIL_LINE_LIMIT = 20;

function splitNonEmptyLines(text: string | undefined): string[] {
  if (!text) {
    return [];
  }

  return text.split(/\r?\n|\r/).filter(Boolean);
}

function buildFailureSummaryLines(
  shellCommand: string,
  error: unknown,
): string[] {
  const defaultMessage = error instanceof Error ? error.message : String(error);

  if (typeof error !== "object" || error === null) {
    return [
      `[braeburn] Command failed: ${shellCommand}`,
      `[braeburn] Error: ${defaultMessage}`,
    ];
  }

  const errorDetails = error as {
    exitCode?: number;
    signal?: string;
    shortMessage?: string;
    stdout?: string;
    stderr?: string;
  };

  const summaryLines = [`[braeburn] Command failed: ${shellCommand}`];

  if (typeof errorDetails.exitCode === "number") {
    summaryLines.push(`[braeburn] Exit code: ${errorDetails.exitCode}`);
  }

  if (typeof errorDetails.signal === "string") {
    summaryLines.push(`[braeburn] Signal: ${errorDetails.signal}`);
  }

  if (typeof errorDetails.shortMessage === "string" && errorDetails.shortMessage.length > 0) {
    summaryLines.push(`[braeburn] ${errorDetails.shortMessage}`);
  } else {
    summaryLines.push(`[braeburn] Error: ${defaultMessage}`);
  }

  const stderrTailLines = splitNonEmptyLines(errorDetails.stderr).slice(-FAILURE_OUTPUT_TAIL_LINE_LIMIT);
  if (stderrTailLines.length > 0) {
    summaryLines.push(`[braeburn] stderr tail (${stderrTailLines.length}):`);
    summaryLines.push(...stderrTailLines.map((line) => `  ${line}`));
  }

  const stdoutTailLines = splitNonEmptyLines(errorDetails.stdout).slice(-FAILURE_OUTPUT_TAIL_LINE_LIMIT);
  if (stdoutTailLines.length > 0) {
    summaryLines.push(`[braeburn] stdout tail (${stdoutTailLines.length}):`);
    summaryLines.push(...stdoutTailLines.map((line) => `  ${line}`));
  }

  return summaryLines;
}

export async function runShellCommand(
  options: RunCommandOptions
): Promise<void> {
  const subprocess = execa("bash", ["-c", options.shellCommand], {
    all: true,
    reject: true,
  });

  subprocess.stdout?.on("data", (chunk: unknown) => {
    const lines = String(chunk).split(/\r?\n|\r/).filter(Boolean);
    for (const line of lines) {
      options.onOutputLine({ text: line, source: "stdout" });
      options.logWriter(line);
    }
  });

  subprocess.stderr?.on("data", (chunk: unknown) => {
    const lines = String(chunk).split(/\r?\n|\r/).filter(Boolean);
    for (const line of lines) {
      options.onOutputLine({ text: line, source: "stderr" });
      options.logWriter(line);
    }
  });

  try {
    await subprocess;
  } catch (error) {
    const failureSummaryLines = buildFailureSummaryLines(options.shellCommand, error);
    for (const line of failureSummaryLines) {
      await options.logWriter(line);
    }
    throw error;
  }
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
