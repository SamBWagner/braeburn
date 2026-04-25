import { describe, it, expect } from "vitest";
import {
  doesShellCommandSucceed,
  captureShellCommandOutput,
  runShellCommand,
  runShellCommandAndCaptureOutput,
  cancelActiveShellCommand,
  createShellCommandRunner,
  ShellCommandCanceledError,
  type CommandOutputLine,
} from "../runner.js";

describe("doesShellCommandSucceed", () => {
  it("returns true for a command that exits 0", async () => {
    const result = await doesShellCommandSucceed({ shellCommand: "true" });
    expect(result).toBe(true);
  });

  it("returns false for a command that exits non-zero", async () => {
    const result = await doesShellCommandSucceed({ shellCommand: "false" });
    expect(result).toBe(false);
  });

  it("returns true for echo", async () => {
    const result = await doesShellCommandSucceed({ shellCommand: "echo hello" });
    expect(result).toBe(true);
  });

  it("returns false for a nonexistent command", async () => {
    const result = await doesShellCommandSucceed({
      shellCommand: "nonexistent_cmd_xyz_99999",
    });
    expect(result).toBe(false);
  });
});

describe("captureShellCommandOutput", () => {
  it("captures stdout and trims whitespace", async () => {
    const result = await captureShellCommandOutput({ shellCommand: "echo hello" });
    expect(result).toBe("hello");
  });

  it("captures multiline output", async () => {
    const result = await captureShellCommandOutput({
      shellCommand: "printf 'line1\\nline2'",
    });
    expect(result).toBe("line1\nline2");
  });

  it("returns empty string for a failing command", async () => {
    const result = await captureShellCommandOutput({ shellCommand: "false" });
    expect(result).toBe("");
  });

  it("returns trimmed output (no leading/trailing whitespace)", async () => {
    const result = await captureShellCommandOutput({
      shellCommand: "echo '  spaced  '",
    });
    expect(result).toBe("spaced");
  });
});

