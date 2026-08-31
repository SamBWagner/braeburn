import {
  pyenvStep,
  nvmStep,
  homebrewStep,
  masStep,
  ohmyzshStep,
  npmStep,
  pipStep,
  dotnetStep,
  aspireStep,
  macosStep,
  cleanupStep,
  braeburnStep,
  type Step,
} from "./index.js";

const STEP_BY_ID: Record<string, Step> = {
  pyenv: pyenvStep,
  nvm: nvmStep,
  homebrew: homebrewStep,
  mas: masStep,
  macos: macosStep,
  npm: npmStep,
  pip: pipStep,
  dotnet: dotnetStep,
  aspire: aspireStep,
  ohmyzsh: ohmyzshStep,
  cleanup: cleanupStep,
  braeburn: braeburnStep,
};

const STEP_EXECUTION_ORDER: string[] = [
  "pyenv",
  "nvm",
  "homebrew",
  "mas",
  "macos",
  "npm",
  "braeburn",
  "pip",
  "dotnet",
  "aspire",
  "ohmyzsh",
  "cleanup",
];

export const ALL_STEPS: Step[] = STEP_EXECUTION_ORDER.map((stepId) => STEP_BY_ID[stepId]);
