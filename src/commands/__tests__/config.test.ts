import { describe, it, expect } from "vitest";
import { applyConfigUpdates } from "../config.js";
import { type BraeburnConfig } from "../../config.js";

function emptyConfig(): BraeburnConfig {
  return { steps: {} };
}

describe("applyConfigUpdates", () => {
  it("records a single change from enable to disable", () => {
    const result = applyConfigUpdates(emptyConfig(), { npm: "disable" });
    expect(result.changes).toEqual([
      { label: "npm", from: "enable", to: "disable" },
    ]);
    expect(result.updatedConfig.steps.npm).toBe(false);
  });

  it("records a single change from disable to enable", () => {
    const config: BraeburnConfig = { steps: { npm: false } };
    const result = applyConfigUpdates(config, { npm: "enable" });
    expect(result.changes).toEqual([
      { label: "npm", from: "disable", to: "enable" },
    ]);
    expect(result.updatedConfig.steps).not.toHaveProperty("npm");
  });

  it("produces no changes when desired state matches current state", () => {
    const result = applyConfigUpdates(emptyConfig(), { npm: "enable" });
    expect(result.changes).toEqual([]);
  });

  it("produces no changes when disabling an already-disabled step", () => {
    const config: BraeburnConfig = { steps: { npm: false } };
    const result = applyConfigUpdates(config, { npm: "disable" });
    expect(result.changes).toEqual([]);
  });

  it("applies multiple updates in a single call", () => {
    const result = applyConfigUpdates(emptyConfig(), {
      npm: "disable",
      pip: "disable",
    });
    expect(result.changes).toEqual([
      { label: "npm", from: "enable", to: "disable" },
      { label: "pip", from: "enable", to: "disable" },
    ]);
    expect(result.updatedConfig.steps.npm).toBe(false);
    expect(result.updatedConfig.steps.pip).toBe(false);
  });

  it("handles a mix of changes and no-ops", () => {
    const config: BraeburnConfig = { steps: { npm: false } };
    const result = applyConfigUpdates(config, {
      npm: "enable",
      pip: "enable",
    });
    expect(result.changes).toEqual([
      { label: "npm", from: "disable", to: "enable" },
    ]);
  });

  it("handles logo setting updates", () => {
    const result = applyConfigUpdates(emptyConfig(), { logo: "disable" });
    expect(result.changes).toEqual([
      { label: "logo", from: "enable", to: "disable" },
    ]);
    expect(result.updatedConfig.logo).toBe(false);
  });

  it("returns an empty changes array when given no updates", () => {
    const result = applyConfigUpdates(emptyConfig(), {});
    expect(result.changes).toEqual([]);
    expect(result.updatedConfig).toEqual(emptyConfig());
  });
});
