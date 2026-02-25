import { describe, it, expect } from "vitest";
import {
  isSettingEnabled,
  isStepEnabled,
  isLogoEnabled,
  applySettingToConfig,
  PROTECTED_STEP_IDS,
  type BraeburnConfig,
} from "../config.js";

function emptyConfig(): BraeburnConfig {
  return { steps: {} };
}

describe("isSettingEnabled", () => {
  it("returns true when the step key is absent from config", () => {
    expect(isSettingEnabled(emptyConfig(), "npm")).toBe(true);
  });

  it("returns true when the step is explicitly set to true", () => {
    expect(isSettingEnabled({ steps: { npm: true } }, "npm")).toBe(true);
  });

  it("returns false when the step is explicitly set to false", () => {
    expect(isSettingEnabled({ steps: { npm: false } }, "npm")).toBe(false);
  });

  it("returns true for a protected step even when set to false", () => {
    const protectedId = [...PROTECTED_STEP_IDS][0];
    expect(isSettingEnabled({ steps: { [protectedId]: false } }, protectedId)).toBe(true);
  });

  it("returns true for logo when logo key is absent", () => {
    expect(isSettingEnabled(emptyConfig(), "logo")).toBe(true);
  });

  it("returns false for logo when logo is explicitly false", () => {
    expect(isSettingEnabled({ steps: {}, logo: false }, "logo")).toBe(false);
  });

  it("returns true for logo when logo is explicitly true", () => {
    expect(isSettingEnabled({ steps: {}, logo: true }, "logo")).toBe(true);
  });

  it("returns true for an unknown step id (absent means enabled)", () => {
    expect(isSettingEnabled(emptyConfig(), "some_unknown_step")).toBe(true);
  });

  it("uses conservative defaults when defaultsProfile is conservative-v2", () => {
    const conservativeConfig: BraeburnConfig = { steps: {}, defaultsProfile: "conservative-v2" };
    expect(isSettingEnabled(conservativeConfig, "npm")).toBe(true);
    expect(isSettingEnabled(conservativeConfig, "ohmyzsh")).toBe(false);
    expect(isSettingEnabled(conservativeConfig, "macos")).toBe(false);
  });
});

describe("isStepEnabled", () => {
  it("returns true for an enabled step", () => {
    expect(isStepEnabled(emptyConfig(), "npm")).toBe(true);
  });

  it("returns false for a disabled step", () => {
    expect(isStepEnabled({ steps: { npm: false } }, "npm")).toBe(false);
  });

  it("returns true for a protected step regardless of config", () => {
    const protectedId = [...PROTECTED_STEP_IDS][0];
    expect(isStepEnabled({ steps: { [protectedId]: false } }, protectedId)).toBe(true);
  });
});

describe("isLogoEnabled", () => {
  it("returns true when logo is absent", () => {
    expect(isLogoEnabled(emptyConfig())).toBe(true);
  });

  it("returns false when logo is false", () => {
    expect(isLogoEnabled({ steps: {}, logo: false })).toBe(false);
  });

  it("returns true when logo is true", () => {
    expect(isLogoEnabled({ steps: {}, logo: true })).toBe(true);
  });
});

describe("applySettingToConfig", () => {
  it("disables a step by setting it to false", () => {
    const result = applySettingToConfig(emptyConfig(), "npm", "disable");
    expect(result.steps.npm).toBe(false);
  });

  it("enables a step by deleting the key", () => {
    const config: BraeburnConfig = { steps: { npm: false } };
    const result = applySettingToConfig(config, "npm", "enable");
    expect(result.steps).not.toHaveProperty("npm");
  });

  it("does not mutate the original config", () => {
    const config: BraeburnConfig = { steps: { npm: false } };
    const configCopy = structuredClone(config);
    applySettingToConfig(config, "npm", "enable");
    expect(config).toEqual(configCopy);
  });

  it("disables logo by setting logo to false", () => {
    const result = applySettingToConfig(emptyConfig(), "logo", "disable");
    expect(result.logo).toBe(false);
  });

  it("enables logo by deleting the logo key", () => {
    const config: BraeburnConfig = { steps: {}, logo: false };
    const result = applySettingToConfig(config, "logo", "enable");
    expect(result).not.toHaveProperty("logo");
  });

  it("handles disabling an already-absent step", () => {
    const result = applySettingToConfig(emptyConfig(), "pip", "disable");
    expect(result.steps.pip).toBe(false);
  });

  it("handles enabling an already-absent step (no-op)", () => {
    const result = applySettingToConfig(emptyConfig(), "pip", "enable");
    expect(result.steps).not.toHaveProperty("pip");
  });

  it("applies multiple sequential changes correctly", () => {
    let config = emptyConfig();
    config = applySettingToConfig(config, "npm", "disable");
    config = applySettingToConfig(config, "pip", "disable");
    config = applySettingToConfig(config, "npm", "enable");

    expect(config.steps).not.toHaveProperty("npm");
    expect(config.steps.pip).toBe(false);
  });

  it("stores explicit true when enabling a conservative default-off step", () => {
    const conservativeConfig: BraeburnConfig = { steps: {}, defaultsProfile: "conservative-v2" };
    const result = applySettingToConfig(conservativeConfig, "ohmyzsh", "enable");
    expect(result.steps.ohmyzsh).toBe(true);
  });

  it("drops explicit value when disabling a conservative default-off step", () => {
    const conservativeConfig: BraeburnConfig = {
      steps: { ohmyzsh: true },
      defaultsProfile: "conservative-v2",
    };
    const result = applySettingToConfig(conservativeConfig, "ohmyzsh", "disable");
    expect(result.steps).not.toHaveProperty("ohmyzsh");
  });
});
