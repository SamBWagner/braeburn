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
  capturedOutput?: string;
};

type ShellCommandSubprocess = ReturnType<typeof execa>;

const FAILURE_OUTPUT_TAIL_LINE_LIMIT = 20;
const DEFAULT_CAPTURE_MODE = "disabled";
const MAX_BUFFERED_OUTPUT_LINE_LENGTH = 16_384;

type CommandCaptureMode = "disabled" | "enabled";

type BufferedLineEmitter = {
  appendChunk: (chunk: unknown) => void;
  flushPendingLine: () => void;
};

type ShellCommandFailureDetails = {
  shellCommand: string;
  error: unknown;
  stdoutTailLines: string[];
  stderrTailLines: string[];
};

type ShellCommandRunnerState = {
  activeShellCommandSubprocess: ShellCommandSubprocess | undefined;
  userCanceledSubprocesses: WeakSet<ShellCommandSubprocess>;
};

export type ShellCommandRunner = {
  cancelActiveShellCommand: () => boolean;
  runShellCommand: (options: RunCommandOptions) => Promise<void>;
  runShellCommandAndCaptureOutput: (options: RunCommandOptions) => Promise<string>;
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

function createLimitedLineBuffer(lineLimit: number): {
  add: (line: string) => void;
  lines: () => string[];
} {
  const lines: string[] = [];

  return {
    add(line: string): void {
      lines.push(line);
      if (lines.length > lineLimit) {
        lines.shift();
      }
    },

    lines(): string[] {
      return [...lines];
    },
  };
}

function cancelActiveShellCommandForState(state: ShellCommandRunnerState): boolean {
  if (!state.activeShellCommandSubprocess) {
    return false;
  }

  state.userCanceledSubprocesses.add(state.activeShellCommandSubprocess);
  state.activeShellCommandSubprocess.kill("SIGTERM");
  return true;
}

function buildFailureSummaryLines(
  details: ShellCommandFailureDetails,
): string[] {
  const { shellCommand, error, stdoutTailLines, stderrTailLines } = details;
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

  if (stderrTailLines.length > 0) {
    summaryLines.push(`[braeburn] stderr tail (${stderrTailLines.length}):`);
    summaryLines.push(...stderrTailLines.map((line) => `  ${line}`));
  }

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

      while (pendingText.length > MAX_BUFFERED_OUTPUT_LINE_LENGTH) {
        emitLine(pendingText.slice(0, MAX_BUFFERED_OUTPUT_LINE_LENGTH));
        pendingText = pendingText.slice(MAX_BUFFERED_OUTPUT_LINE_LENGTH);
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
  state: ShellCommandRunnerState,
  options: RunCommandOptions,
  captureMode: CommandCaptureMode = DEFAULT_CAPTURE_MODE,
): Promise<ShellCommandExecutionResult> {
  const capturedOutputLines = captureMode === "enabled" ? [] as string[] : undefined;
  const stdoutTailLines = createLimitedLineBuffer(FAILURE_OUTPUT_TAIL_LINE_LIMIT);
  const stderrTailLines = createLimitedLineBuffer(FAILURE_OUTPUT_TAIL_LINE_LIMIT);
  let logWriteQueue: Promise<void> = Promise.resolve();
  let logWriteFailure: unknown;
  const subprocess = execa("bash", ["-c", options.shellCommand], {
    buffer: false,
    reject: true,
  });
  state.activeShellCommandSubprocess = subprocess;

  const queueLogWrite = (line: string): void => {
    logWriteQueue = logWriteQueue.then(async () => {
      if (logWriteFailure) {
        return;
      }

      try {
        await options.logWriter(line);
      } catch (error) {
        logWriteFailure = error;
      }
    });
  };

  const waitForQueuedLogWrites = async (): Promise<void> => {
    await logWriteQueue;
    if (logWriteFailure) {
      throw logWriteFailure;
    }
  };

  const emitOutputLine = (line: CommandOutputLine): void => {
    if (line.source === "stdout") {
      stdoutTailLines.add(line.text);
    } else {
      stderrTailLines.add(line.text);
    }

    capturedOutputLines?.push(line.text);
    options.onOutputLine(line);
    queueLogWrite(line.text);
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
    await waitForQueuedLogWrites();
    return { capturedOutput: capturedOutputLines?.join("\n") };
  } catch (error) {
    stdoutEmitter.flushPendingLine();
    stderrEmitter.flushPendingLine();

    const commandWasCanceledByUser = state.userCanceledSubprocesses.has(subprocess);
    const failureSummaryLines = buildFailureSummaryLines({
      shellCommand: options.shellCommand,
      error,
      stdoutTailLines: stdoutTailLines.lines(),
      stderrTailLines: stderrTailLines.lines(),
    });
    if (commandWasCanceledByUser) {
      failureSummaryLines.push("[braeburn] Command canceled by user input (q).");
    }

    for (const line of failureSummaryLines) {
      queueLogWrite(line);
    }

    await waitForQueuedLogWrites();

    if (commandWasCanceledByUser) {
      throw new ShellCommandCanceledError(options.shellCommand, error);
    }

    throw error;
  } finally {
    if (state.activeShellCommandSubprocess === subprocess) {
      state.activeShellCommandSubprocess = undefined;
    }
  }
}

export function createShellCommandRunner(): ShellCommandRunner {
  const state: ShellCommandRunnerState = {
    activeShellCommandSubprocess: undefined,
    userCanceledSubprocesses: new WeakSet<ShellCommandSubprocess>(),
  };

  return {
    cancelActiveShellCommand(): boolean {
      return cancelActiveShellCommandForState(state);
    },

    async runShellCommand(options: RunCommandOptions): Promise<void> {
      await executeShellCommand(state, options);
    },

    async runShellCommandAndCaptureOutput(options: RunCommandOptions): Promise<string> {
      const result = await executeShellCommand(state, options, "enabled");
      return result.capturedOutput ?? "";
    },
  };
}

const defaultShellCommandRunner = createShellCommandRunner();

export function cancelActiveShellCommand(): boolean {
  return defaultShellCommandRunner.cancelActiveShellCommand();
}

export async function runShellCommand(
  options: RunCommandOptions
): Promise<void> {
  await defaultShellCommandRunner.runShellCommand(options);
}

export async function runShellCommandAndCaptureOutput(
  options: RunCommandOptions,
): Promise<string> {
  return defaultShellCommandRunner.runShellCommandAndCaptureOutput(options);
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
