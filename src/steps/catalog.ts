import {
  pyenvStep,
  nvmStep,
  homebrewStep,
  masStep,
  ohmyzshStep,
  npmStep,
  pipStep,
  dotnetStep,
  macosStep,
  cleanupStep,
  type Step,
} from "./index.js";

export const ALL_STEPS: Step[] = [
  pyenvStep,
  nvmStep,
  homebrewStep,
  masStep,
  ohmyzshStep,
  npmStep,
  pipStep,
  dotnetStep,
  macosStep,
  cleanupStep,
];
