import { describe, expect, it, vi } from "vitest";
import {
  ConfigReadError,
  type BraeburnConfig,
} from "../config.js";
import {
  createBraeburnProgram,
  reportCliError,
  resolveStepsByIds,
} from "../cli.js";
import type { Step } from "../steps/index.js";

function makeStep(overrides: Partial<Step> = {}): Step {
  return {
    id: "homebrew",
    name: "Homebrew",
    description: "Update Homebrew",
    categoryId: "apps-packages",
    checkIsAvailable: async () => true,
    run: async () => {},
    ...overrides,
  };
}

function makeProcessLike() {
  const stderrLines: string[] = [];
  return {
    processLike: {
      stderr: {
        write: (chunk: string | Uint8Array) => {
          stderrLines.push(String(chunk));
          return true;
        },
      },
      exitCode: 0,
    },
    stderrLines,
  };
}

function makeDependencies(config: BraeburnConfig = { steps: {} }) {
  return {
    applyUpdateCommandResult: vi.fn(),
    configFileExists: vi.fn(async () => true),
    readConfig: vi.fn(async () => config),
    runConfigCommand: vi.fn(async () => {}),
    runConfigUpdateCommand: vi.fn(async () => {}),
    runLogCommand: vi.fn(async () => {}),
    runLogListCommand: vi.fn(),
    runSetupCommand: vi.fn(async () => {}),
    runUpdateCommand: vi.fn(async () => ({ failedStepCount: 0 })),
  };
}

describe("resolveStepsByIds", () => {
  it("resolves known step IDs in the requested order", () => {
    const homebrewStep = makeStep({ id: "homebrew" });
    const npmStep = makeStep({ id: "npm", name: "npm" });

    const result = resolveStepsByIds(["npm", "homebrew"], [homebrewStep, npmStep]);

    expect(result).toEqual({ status: "resolved", steps: [npmStep, homebrewStep] });
  });

  it("returns the unknown step id instead of exiting", () => {
    const result = resolveStepsByIds(["missing"], [makeStep()]);

    expect(result).toEqual({ status: "unknown-step", stepId: "missing" });
  });
});

describe("createBraeburnProgram", () => {
  it("runs only enabled configured steps for the default update command", async () => {
    const homebrewStep = makeStep({ id: "homebrew" });
    const npmStep = makeStep({ id: "npm", name: "npm" });
    const dependencies = makeDependencies({ steps: { npm: false } });
    const { processLike } = makeProcessLike();
    const program = createBraeburnProgram({
      allSteps: [homebrewStep, npmStep],
      dependencies,
      processLike,
      version: "9.9.9",
    });

    await program.parseAsync(["-y"], { from: "user" });

    expect(dependencies.runSetupCommand).not.toHaveBeenCalled();
    expect(dependencies.runUpdateCommand).toHaveBeenCalledWith({
      steps: [homebrewStep],
      promptMode: "auto-accept",
      logoVisibility: "visible",
      version: "9.9.9",
    });
  });

  it("reports unknown update steps without running updates", async () => {
    const dependencies = makeDependencies();
    const { processLike, stderrLines } = makeProcessLike();
    const program = createBraeburnProgram({
      allSteps: [makeStep()],
      dependencies,
      processLike,
      version: "9.9.9",
    });

    await program.parseAsync(["missing", "-y"], { from: "user" });

    expect(dependencies.runUpdateCommand).not.toHaveBeenCalled();
    expect(processLike.exitCode).toBe(1);
    expect(stderrLines.join("")).toContain('Unknown step: "missing"');
  });

  it("runs explicit step arguments through the default update command", async () => {
    const homebrewStep = makeStep({ id: "homebrew" });
    const npmStep = makeStep({ id: "npm", name: "npm" });
    const dependencies = makeDependencies({ steps: { npm: false } });
    const { processLike } = makeProcessLike();
    const program = createBraeburnProgram({
      allSteps: [homebrewStep, npmStep],
      dependencies,
      processLike,
      version: "9.9.9",
    });

    await program.parseAsync(["npm", "-y"], { from: "user" });

    expect(dependencies.runUpdateCommand).toHaveBeenCalledWith({
      steps: [npmStep],
      promptMode: "auto-accept",
      logoVisibility: "visible",
      version: "9.9.9",
    });
  });

  it("supports the documented log --brew alias", async () => {
    const dependencies = makeDependencies();
    const { processLike } = makeProcessLike();
    const program = createBraeburnProgram({
      allSteps: [makeStep()],
      dependencies,
      processLike,
      version: "9.9.9",
    });

    await program.parseAsync(["log", "--brew"], { from: "user" });

    expect(dependencies.runLogCommand).toHaveBeenCalledWith({ stepId: "homebrew" });
  });
});

describe("reportCliError", () => {
  it("prints config read errors without a stack trace", () => {
    const { processLike, stderrLines } = makeProcessLike();
    const error = new ConfigReadError("/tmp/braeburn-config", new Error("bad TOML"));

    reportCliError(error, processLike);

    expect(processLike.exitCode).toBe(1);
    expect(stderrLines.join("")).toBe("Could not read braeburn config at /tmp/braeburn-config: bad TOML\n");
  });
});
