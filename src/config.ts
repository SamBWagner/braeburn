import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { parse, stringify } from "smol-toml";

export const PROTECTED_STEP_IDS = new Set(["homebrew"]);

export type ConfigDefaultsProfile = "legacy" | "conservative-v2";

export const LEGACY_DEFAULT_OFF_STEP_IDS = new Set(["nvm", "pyenv"]);
export const CONSERVATIVE_DEFAULT_ON_STEP_IDS = new Set(["homebrew", "npm", "pip", "dotnet"]);

export type BraeburnConfig = {
  // Exception to the no-boolean-parameters rule: persisted config stores explicit on/off flags.
  steps: Record<string, boolean>;
  logo?: boolean;
  defaultsProfile?: ConfigDefaultsProfile;
};

const EMPTY_CONFIG: BraeburnConfig = { steps: {} };

const LOGO_SETTING_ID = "logo";
const DEFAULTS_PROFILE_SETTING_ID = "defaultsProfile";
const LEGACY_PROFILE: ConfigDefaultsProfile = "legacy";

function resolveDefaultsProfile(config: BraeburnConfig): ConfigDefaultsProfile {
  return config.defaultsProfile ?? LEGACY_PROFILE;
}

function parseDefaultsProfile(rawValue: unknown): ConfigDefaultsProfile | undefined {
  if (rawValue === "legacy" || rawValue === "conservative-v2") {
    return rawValue;
  }
  return undefined;
}

function isStepEnabledByDefault(profile: ConfigDefaultsProfile, stepId: string): boolean {
  if (profile === "conservative-v2") {
    return CONSERVATIVE_DEFAULT_ON_STEP_IDS.has(stepId);
  }

  return !LEGACY_DEFAULT_OFF_STEP_IDS.has(stepId);
}

function shouldPersistStepOverride(
  profile: ConfigDefaultsProfile,
  stepId: string,
  desiredState: "enable" | "disable",
): boolean {
  return isStepEnabledByDefault(profile, stepId) !== (desiredState === "enable");
}

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
    const parsed = parse(raw) as Record<string, unknown>;
    const parsedSteps = parsed.steps as Record<string, boolean> | undefined;
    const defaultsProfile = parseDefaultsProfile(parsed[DEFAULTS_PROFILE_SETTING_ID]);
    return { steps: parsedSteps ?? {}, logo: parsed.logo as boolean | undefined, defaultsProfile };
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
  const defaultsProfile = resolveDefaultsProfile(config);
  const explicitStepOverride = config.steps[settingId];

  if (explicitStepOverride === undefined) {
    return isStepEnabledByDefault(defaultsProfile, settingId);
  }

  return explicitStepOverride === true;
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

  const defaultsProfile = resolveDefaultsProfile(updatedConfig);
  const shouldPersistOverride = shouldPersistStepOverride(defaultsProfile, settingId, desiredState);

  if (!shouldPersistOverride) {
    delete updatedConfig.steps[settingId];
    return updatedConfig;
  }

  updatedConfig.steps[settingId] = desiredState === "enable";
  return updatedConfig;
}

export function cleanConfigForWrite(config: BraeburnConfig): BraeburnConfig {
  const defaultsProfile = resolveDefaultsProfile(config);
  const cleaned: BraeburnConfig = { steps: {} };

  for (const [stepId, explicitState] of Object.entries(config.steps)) {
    if (PROTECTED_STEP_IDS.has(stepId)) {
      continue;
    }

    const desiredState = explicitState === true ? "enable" : "disable";
    if (!shouldPersistStepOverride(defaultsProfile, stepId, desiredState)) {
      continue;
    }
    cleaned.steps[stepId] = explicitState;
  }

  if (config.logo === false) {
    cleaned.logo = false;
  }

  if (config.defaultsProfile && config.defaultsProfile !== LEGACY_PROFILE) {
    cleaned.defaultsProfile = config.defaultsProfile;
  }

  return cleaned;
}
