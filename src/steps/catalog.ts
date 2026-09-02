import {
  pyenvStep,
  nvmStep,
  rustupStep,
  homebrewStep,
  masStep,
  ohmyzshStep,
  npmStep,
  pipStep,
  uvStep,
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
  rustup: rustupStep,
  homebrew: homebrewStep,
  mas: masStep,
  macos: macosStep,
  npm: npmStep,
  pip: pipStep,
  uv: uvStep,
  dotnet: dotnetStep,
  aspire: aspireStep,
  ohmyzsh: ohmyzshStep,
  cleanup: cleanupStep,
  braeburn: braeburnStep,
};

const STEP_EXECUTION_ORDER: string[] = [
  "pyenv",
  "nvm",
  "rustup",
  "homebrew",
  "mas",
  "macos",
  "npm",
  "braeburn",
  "pip",
  "uv",
  "dotnet",
  "aspire",
  "ohmyzsh",
  "cleanup",
];

export const ALL_STEPS: Step[] = STEP_EXECUTION_ORDER.map((stepId) => STEP_BY_ID[stepId]);
