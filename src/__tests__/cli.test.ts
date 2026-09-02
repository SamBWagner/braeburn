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

  it("documents newly added tools in the detailed update help", () => {
    const helpOutput: string[] = [];
    const program = createBraeburnProgram({
      allSteps: [
        makeStep({ id: "rustup", name: "Rust (rustup)", categoryId: "runtimes" }),
        makeStep({ id: "uv", name: "uv tools", categoryId: "cli-tools" }),
        makeStep({ id: "gh", name: "GitHub CLI extensions", categoryId: "cli-tools" }),
      ],
      dependencies: makeDependencies(),
      processLike: makeProcessLike().processLike,
      version: "9.9.9",
    });
    const updateCommand = program.commands.find((command) => command.name() === "update");
    updateCommand?.configureOutput({ writeOut: (output) => helpOutput.push(output) });

    updateCommand?.outputHelp();

    const renderedHelp = helpOutput.join("");
    expect(renderedHelp).toContain(
      "rustup     Update installed Rust toolchains and rustup",
    );
    expect(renderedHelp).toContain("braeburn nvm pyenv rustup");
    expect(renderedHelp).toContain("uv         Upgrade tools installed with uv");
    expect(renderedHelp).toContain("gh         Upgrade installed GitHub CLI extensions");
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

  it("opens the interactive config editor when paired boolean options are omitted", async () => {
    const npmStep = makeStep({ id: "npm", name: "npm", categoryId: "cli-tools" });
    const dependencies = makeDependencies();
    const { processLike } = makeProcessLike();
    const program = createBraeburnProgram({
      allSteps: [npmStep],
      dependencies,
      processLike,
      version: "9.9.9",
    });

    await program.parseAsync(["config", "update"], { from: "user" });

    expect(dependencies.runConfigCommand).toHaveBeenCalledWith({
      allSteps: [npmStep],
      outputMode: "interactive",
    });
    expect(dependencies.runConfigUpdateCommand).not.toHaveBeenCalled();
  });

  it.each([
    { flag: "--no-logo", expectedUpdate: "disable" },
    { flag: "--logo", expectedUpdate: "enable" },
  ] as const)("maps $flag to an explicit logo update", async ({ flag, expectedUpdate }) => {
    const dependencies = makeDependencies();
    const { processLike } = makeProcessLike();
    const program = createBraeburnProgram({
      allSteps: [makeStep()],
      dependencies,
      processLike,
      version: "9.9.9",
    });

    await program.parseAsync(["config", "update", flag], { from: "user" });

    expect(dependencies.runConfigUpdateCommand).toHaveBeenCalledWith({
      settingUpdates: { logo: expectedUpdate },
      allSteps: [expect.objectContaining({ id: "homebrew" })],
    });
  });

  it.each([
    { stepId: "npm", stepName: "npm", flag: "--no-npm", expectedUpdate: "disable" },
    { stepId: "npm", stepName: "npm", flag: "--npm", expectedUpdate: "enable" },
    { stepId: "uv", stepName: "uv tools", flag: "--no-uv", expectedUpdate: "disable" },
    { stepId: "uv", stepName: "uv tools", flag: "--uv", expectedUpdate: "enable" },
    { stepId: "gh", stepName: "GitHub CLI extensions", flag: "--no-gh", expectedUpdate: "disable" },
    { stepId: "gh", stepName: "GitHub CLI extensions", flag: "--gh", expectedUpdate: "enable" },
  ] as const)(
    "maps $flag to an explicit step update",
    async ({ stepId, stepName, flag, expectedUpdate }) => {
      const configuredStep = makeStep({ id: stepId, name: stepName, categoryId: "cli-tools" });
      const dependencies = makeDependencies();
      const { processLike } = makeProcessLike();
      const program = createBraeburnProgram({
        allSteps: [configuredStep],
        dependencies,
        processLike,
        version: "9.9.9",
      });

      await program.parseAsync(["config", "update", flag], { from: "user" });

      expect(dependencies.runConfigUpdateCommand).toHaveBeenCalledWith({
        settingUpdates: { [stepId]: expectedUpdate },
        allSteps: [configuredStep],
      });
    },
  );
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
