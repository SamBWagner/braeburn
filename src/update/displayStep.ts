import type { Step } from "../steps/index.js";
import type { DisplayStep } from "./state.js";

export function toDisplayStep(step: Step): DisplayStep {
  return {
    id: step.id,
    name: step.name,
    description: step.description,
    categoryId: step.categoryId,
  };
}

export function toDisplaySteps(steps: Step[]): DisplayStep[] {
  return steps.map(toDisplayStep);
}
