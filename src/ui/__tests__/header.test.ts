import { describe, it, expect } from "vitest";
import {
  buildHeaderLines,
  stepTrackerIcon,
  isActivePhase,
  deriveAllStepPhases,
  determineLogoLayout,
} from "../header.js";
import { stripAnsi } from "../../__tests__/helpers.js";
import type { DisplayStep, StepPhase, CompletedStepRecord } from "../state.js";

function makeStep(overrides: Partial<DisplayStep> = {}): DisplayStep {
  return {
    id: "test",
    name: "Test",
    description: "A test step",
    categoryId: "cli-tools",
    ...overrides,
  };
}

describe("stepTrackerIcon", () => {
  it("returns a green check for complete", () => {
    expect(stripAnsi(stepTrackerIcon("complete"))).toBe("✓ ");
  });

  it("returns a red X for failed", () => {
    expect(stripAnsi(stepTrackerIcon("failed"))).toBe("✗ ");
  });

  it("returns a dash for skipped", () => {
    expect(stripAnsi(stepTrackerIcon("skipped"))).toBe("– ");
  });

  it("returns a dash for not-available", () => {
    expect(stripAnsi(stepTrackerIcon("not-available"))).toBe("– ");
  });

  it("returns an animated indicator for running", () => {
    expect(stripAnsi(stepTrackerIcon("running"))).toBe("◐ ");
  });

  it("returns an animated indicator for installing", () => {
    expect(stripAnsi(stepTrackerIcon("installing"))).toBe("◐ ");
  });

  it("advances running indicator frames", () => {
    expect(stripAnsi(stepTrackerIcon("running", 1))).toBe("◓ ");
  });

  it("returns an arrow for checking-availability", () => {
    expect(stripAnsi(stepTrackerIcon("checking-availability"))).toBe("→ ");
  });

  it("returns an arrow for prompting-to-run", () => {
    expect(stripAnsi(stepTrackerIcon("prompting-to-run"))).toBe("→ ");
  });

  it("returns an arrow for prompting-to-install", () => {
    expect(stripAnsi(stepTrackerIcon("prompting-to-install"))).toBe("→ ");
  });

  it("returns a dot for pending", () => {
    expect(stripAnsi(stepTrackerIcon("pending"))).toBe("· ");
  });
});

describe("isActivePhase", () => {
  it("returns true for running", () => {
    expect(isActivePhase("running")).toBe(true);
  });

  it("returns true for installing", () => {
    expect(isActivePhase("installing")).toBe(true);
  });

  it("returns true for prompting-to-run", () => {
    expect(isActivePhase("prompting-to-run")).toBe(true);
  });

  it("returns true for prompting-to-install", () => {
    expect(isActivePhase("prompting-to-install")).toBe(true);
  });

  it("returns true for checking-availability", () => {
    expect(isActivePhase("checking-availability")).toBe(true);
  });

  it("returns false for pending", () => {
    expect(isActivePhase("pending")).toBe(false);
  });

  it("returns false for complete", () => {
    expect(isActivePhase("complete")).toBe(false);
  });

  it("returns false for failed", () => {
    expect(isActivePhase("failed")).toBe(false);
  });

  it("returns false for skipped", () => {
    expect(isActivePhase("skipped")).toBe(false);
  });

  it("returns false for not-available", () => {
    expect(isActivePhase("not-available")).toBe(false);
  });
});

describe("deriveAllStepPhases", () => {
  const steps = [
    makeStep({ id: "first-step" }),
    makeStep({ id: "second-step" }),
    makeStep({ id: "third-step" }),
  ];

  it("assigns completed phases from records", () => {
    const completed: CompletedStepRecord[] = [
      { phase: "complete" },
      { phase: "failed" },
    ];
    const phases = deriveAllStepPhases(steps, 2, "running", completed);
    expect(phases).toEqual(["complete", "failed", "running"]);
  });

  it("assigns the current phase to the current step", () => {
    const completed: CompletedStepRecord[] = [{ phase: "complete" }];
    const phases = deriveAllStepPhases(steps, 1, "running", completed);
    expect(phases).toEqual(["complete", "running", "pending"]);
  });

  it("assigns pending to future steps", () => {
    const completed: CompletedStepRecord[] = [];
    const phases = deriveAllStepPhases(steps, 0, "running", completed);
    expect(phases).toEqual(["running", "pending", "pending"]);
  });

  it("handles all steps completed", () => {
    const completed: CompletedStepRecord[] = [
      { phase: "complete" },
      { phase: "skipped" },
      { phase: "failed" },
    ];
    const phases = deriveAllStepPhases(steps, 3, "pending", completed);
    expect(phases).toEqual(["complete", "skipped", "failed"]);
  });

  it("handles no steps completed", () => {
    const phases = deriveAllStepPhases(steps, 0, "checking-availability", []);
    expect(phases).toEqual(["checking-availability", "pending", "pending"]);
  });
});

