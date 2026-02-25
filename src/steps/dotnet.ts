import { checkCommandExists } from "./runtime.js";
import type { Step, StepRunContext } from "./types.js";

const dotnetStep: Step = {
  id: "dotnet",
  name: ".NET",
  stage: "tools",
  description: "Update all globally installed .NET tools",

  async checkIsAvailable(): Promise<boolean> {
    return checkCommandExists("dotnet");
  },

  async run(context: StepRunContext): Promise<void> {
    await context.runStep("dotnet tool update --global --all");
  },
};

export default dotnetStep;
