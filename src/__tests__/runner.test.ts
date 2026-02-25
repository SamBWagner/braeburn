import { describe, it, expect } from "vitest";
import {
  doesShellCommandSucceed,
  captureShellCommandOutput,
  runShellCommand,
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
});
