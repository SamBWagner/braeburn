import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { parse, stringify } from "smol-toml";

export const PROTECTED_STEP_IDS = new Set(["homebrew"]);

export type ConfigDefaultsProfile = "legacy" | "conservative-v2";

export const LEGACY_DEFAULT_OFF_STEP_IDS = new Set(["nvm", "pyenv"]);
export const CONSERVATIVE_DEFAULT_ON_STEP_IDS = new Set(["homebrew", "npm", "braeburn", "pip", "dotnet"]);

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

export class ConfigReadError extends Error {
  readonly configPath: string;
  readonly originalError: unknown;

  constructor(configPath: string, originalError: unknown) {
    const reason = originalError instanceof Error ? originalError.message : String(originalError);
    super(`Could not read braeburn config at ${configPath}: ${reason}`);
    this.name = "ConfigReadError";
    this.configPath = configPath;
    this.originalError = originalError;
  }
}

function resolveDefaultsProfile(config: BraeburnConfig): ConfigDefaultsProfile {
  return config.defaultsProfile ?? LEGACY_PROFILE;
}

function parseDefaultsProfile(rawValue: unknown): ConfigDefaultsProfile | undefined {
  if (rawValue === undefined) {
    return undefined;
  }

  if (rawValue === "legacy" || rawValue === "conservative-v2") {
    return rawValue;
  }

  throw new Error(`"${DEFAULTS_PROFILE_SETTING_ID}" must be "legacy" or "conservative-v2".`);
}

function parseSteps(rawValue: unknown): Record<string, boolean> {
  if (rawValue === undefined) {
    return {};
  }

  if (typeof rawValue !== "object" || rawValue === null || Array.isArray(rawValue)) {
    throw new Error('"steps" must be a table of step IDs to boolean values.');
  }

  const steps: Record<string, boolean> = {};

  for (const [stepId, enabled] of Object.entries(rawValue)) {
    if (typeof enabled !== "boolean") {
      throw new Error(`"steps.${stepId}" must be true or false.`);
    }
    steps[stepId] = enabled;
  }

  return steps;
}

function parseLogo(rawValue: unknown): boolean | undefined {
  if (rawValue === undefined || typeof rawValue === "boolean") {
    return rawValue;
  }

  throw new Error('"logo" must be true or false.');
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

export function parseConfig(rawConfig: string): BraeburnConfig {
  const parsed = parse(rawConfig) as Record<string, unknown>;
  const steps = parseSteps(parsed.steps);
  const logo = parseLogo(parsed.logo);
  const defaultsProfile = parseDefaultsProfile(parsed[DEFAULTS_PROFILE_SETTING_ID]);
  const config: BraeburnConfig = { steps };

  if (logo !== undefined) {
    config.logo = logo;
  }

  if (defaultsProfile !== undefined) {
    config.defaultsProfile = defaultsProfile;
  }

  return config;
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
  return readConfigFromPath(configPath);
}

export async function readConfigFromPath(configPath: string): Promise<BraeburnConfig> {
  try {
    const raw = await readFile(configPath, "utf-8");
    return parseConfig(raw);
  } catch (error) {
    if (isMissingFileError(error)) {
      return structuredClone(EMPTY_CONFIG);
    }

    throw new ConfigReadError(configPath, error);
  }
}

export async function writeConfig(config: BraeburnConfig): Promise<void> {
  const configPath = await resolveConfigPath();
  await writeConfigToPath(configPath, config);
}

export async function writeConfigToPath(configPath: string, config: BraeburnConfig): Promise<void> {
  await mkdir(dirname(configPath), { recursive: true });
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
