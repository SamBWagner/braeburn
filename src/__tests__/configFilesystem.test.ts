import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  ConfigReadError,
  readConfigFromPath,
  writeConfigToPath,
  type BraeburnConfig,
} from "../config.js";

let tempDir: string;
let configPath: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "braeburn-test-config-"));
  configPath = join(tempDir, "config");
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function writeTestConfig(config: BraeburnConfig): Promise<void> {
  await writeConfigToPath(configPath, config);
}

async function readTestConfig(): Promise<BraeburnConfig> {
  return readConfigFromPath(configPath);
}

describe("config file round-trips", () => {
  it("round-trips an empty config", async () => {
    const config: BraeburnConfig = { steps: {} };
    await writeTestConfig(config);
    const result = await readTestConfig();
    expect(result.steps).toEqual({});
  });

  it("round-trips a config with disabled steps", async () => {
    const config: BraeburnConfig = { steps: { npm: false, pip: false } };
    await writeTestConfig(config);
    const result = await readTestConfig();
    expect(result.steps.npm).toBe(false);
    expect(result.steps.pip).toBe(false);
  });

  it("round-trips a config with logo disabled", async () => {
    const config: BraeburnConfig = { steps: {}, logo: false };
    await writeTestConfig(config);
    const result = await readTestConfig();
    expect(result.logo).toBe(false);
  });

  it("round-trips a config with mixed settings", async () => {
    const config: BraeburnConfig = {
      steps: { npm: false },
      logo: false,
      defaultsProfile: "conservative-v2",
    };
    await writeTestConfig(config);
    const result = await readTestConfig();
    expect(result.steps.npm).toBe(false);
    expect(result.logo).toBe(false);
    expect(result.defaultsProfile).toBe("conservative-v2");
  });

  it("parses a hand-written TOML config", async () => {
    const toml = `
[steps]
npm = false
pip = false
`;
    await writeFile(configPath, toml, "utf-8");
    const result = await readTestConfig();
    expect(result.steps.npm).toBe(false);
    expect(result.steps.pip).toBe(false);
  });

  it("handles a config file with only a logo setting", async () => {
    const toml = `logo = false\n`;
    await writeFile(configPath, toml, "utf-8");
    const result = await readTestConfig();
    expect(result.logo).toBe(false);
    expect(result.steps).toEqual({});
  });

  it("uses an empty config when the config file is missing", async () => {
    const result = await readConfigFromPath(join(tempDir, "missing-config"));

    expect(result).toEqual({ steps: {} });
  });

  it("throws a config read error for malformed TOML", async () => {
    await writeFile(configPath, "[steps\nnpm = false", "utf-8");

    await expect(readConfigFromPath(configPath)).rejects.toBeInstanceOf(ConfigReadError);
  });

  it("throws a config read error when steps is not a table", async () => {
    await writeFile(configPath, "steps = true\n", "utf-8");

    await expect(readConfigFromPath(configPath)).rejects.toThrow('"steps" must be a table');
  });

  it("throws a config read error when a step value is not boolean", async () => {
    await writeFile(configPath, "[steps]\nnpm = \"disabled\"\n", "utf-8");

    await expect(readConfigFromPath(configPath)).rejects.toThrow('"steps.npm" must be true or false');
  });

  it("throws a config read error when logo is not boolean", async () => {
    await writeFile(configPath, "logo = \"hidden\"\n", "utf-8");

    await expect(readConfigFromPath(configPath)).rejects.toThrow('"logo" must be true or false');
  });

  it("throws a config read error when defaults profile is unknown", async () => {
    await writeFile(configPath, "defaultsProfile = \"future\"\n", "utf-8");

    await expect(readConfigFromPath(configPath)).rejects.toThrow('"defaultsProfile" must be "legacy" or "conservative-v2"');
  });
});