describe("runShellCommand", () => {
  it("returns false when no command is active to cancel", () => {
    expect(cancelActiveShellCommand()).toBe(false);
  });

  it("calls onOutputLine with stdout data", async () => {
    const lines: CommandOutputLine[] = [];
    const logLines: string[] = [];

    await runShellCommand({
      shellCommand: "echo hello",
      onOutputLine: (line) => lines.push(line),
      logWriter: async (line) => { logLines.push(line); },
    });

    expect(lines).toContainEqual({ text: "hello", source: "stdout" });
  });

  it("calls logWriter with output lines", async () => {
    const logLines: string[] = [];

    await runShellCommand({
      shellCommand: "echo logged",
      onOutputLine: () => {},
      logWriter: async (line) => { logLines.push(line); },
    });

    expect(logLines).toEqual(["logged"]);
  });

  it("awaits async log writes in output order before resolving", async () => {
    const logLines: string[] = [];

    await runShellCommand({
      shellCommand: "printf 'first\\nsecond\\n'",
      onOutputLine: () => {},
      logWriter: async (line) => {
        const delayMs = line === "first" ? 30 : 0;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        logLines.push(line);
      },
    });

    expect(logLines).toEqual(["first", "second"]);
  });

  it("calls onOutputLine with stderr data", async () => {
    const lines: CommandOutputLine[] = [];

    await runShellCommand({
      shellCommand: "echo error >&2",
      onOutputLine: (line) => lines.push(line),
      logWriter: async () => {},
    });

    expect(lines).toContainEqual({ text: "error", source: "stderr" });
  });

  it("throws for a command that exits non-zero", async () => {
    const logLines: string[] = [];

    await expect(
      runShellCommand({
        shellCommand: "exit 1",
        onOutputLine: () => {},
        logWriter: async (line) => { logLines.push(line); },
      })
    ).rejects.toThrow();

    expect(logLines).toContain("[braeburn] Command failed: exit 1");
    expect(logLines).toContain("[braeburn] Exit code: 1");
  });

  it("handles a command with both stdout and stderr", async () => {
    const lines: CommandOutputLine[] = [];

    await runShellCommand({
      shellCommand: "echo out && echo err >&2",
      onOutputLine: (line) => lines.push(line),
      logWriter: async () => {},
    });

    expect(lines).toContainEqual({ text: "out", source: "stdout" });
    expect(lines).toContainEqual({ text: "err", source: "stderr" });
  });

  it("chunks very long unterminated output lines while streaming", async () => {
    const lines: CommandOutputLine[] = [];

    await runShellCommand({
      shellCommand: "node -e \"process.stdout.write('a'.repeat(20000))\"",
      onOutputLine: (line) => lines.push(line),
      logWriter: async () => {},
    });

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.map((line) => line.text).join("")).toHaveLength(20000);
  });

  it("writes stderr and stdout tails to the log on failures", async () => {
    const logLines: string[] = [];

    await expect(
      runShellCommand({
        shellCommand: "echo out-before-fail && echo err-before-fail >&2 && exit 7",
        onOutputLine: () => {},
        logWriter: async (line) => { logLines.push(line); },
      })
    ).rejects.toThrow();

    expect(logLines).toContain("[braeburn] Command failed: echo out-before-fail && echo err-before-fail >&2 && exit 7");
    expect(logLines).toContain("[braeburn] Exit code: 7");
    expect(logLines).toContain("[braeburn] stderr tail (1):");
    expect(logLines).toContain("  err-before-fail");
    expect(logLines).toContain("[braeburn] stdout tail (1):");
    expect(logLines).toContain("  out-before-fail");
  });

  it("limits failure summary output tails", async () => {
    const logLines: string[] = [];

    await expect(
      runShellCommand({
        shellCommand: "for lineNumber in {1..25}; do echo \"line-$lineNumber\"; done; exit 9",
        onOutputLine: () => {},
        logWriter: async (line) => { logLines.push(line); },
      })
    ).rejects.toThrow();

    const stdoutTailHeaderIndex = logLines.indexOf("[braeburn] stdout tail (20):");
    expect(stdoutTailHeaderIndex).toBeGreaterThan(-1);

    const summarizedTailLines = logLines.slice(stdoutTailHeaderIndex + 1);
    expect(summarizedTailLines).not.toContain("  line-1");
    expect(summarizedTailLines).toContain("  line-6");
    expect(summarizedTailLines).toContain("  line-25");
  });

  it("cancels the active command when requested", async () => {
    const logLines: string[] = [];
    const cancelTimer = setTimeout(() => {
      cancelActiveShellCommand();
    }, 50);

    try {
      await expect(
        runShellCommand({
          shellCommand: "sleep 5",
          onOutputLine: () => {},
          logWriter: async (line) => {
            logLines.push(line);
          },
        })
      ).rejects.toBeInstanceOf(ShellCommandCanceledError);
    } finally {
      clearTimeout(cancelTimer);
    }

    expect(logLines).toContain("[braeburn] Command canceled by user input (q).");
  });

  it("keeps cancellation isolated between runner instances", async () => {
    const runner = createShellCommandRunner();
    const cancelTimer = setTimeout(() => {
      expect(cancelActiveShellCommand()).toBe(false);
      runner.cancelActiveShellCommand();
    }, 50);

    try {
      await expect(
        runner.runShellCommand({
          shellCommand: "sleep 5",
          onOutputLine: () => {},
          logWriter: async () => {},
        })
      ).rejects.toBeInstanceOf(ShellCommandCanceledError);
    } finally {
      clearTimeout(cancelTimer);
    }
  });
});

describe("runShellCommandAndCaptureOutput", () => {
  it("returns captured stdout while streaming lines", async () => {
    const lines: CommandOutputLine[] = [];

    const capturedOutput = await runShellCommandAndCaptureOutput({
      shellCommand: "printf 'hello\\nworld\\n'",
      onOutputLine: (line) => lines.push(line),
      logWriter: async () => {},
    });

    expect(capturedOutput).toBe("hello\nworld");
    expect(lines).toEqual([
      { text: "hello", source: "stdout" },
      { text: "world", source: "stdout" },
    ]);
  });

  it("captures a final line even when the command does not end with a newline", async () => {
    const capturedOutput = await runShellCommandAndCaptureOutput({
      shellCommand: "printf 'final-line'",
      onOutputLine: () => {},
      logWriter: async () => {},
    });

    expect(capturedOutput).toBe("final-line");
  });
});
