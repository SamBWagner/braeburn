import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { stringify, parse } from "smol-toml";
import type { BraeburnConfig } from "../config.js";

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
  await writeFile(configPath, stringify(config as Record<string, unknown>), "utf-8");
}

async function readTestConfig(): Promise<BraeburnConfig> {
  const raw = await readFile(configPath, "utf-8");
  const parsed = parse(raw) as Partial<BraeburnConfig>;
  return { steps: parsed.steps ?? {}, logo: parsed.logo, defaultsProfile: parsed.defaultsProfile };
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
});
