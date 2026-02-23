import { describe, it, expect } from "vitest";
import { buildScreen } from "../screen.js";
import { createInitialAppState } from "../state.js";
import { stripAnsi } from "../../__tests__/helpers.js";
import type { AppState } from "../state.js";
import type { Step } from "../../steps/index.js";

function makeStep(overrides: Partial<Step> = {}): Step {
  return {
    id: "test",
    name: "Test",
    description: "A test step",
    stage: "tools",
    checkIsAvailable: async () => true,
    run: async () => {},
    ...overrides,
  };
}

function makeState(overrides: Partial<AppState> = {}): AppState {
  const steps = overrides.steps ?? [makeStep()];
  const base = createInitialAppState(
    steps,
    overrides.version ?? "1.0.0",
    overrides.logoVisibility ?? "hidden",
  );
  return { ...base, ...overrides, steps };
}

const DIMENSIONS = { columns: 80, rows: 40 };

describe("buildScreen", () => {
  it("renders the header and active step for a single-step pending state", () => {
    const screen = buildScreen(makeState(), DIMENSIONS);
    expect(stripAnsi(screen)).toBe(
      "braeburn v1.0.0\n" +
      "macOS system updater\n" +
      "\n" +
      "→ Test\n" +
      "\n" +
      "\n" +
      "  ─── Step 1/1  Test  ────────────────────\n" +
      "  · A test step\n" +
      "\n"
    );
  });

  it("renders multiple step names in the header tracker", () => {
    const state = makeState({
      steps: [makeStep({ name: "Homebrew" }), makeStep({ name: "npm" })],
    });
    const screen = buildScreen(state, DIMENSIONS);
    expect(stripAnsi(screen)).toBe(
      "braeburn v1.0.0\n" +
      "macOS system updater\n" +
      "\n" +
      "→ Homebrew\n" +
      "· npm\n" +
      "\n" +
      "\n" +
      "  ─── Step 1/2  Homebrew  ────────────────────\n" +
      "  · A test step\n" +
      "\n"
    );
  });

  it("shows the running indicator when phase is running", () => {
    const state = makeState({
      currentPhase: "running",
      runCompletion: "in-progress",
    });
    const screen = buildScreen(state, DIMENSIONS);
    expect(stripAnsi(screen)).toBe(
      "braeburn v1.0.0\n" +
      "macOS system updater\n" +
      "\n" +
      "→ Test\n" +
      "\n" +
      "\n" +
      "  ─── Step 1/1  Test  ────────────────────\n" +
      "  · A test step\n" +
      "  ▶ Running...\n" +
      "\n"
    );
  });

  it("shows the output box when running with output lines", () => {
    const state = makeState({
      currentPhase: "running",
      runCompletion: "in-progress",
      currentOutputLines: [{ text: "updating packages...", source: "stdout" }],
    });
    const screen = buildScreen(state, DIMENSIONS);
    expect(stripAnsi(screen)).toBe(
      "braeburn v1.0.0\n" +
      "macOS system updater\n" +
      "\n" +
      "→ Test\n" +
      "\n" +
      "\n" +
      "  ─── Step 1/1  Test  ────────────────────\n" +
      "  · A test step\n" +
      "  ▶ Running...\n" +
      "\n" +
      "  ┌─ Test output ────────────────────────────────────────────────────────────┐\n" +
      "  │ updating packages...\n" +
      "  └──────────────────────────────────────────────────────────────────────────┘\n" +
      "\n"
    );
  });

  it("shows the prompt when a prompt is active", () => {
    const state = makeState({
      currentPhase: "prompting-to-run",
      runCompletion: "in-progress",
      currentPrompt: { question: "Run this update?" },
    });
    const screen = buildScreen(state, DIMENSIONS);
    expect(stripAnsi(screen)).toBe(
      "braeburn v1.0.0\n" +
      "macOS system updater\n" +
      "\n" +
      "→ Test\n" +
      "\n" +
      "\n" +
      "  ─── Step 1/1  Test  ────────────────────\n" +
      "  · A test step\n" +
      "\n" +
      "  ?  Run this update? [Y/n/f]\n" +
      "\n"
    );
  });

  it("shows version report and completion message when finished", () => {
    const state = makeState({
      runCompletion: "finished",
      versionReport: [
        { label: "Node", value: "v22.0.0" },
      ],
    });
    const screen = buildScreen(state, DIMENSIONS);
    expect(stripAnsi(screen)).toBe(
      "braeburn v1.0.0\n" +
      "macOS system updater\n" +
      "\n" +
      "→ Test\n" +
      "\n" +
      "\n" +
      "  ─── Versions ─────────────────────────\n" +
      "  · Node: v22.0.0\n" +
      "\n" +
      "  ✓ All done!\n" +
      "\n"
    );
  });

  it("renders only the header when finished without a version report", () => {
    const state = makeState({
      runCompletion: "finished",
      versionReport: undefined,
    });
    const screen = buildScreen(state, DIMENSIONS);
    expect(stripAnsi(screen)).toBe(
      "braeburn v1.0.0\n" +
      "macOS system updater\n" +
      "\n" +
      "→ Test\n" +
      "\n" +
      "\n"
    );
  });

  it("ends with a newline", () => {
    const screen = buildScreen(makeState(), DIMENSIONS);
    expect(screen.endsWith("\n")).toBe(true);
  });
});