describe("determineLogoLayout", () => {
  const logoLines = Array.from({ length: 10 }, () => "x".repeat(20));

  it("returns side-by-side for wide terminals", () => {
    const layout = determineLogoLayout(logoLines, { columns: 120, rows: 40 });
    expect(layout).toBe("side-by-side");
  });

  it("returns stacked for narrow but tall terminals", () => {
    const layout = determineLogoLayout(logoLines, { columns: 40, rows: 40 });
    expect(layout).toBe("stacked");
  });

  it("returns none for very small terminals", () => {
    const layout = determineLogoLayout(logoLines, { columns: 40, rows: 10 });
    expect(layout).toBe("none");
  });

  it("returns side-by-side at exactly the minimum width", () => {
    const layout = determineLogoLayout(logoLines, { columns: 56, rows: 40 });
    expect(layout).toBe("side-by-side");
  });

  it("returns stacked when columns are just below minimum but rows are sufficient", () => {
    const layout = determineLogoLayout(logoLines, { columns: 55, rows: 40 });
    expect(layout).toBe("stacked");
  });
});

describe("buildHeaderLines", () => {
  const steps = [
    makeStep({ id: "brew", name: "Homebrew" }),
    makeStep({ id: "npm", name: "npm" }),
  ];

  it("returns the right-column lines when logo is hidden", () => {
    const lines = buildHeaderLines({
      steps,
      version: "1.2.3",
      logoVisibility: "hidden",
      currentStepIndex: 0,
      currentPhase: "pending",
      completedStepRecords: [],
    });
    expect(lines.map(stripAnsi)).toEqual([
      "braeburn v1.2.3",
      "macOS system updater",
      "",
      "System / CLI Tools",
      "· Homebrew",
      "· npm",
    ]);
  });

  it("returns side-by-side layout with logo when visible and terminal is wide", () => {
    const lines = buildHeaderLines({
      steps,
      version: "1.0.0",
      logoVisibility: "visible",
      currentStepIndex: 0,
      currentPhase: "pending",
      completedStepRecords: [],
      terminalDimensions: { columns: 120, rows: 40 },
    });
    const stripped = lines.map(stripAnsi);
    expect(stripped.length).toBe(12);
    expect(stripped[0]).toBe("                ;                   braeburn v1.0.0");
    expect(stripped[1]).toBe("               :x :                 macOS system updater");
    expect(stripped[3]).toBe("    x+x;      XXX&                  System / CLI Tools");
    expect(stripped[4]).toBe("     :xx&&&   &&&                   · Homebrew");
    expect(stripped[5]).toBe("        +X +X x+  .:::              · npm");
  });

  it("returns fewer lines when logo is hidden than when visible", () => {
    const withLogo = buildHeaderLines({
      steps,
      version: "1.0.0",
      logoVisibility: "visible",
      currentStepIndex: 0,
      currentPhase: "pending",
      completedStepRecords: [],
      terminalDimensions: { columns: 120, rows: 40 },
    });
    const withoutLogo = buildHeaderLines({
      steps,
      version: "1.0.0",
      logoVisibility: "hidden",
      currentStepIndex: 0,
      currentPhase: "pending",
      completedStepRecords: [],
    });
    expect(withoutLogo.length).toBe(6);
    expect(withLogo.length).toBe(12);
  });

  it("inserts category labels when multiple categories are present", () => {
    const mixedSteps = [
      makeStep({ id: "nvm", name: "Node.js (nvm)", categoryId: "runtimes" }),
      makeStep({ id: "brew", name: "Homebrew", categoryId: "apps-packages" }),
      makeStep({ id: "npm", name: "npm", categoryId: "cli-tools" }),
    ];

    const lines = buildHeaderLines({
      steps: mixedSteps,
      version: "1.0.0",
      logoVisibility: "hidden",
      currentStepIndex: 0,
      currentPhase: "pending",
      completedStepRecords: [],
    });

    expect(lines.map(stripAnsi)).toEqual([
      "braeburn v1.0.0",
      "macOS system updater",
      "",
      "System / Runtimes",
      "· Node.js (nvm)",
      "System / Apps & Packages",
      "· Homebrew",
      "System / CLI Tools",
      "· npm",
    ]);
  });

  it("includes the category label when all steps are in one category", () => {
    const lines = buildHeaderLines({
      steps,
      version: "1.0.0",
      logoVisibility: "hidden",
      currentStepIndex: 0,
      currentPhase: "pending",
      completedStepRecords: [],
    });
    const stripped = lines.map(stripAnsi);
    expect(stripped).toContain("System / CLI Tools");
  });
});
