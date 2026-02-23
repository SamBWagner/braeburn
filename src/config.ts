import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { parse, stringify } from "smol-toml";

/** Steps that cannot be disabled — brew is a hard runtime dependency. */
export const PROTECTED_STEP_IDS = new Set(["homebrew"]);

export type BraeburnConfig = {
  steps: Record<string, boolean>;
};

const EMPTY_CONFIG: BraeburnConfig = { steps: {} };

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export async function resolveConfigPath(): Promise<string> {
  const xdgConfig = join(homedir(), ".config");
  if (await pathExists(xdgConfig)) {
    return join(xdgConfig, "braeburn", "config");
  }
  return join(homedir(), ".braeburn", "config");
}

export async function configFileExists(): Promise<boolean> {
  const configPath = await resolveConfigPath();
  return pathExists(configPath);
}

export async function readConfig(): Promise<BraeburnConfig> {
  const configPath = await resolveConfigPath();
  try {
    const raw = await readFile(configPath, "utf-8");
    const parsed = parse(raw) as Partial<BraeburnConfig>;
    return { steps: parsed.steps ?? {} };
  } catch {
    return structuredClone(EMPTY_CONFIG);
  }
}

export async function writeConfig(config: BraeburnConfig): Promise<void> {
  const configPath = await resolveConfigPath();
  await mkdir(join(configPath, ".."), { recursive: true });
  await writeFile(configPath, stringify(config as Record<string, unknown>), "utf-8");
}

export function isStepEnabled(config: BraeburnConfig, stepId: string): boolean {
  if (PROTECTED_STEP_IDS.has(stepId)) return true;
  // Absent from config means enabled (opt-out model)
  return config.steps[stepId] !== false;
}
