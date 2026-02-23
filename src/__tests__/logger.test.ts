import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createLogWriterForStep,
  findLatestLogFileForStep,
  listAllStepIdsWithLogs,
} from "../logger.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "braeburn-test-logs-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("createLogWriterForStep", () => {
  it("creates a log file in the specified directory", async () => {
    const writer = await createLogWriterForStep("homebrew", tempDir);
    await writer("first line");

    const stepIds = listAllStepIdsWithLogs(tempDir);
    expect(stepIds).toEqual(["homebrew"]);
  });

  it("appends lines to the log file", async () => {
    const writer = await createLogWriterForStep("npm", tempDir);
    await writer("line 1");
    await writer("line 2");
    await writer("line 3");

    const logPath = findLatestLogFileForStep("npm", tempDir);
    expect(logPath).not.toBeNull();
    const content = await readFile(logPath!, "utf-8");
    expect(content).toBe("line 1\nline 2\nline 3\n");
  });

  it("includes the step id in the filename and uses .log extension", async () => {
    const writer = await createLogWriterForStep("pip", tempDir);
    await writer("test line");
    const logPath = findLatestLogFileForStep("pip", tempDir);
    expect(logPath).not.toBeNull();

    const parts = logPath!.split("/");
    const filename = parts[parts.length - 1];
    expect(filename.startsWith("pip-")).toBe(true);
    expect(filename.endsWith(".log")).toBe(true);
  });

  it("creates the directory if it does not exist", async () => {
    const nestedDir = join(tempDir, "nested", "logs");
    const writer = await createLogWriterForStep("npm", nestedDir);
    await writer("nested content");

    const logPath = findLatestLogFileForStep("npm", nestedDir);
    expect(logPath).not.toBeNull();
    const content = await readFile(logPath!, "utf-8");
    expect(content).toBe("nested content\n");
  });
});

describe("findLatestLogFileForStep", () => {
  it("returns null when no logs exist for the step", () => {
    const result = findLatestLogFileForStep("nonexistent", tempDir);
    expect(result).toBeNull();
  });

  it("returns null when the directory does not exist", () => {
    const result = findLatestLogFileForStep("homebrew", "/nonexistent/path/xyz");
    expect(result).toBeNull();
  });

  it("finds the most recent log file", async () => {
    const writer1 = await createLogWriterForStep("homebrew", tempDir);
    await writer1("first run");

    await new Promise((resolve) => setTimeout(resolve, 10));

    const writer2 = await createLogWriterForStep("homebrew", tempDir);
    await writer2("second run");

    const logPath = findLatestLogFileForStep("homebrew", tempDir);
    expect(logPath).not.toBeNull();
    const content = await readFile(logPath!, "utf-8");
    expect(content).toBe("second run\n");
  });

  it("ignores log files for other steps", async () => {
    const npmWriter = await createLogWriterForStep("npm", tempDir);
    await npmWriter("npm logs");

    const result = findLatestLogFileForStep("homebrew", tempDir);
    expect(result).toBeNull();
  });
});

describe("listAllStepIdsWithLogs", () => {
  it("returns an empty array when no logs exist", () => {
    const result = listAllStepIdsWithLogs(tempDir);
    expect(result).toEqual([]);
  });

  it("returns an empty array when directory does not exist", () => {
    const result = listAllStepIdsWithLogs("/nonexistent/path/xyz");
    expect(result).toEqual([]);
  });

  it("lists unique step IDs with logs", async () => {
    const brewWriter = await createLogWriterForStep("homebrew", tempDir);
    await brewWriter("brew log");

    const npmWriter = await createLogWriterForStep("npm", tempDir);
    await npmWriter("npm log");

    const result = listAllStepIdsWithLogs(tempDir);
    expect(result).toEqual(["homebrew", "npm"]);
  });

  it("returns sorted step IDs", async () => {
    const pipWriter = await createLogWriterForStep("pip", tempDir);
    await pipWriter("pip log");

    const brewWriter = await createLogWriterForStep("homebrew", tempDir);
    await brewWriter("brew log");

    const result = listAllStepIdsWithLogs(tempDir);
    expect(result).toEqual(["homebrew", "pip"]);
  });

  it("deduplicates step IDs with multiple log files", async () => {
    const writer1 = await createLogWriterForStep("homebrew", tempDir);
    await writer1("first");

    await new Promise((resolve) => setTimeout(resolve, 10));

    const writer2 = await createLogWriterForStep("homebrew", tempDir);
    await writer2("second");

    const result = listAllStepIdsWithLogs(tempDir);
    expect(result).toEqual(["homebrew"]);
  });
});
