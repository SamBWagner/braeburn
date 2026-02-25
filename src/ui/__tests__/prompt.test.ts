import { describe, it, expect } from "vitest";
import { buildPromptLines } from "../prompt.js";
import { stripAnsi } from "../../__tests__/helpers.js";
import type { CurrentPrompt } from "../state.js";

describe("buildPromptLines", () => {
  it("renders a question with the Y/n/s/f hint", () => {
    const prompt: CurrentPrompt = { question: "Run Homebrew update?" };
    const lines = buildPromptLines(prompt);
    expect(lines.map(stripAnsi)).toEqual([
      "  ?  Run Homebrew update? [Y/n/s/f]",
    ]);
  });

  it("renders a warning line above the question when present", () => {
    const prompt: CurrentPrompt = {
      question: "Run pip update?",
      warning: "This may break things.",
    };
    const lines = buildPromptLines(prompt);
    expect(lines.map(stripAnsi)).toEqual([
      "  ⚠  This may break things.",
      "",
      "  ?  Run pip update? [Y/n/s/f]",
    ]);
  });

  it("produces one line when no warning is present", () => {
    const prompt: CurrentPrompt = { question: "Continue?" };
    const lines = buildPromptLines(prompt);
    expect(lines.map(stripAnsi)).toEqual([
      "  ?  Continue? [Y/n/s/f]",
    ]);
  });
});
