import { describe, it, expect } from "vitest";
import {
  buildLoadingScreen,
  buildSetupScreen,
  type SetupStepView,
  type SelectableStep,
} from "../setup.js";
import { stripAnsi } from "../../__tests__/helpers.js";

function makeStep(overrides: Partial<SetupStepView> = {}): SetupStepView {
  return {
    id: "test-step",
    name: "Test Step",
    description: "A test step",
    categoryId: "cli-tools",
    ...overrides,
  };
}

function makeSelectableStep(overrides: Partial<SelectableStep> = {}): SelectableStep {
  return {
    step: makeStep(),
    selection: "selected",
    protection: "configurable",
    availability: "available",
    ...overrides,
  };
}

const LOGO_PLAIN = [
  "                ;",
  "               :x :           ",
  "              .x$+x           ",
  "    x+x;      XXX&            ",
  "     :xx&&&   &&&             ",
  "        +X +X x+  .:::        ",
  "              ; X$$; :X$:     ",
  "           $+ ;+              ",
  "        .x:   : .             ",
  "      ::      ;+X             ",
  "               +$             ",
  "                :",
].join("\n");

const SETUP_HEADER = [
  LOGO_PLAIN,
  "",
  "  Welcome to braeburn!",
  "",
  "  Select the update tools you\u2019d like to enable. For anything that isn\u2019t",
  "  installed yet, braeburn will offer to set it up via Homebrew when you run it.",
  "",
  "  \u2191\u2193  navigate    Space  toggle    Return  confirm",
  "",
].join("\n");

const CLI_TOOLS_SECTION_DIVIDER = "  ── System / CLI Tools ──────────────────────────────────────────";

describe("buildLoadingScreen", () => {
  it("returns the logo, welcome message, and loading indicator", () => {
    const expected = [
      LOGO_PLAIN,
      "",
      "  Welcome to braeburn!",
      "",
      "  Checking which tools are installed\u2026",
      "",
      "",
    ].join("\n");

    expect(stripAnsi(buildLoadingScreen())).toBe(expected);
  });
});

describe("buildSetupScreen", () => {
  it("renders a single selected available step with cursor", () => {
    const items = [makeSelectableStep()];

    const expected = [
      SETUP_HEADER,
      CLI_TOOLS_SECTION_DIVIDER,
      "  \u203a \u25cf  Test Step           installed",
      "           A test step",
      "",
      "  1 of 1 tools selected",
      "",
      "",
    ].join("\n");

    expect(stripAnsi(buildSetupScreen(items, 0))).toBe(expected);
  });

  it("renders two items with cursor on the first", () => {
    const items = [
      makeSelectableStep({ step: makeStep({ id: "homebrew-step", name: "Homebrew", description: "Update Homebrew packages" }) }),
      makeSelectableStep({ step: makeStep({ id: "npm-step", name: "npm", description: "Update npm packages" }) }),
    ];

    const expected = [
      SETUP_HEADER,
      CLI_TOOLS_SECTION_DIVIDER,
      "  \u203a \u25cf  Homebrew            installed",
      "           Update Homebrew packages",
      "    \u25cf  npm                 installed",
      "",
      "  2 of 2 tools selected",
      "",
      "",
    ].join("\n");

    expect(stripAnsi(buildSetupScreen(items, 0))).toBe(expected);
  });

  it("shows description only for the cursor item, not for other items", () => {
    const items = [
      makeSelectableStep({
        step: makeStep({ id: "first-step", name: "A", description: "First description" }),
      }),
      makeSelectableStep({
        step: makeStep({ id: "second-step", name: "B", description: "Second description" }),
      }),
    ];

    const expected = [
      SETUP_HEADER,
      CLI_TOOLS_SECTION_DIVIDER,
      "  \u203a \u25cf  A                   installed",
      "           First description",
      "    \u25cf  B                   installed",
      "",
      "  2 of 2 tools selected",
      "",
      "",
    ].join("\n");

    const result = stripAnsi(buildSetupScreen(items, 0));
    expect(result).toBe(expected);
  });

  it("shows 'required' for protected steps", () => {
    const items = [makeSelectableStep({ protection: "protected" })];

    const expected = [
      SETUP_HEADER,
      CLI_TOOLS_SECTION_DIVIDER,
      "  \u203a \u25cf  Test Step           required",
      "           A test step",
      "",
      "  1 of 1 tools selected",
      "",
      "",
    ].join("\n");

    expect(stripAnsi(buildSetupScreen(items, 0))).toBe(expected);
  });

  it("shows 'not installed' for unavailable steps", () => {
    const items = [makeSelectableStep({ availability: "unavailable" })];

    const expected = [
      SETUP_HEADER,
      CLI_TOOLS_SECTION_DIVIDER,
      "  \u203a \u25cf  Test Step           not installed",
      "           A test step",
      "",
      "  1 of 1 tools selected",
      "",
      "",
    ].join("\n");

    expect(stripAnsi(buildSetupScreen(items, 0))).toBe(expected);
  });

  it("shows Homebrew install offer for unavailable steps with brewPackageToInstall", () => {
    const items = [
      makeSelectableStep({
        availability: "unavailable",
        step: makeStep({ brewPackageToInstall: "mas" }),
      }),
    ];

    const expected = [
      SETUP_HEADER,
      CLI_TOOLS_SECTION_DIVIDER,
      "  \u203a \u25cf  Test Step           not installed  \u2192 will offer to install via Homebrew",
      "           A test step",
      "",
      "  1 of 1 tools selected",
      "",
      "",
    ].join("\n");

    expect(stripAnsi(buildSetupScreen(items, 0))).toBe(expected);
  });

  it("shows a deselected step with an open circle", () => {
    const items = [makeSelectableStep({ selection: "deselected" })];

    const expected = [
      SETUP_HEADER,
      CLI_TOOLS_SECTION_DIVIDER,
      "  \u203a \u25cb  Test Step           installed",
      "           A test step",
      "",
      "  0 of 1 tools selected",
      "",
      "",
    ].join("\n");

    expect(stripAnsi(buildSetupScreen(items, 0))).toBe(expected);
  });

  it("shows the correct enabled count with mixed selection", () => {
    const items = [
      makeSelectableStep({ step: makeStep({ id: "alpha-step", name: "StepA", description: "Desc A" }), selection: "selected" }),
      makeSelectableStep({ step: makeStep({ id: "beta-step", name: "StepB", description: "Desc B" }), selection: "deselected" }),
      makeSelectableStep({ step: makeStep({ id: "gamma-step", name: "StepC", description: "Desc C" }), selection: "selected" }),
    ];

    const expected = [
      SETUP_HEADER,
      CLI_TOOLS_SECTION_DIVIDER,
      "  \u203a \u25cf  StepA               installed",
      "           Desc A",
      "    \u25cb  StepB               installed",
      "    \u25cf  StepC               installed",
      "",
      "  2 of 3 tools selected",
      "",
      "",
    ].join("\n");

    expect(stripAnsi(buildSetupScreen(items, 0))).toBe(expected);
  });

  it("handles an empty items array", () => {
    const expected = [
      SETUP_HEADER,
      "",
      "  0 of 0 tools selected",
      "",
      "",
    ].join("\n");

    expect(stripAnsi(buildSetupScreen([], 0))).toBe(expected);
  });
});
