import type { Step } from "../steps/index.js";
import type { DisplayStep } from "./state.js";

export function toDisplayStep(step: Step): DisplayStep {
  return {
    id: step.id,
    name: step.name,
    description: step.description,
    stage: step.stage,
  };
}

export function toDisplaySteps(steps: Step[]): DisplayStep[] {
  return steps.map(toDisplayStep);
}
