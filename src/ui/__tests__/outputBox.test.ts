import { describe, it, expect } from "vitest";
import { buildOutputBoxLines, type TerminalDimensions } from "../outputBox.js";
import { stripAnsi } from "../../__tests__/helpers.js";
import type { CommandOutputLine } from "../../runner.js";

const DEFAULT_DIMENSIONS: TerminalDimensions = { columns: 80, rows: 40 };

function makeLine(text: string, source: "stdout" | "stderr" = "stdout"): CommandOutputLine {
  return { text, source };
}

describe("buildOutputBoxLines", () => {
  it("renders a single line inside a bordered box", () => {
    const lines = buildOutputBoxLines(
      [makeLine("hello")],
      "Test",
      DEFAULT_DIMENSIONS,
    );
    expect(lines.map(stripAnsi)).toEqual([
      "  ┌─ Test output ────────────────────────────────────────────────────────────┐",
      "  │ hello",
      "  └──────────────────────────────────────────────────────────────────────────┘",
    ]);
  });

  it("includes the step name in the header border", () => {
    const lines = buildOutputBoxLines(
      [makeLine("hello")],
      "Homebrew",
      DEFAULT_DIMENSIONS,
    );
    expect(lines.map(stripAnsi)).toEqual([
      "  ┌─ Homebrew output ────────────────────────────────────────────────────────┐",
      "  │ hello",
      "  └──────────────────────────────────────────────────────────────────────────┘",
    ]);
  });

  it("renders just borders for an empty lines array", () => {
    const lines = buildOutputBoxLines([], "Test", DEFAULT_DIMENSIONS);
    expect(lines.map(stripAnsi)).toEqual([
      "  ┌─ Test output ────────────────────────────────────────────────────────────┐",
      "  └──────────────────────────────────────────────────────────────────────────┘",
    ]);
  });

  it("truncates content lines to fit the box width", () => {
    const longText = "x".repeat(200);
    const lines = buildOutputBoxLines(
      [makeLine(longText)],
      "Test",
      { columns: 60, rows: 40 },
    );
    const stripped = lines.map(stripAnsi);
    expect(stripped[1]).toBe("  │ " + "x".repeat(52));
  });

  it("limits visible lines to the terminal capacity", () => {
    const manyLines = Array.from({ length: 100 }, (_, i) =>
      makeLine(`line ${i}`)
    );
    const lines = buildOutputBoxLines(
      manyLines,
      "Test",
      { columns: 80, rows: 30 },
    );
    expect(lines.length).toBe(11);
  });

  it("respects minimum visible lines even with very small terminal", () => {
    const manyLines = Array.from({ length: 20 }, (_, i) =>
      makeLine(`line ${i}`)
    );
    const lines = buildOutputBoxLines(
      manyLines,
      "Test",
      { columns: 80, rows: 5 },
    );
    expect(lines.length).toBe(7);
  });

  it("shows the most recent lines when content exceeds capacity", () => {
    const manyLines = Array.from({ length: 100 }, (_, i) =>
      makeLine(`line-${i}`)
    );
    const lines = buildOutputBoxLines(
      manyLines,
      "Test",
      { columns: 80, rows: 30 },
    );
    expect(lines.map(stripAnsi)).toEqual([
      "  ┌─ Test output ────────────────────────────────────────────────────────────┐",
      "  │ line-91",
      "  │ line-92",
      "  │ line-93",
      "  │ line-94",
      "  │ line-95",
      "  │ line-96",
      "  │ line-97",
      "  │ line-98",
      "  │ line-99",
      "  └──────────────────────────────────────────────────────────────────────────┘",
    ]);
  });
});
