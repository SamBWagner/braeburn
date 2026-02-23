import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { parse, stringify } from "smol-toml";

export const PROTECTED_STEP_IDS = new Set(["homebrew"]);

export const DEFAULT_OFF_STEP_IDS = new Set(["nvm", "pyenv"]);

export type BraeburnConfig = {
  steps: Record<string, boolean>;
  logo?: boolean;
};

const EMPTY_CONFIG: BraeburnConfig = { steps: {} };

const LOGO_SETTING_ID = "logo";

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
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
    return { steps: parsed.steps ?? {}, logo: parsed.logo };
  } catch {
    return structuredClone(EMPTY_CONFIG);
  }
}

export async function writeConfig(config: BraeburnConfig): Promise<void> {
  const configPath = await resolveConfigPath();
  await mkdir(join(configPath, ".."), { recursive: true });
  await writeFile(configPath, stringify(config as Record<string, unknown>), "utf-8");
}

export function isSettingEnabled(config: BraeburnConfig, settingId: string): boolean {
  if (PROTECTED_STEP_IDS.has(settingId)) return true;
  if (settingId === LOGO_SETTING_ID) return config.logo !== false;
  if (DEFAULT_OFF_STEP_IDS.has(settingId)) return config.steps[settingId] === true;
  return config.steps[settingId] !== false;
}

export function isStepEnabled(config: BraeburnConfig, stepId: string): boolean {
  return isSettingEnabled(config, stepId);
}

export function isLogoEnabled(config: BraeburnConfig): boolean {
  return isSettingEnabled(config, LOGO_SETTING_ID);
}

export function applySettingToConfig(config: BraeburnConfig, settingId: string, desiredState: "enable" | "disable"): BraeburnConfig {
  const updatedConfig = structuredClone(config);

  if (settingId === LOGO_SETTING_ID) {
    if (desiredState === "enable") {
      delete updatedConfig.logo;
    } else {
      updatedConfig.logo = false;
    }
    return updatedConfig;
  }

  if (DEFAULT_OFF_STEP_IDS.has(settingId)) {
    if (desiredState === "enable") {
      updatedConfig.steps[settingId] = true;
    } else {
      delete updatedConfig.steps[settingId];
    }
    return updatedConfig;
  }

  if (desiredState === "enable") {
    delete updatedConfig.steps[settingId];
  } else {
    updatedConfig.steps[settingId] = false;
  }
  return updatedConfig;
}
