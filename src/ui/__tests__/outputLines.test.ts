import { describe, it, expect } from "vitest";
import { buildStepOutputLines, type TerminalDimensions } from "../outputLines.js";
import { stripAnsi } from "../../__tests__/helpers.js";
import type { CommandOutputLine } from "../../runner.js";

const DEFAULT_DIMENSIONS: TerminalDimensions = { columns: 80, rows: 40 };

function makeLine(text: string, source: "stdout" | "stderr" = "stdout"): CommandOutputLine {
  return { text, source };
}

describe("buildStepOutputLines", () => {
  it("renders a single line inline below the step header", () => {
    const lines = buildStepOutputLines([makeLine("hello")], DEFAULT_DIMENSIONS);
    expect(lines.map(stripAnsi)).toEqual([
      "  hello",
    ]);
  });

  it("renders internal blank lines from multi-line output", () => {
    const lines = buildStepOutputLines([makeLine("hello\n\nworld")], DEFAULT_DIMENSIONS);
    expect(lines.map(stripAnsi)).toEqual([
      "  hello",
      "  ",
      "  world",
    ]);
  });

  it("returns an empty array when there are no lines to render", () => {
    const lines = buildStepOutputLines([], DEFAULT_DIMENSIONS);
    expect(lines).toEqual([]);
  });

  it("truncates content lines to fit the available width", () => {
    const longText = "x".repeat(200);
    const lines = buildStepOutputLines([makeLine(longText)], { columns: 60, rows: 40 });
    const stripped = lines.map(stripAnsi);
    expect(stripped[0]).toBe("  " + "x".repeat(58));
  });

  it("limits visible lines to the terminal capacity", () => {
    const manyLines = Array.from({ length: 100 }, (_, index) =>
      makeLine(`line ${index}`)
    );
    const lines = buildStepOutputLines(manyLines, { columns: 80, rows: 30 });
    expect(lines.length).toBe(12);
  });

  it("respects minimum visible lines even with very small terminal", () => {
    const manyLines = Array.from({ length: 20 }, (_, index) =>
      makeLine(`line ${index}`)
    );
    const lines = buildStepOutputLines(manyLines, { columns: 80, rows: 5 });
    expect(lines.length).toBe(5);
  });

  it("shows the most recent lines when content exceeds capacity", () => {
    const manyLines = Array.from({ length: 100 }, (_, index) =>
      makeLine(`line-${index}`)
    );
    const lines = buildStepOutputLines(manyLines, { columns: 80, rows: 30 });
    expect(lines.map(stripAnsi)).toEqual([
      "  line-88",
      "  line-89",
      "  line-90",
      "  line-91",
      "  line-92",
      "  line-93",
      "  line-94",
      "  line-95",
      "  line-96",
      "  line-97",
      "  line-98",
      "  line-99",
    ]);
  });
});
