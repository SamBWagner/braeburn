import { describe, it, expect } from "vitest";
import { ALL_STEPS } from "../catalog.js";
import { listStepCategoryDefinitions, getStepCategoryLabel } from "../categories.js";

describe("step categories", () => {
  it("returns category definitions in display order", () => {
    expect(listStepCategoryDefinitions().map((categoryDefinition) => categoryDefinition.id)).toEqual([
      "runtimes",
      "apps-packages",
      "cli-tools",
      "shell",
      "maintenance",
    ]);
  });

  it("maps every step to a known category label", () => {
    const knownCategoryIds = new Set(
      listStepCategoryDefinitions().map((categoryDefinition) => categoryDefinition.id),
    );

    for (const step of ALL_STEPS) {
      expect(knownCategoryIds.has(step.categoryId)).toBe(true);
      expect(getStepCategoryLabel(step.categoryId).length).toBeGreaterThan(0);
    }
  });

  it("keeps a single centralized execution order for all steps", () => {
    expect(ALL_STEPS.map((step) => step.id)).toEqual([
      "pyenv",
      "nvm",
      "homebrew",
      "mas",
      "macos",
      "npm",
      "braeburn",
      "pip",
      "dotnet",
      "ohmyzsh",
      "cleanup",
    ]);
  });
});
