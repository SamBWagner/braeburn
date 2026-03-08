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

type ShellCommandExecutionResult = {
  capturedOutput: string;
};

type ShellCommandSubprocess = ReturnType<typeof execa>;

const FAILURE_OUTPUT_TAIL_LINE_LIMIT = 20;
let activeShellCommandSubprocess: ShellCommandSubprocess | undefined;
const userCanceledSubprocesses = new WeakSet<ShellCommandSubprocess>();

type BufferedLineEmitter = {
  appendChunk: (chunk: unknown) => void;
  flushPendingLine: () => void;
};

export class ShellCommandCanceledError extends Error {
  readonly shellCommand: string;
  readonly originalError: unknown;

  constructor(shellCommand: string, originalError: unknown) {
    super(`Command canceled by user: ${shellCommand}`);
    this.name = "ShellCommandCanceledError";
    this.shellCommand = shellCommand;
    this.originalError = originalError;
  }
}

export function cancelActiveShellCommand(): boolean {
  if (!activeShellCommandSubprocess) {
    return false;
  }

  userCanceledSubprocesses.add(activeShellCommandSubprocess);
  activeShellCommandSubprocess.kill("SIGTERM");
  return true;
}

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

function createBufferedLineEmitter(
  emitLine: (line: string) => void,
): BufferedLineEmitter {
  let pendingText = "";

  return {
    appendChunk(chunk: unknown): void {
      pendingText += String(chunk);
      const lineParts = pendingText.split(/\r?\n|\r/);
      pendingText = lineParts.pop() ?? "";

      for (const linePart of lineParts) {
        if (linePart.length === 0) {
          continue;
        }

        emitLine(linePart);
      }
    },

    flushPendingLine(): void {
      if (pendingText.length === 0) {
        return;
      }

      emitLine(pendingText);
      pendingText = "";
    },
  };
}

async function executeShellCommand(
  options: RunCommandOptions,
): Promise<ShellCommandExecutionResult> {
  const capturedOutputLines: string[] = [];
  const subprocess = execa("bash", ["-c", options.shellCommand], {
    all: true,
    reject: true,
  });
  activeShellCommandSubprocess = subprocess;

  const emitOutputLine = (line: CommandOutputLine): void => {
    capturedOutputLines.push(line.text);
    options.onOutputLine(line);
    options.logWriter(line.text);
  };

  const stdoutEmitter = createBufferedLineEmitter((line) => {
    emitOutputLine({ text: line, source: "stdout" });
  });
  const stderrEmitter = createBufferedLineEmitter((line) => {
    emitOutputLine({ text: line, source: "stderr" });
  });

  subprocess.stdout?.on("data", (chunk: unknown) => {
    stdoutEmitter.appendChunk(chunk);
  });

  subprocess.stderr?.on("data", (chunk: unknown) => {
    stderrEmitter.appendChunk(chunk);
  });

  try {
    await subprocess;
    stdoutEmitter.flushPendingLine();
    stderrEmitter.flushPendingLine();
    return { capturedOutput: capturedOutputLines.join("\n") };
  } catch (error) {
    stdoutEmitter.flushPendingLine();
    stderrEmitter.flushPendingLine();

    const commandWasCanceledByUser = userCanceledSubprocesses.has(subprocess);
    const failureSummaryLines = buildFailureSummaryLines(options.shellCommand, error);
    if (commandWasCanceledByUser) {
      failureSummaryLines.push("[braeburn] Command canceled by user input (q).");
    }

    for (const line of failureSummaryLines) {
      await options.logWriter(line);
    }

    if (commandWasCanceledByUser) {
      throw new ShellCommandCanceledError(options.shellCommand, error);
    }

    throw error;
  } finally {
    if (activeShellCommandSubprocess === subprocess) {
      activeShellCommandSubprocess = undefined;
    }
  }
}

export async function runShellCommand(
  options: RunCommandOptions
): Promise<void> {
  await executeShellCommand(options);
}

export async function runShellCommandAndCaptureOutput(
  options: RunCommandOptions,
): Promise<string> {
  const result = await executeShellCommand(options);
  return result.capturedOutput;
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
