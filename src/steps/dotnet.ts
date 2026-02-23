import { checkCommandExists, runStep, type Step, type StepRunContext } from "./index.js";

const dotnetStep: Step = {
  id: "dotnet",
  name: ".NET",
  description: "Update all globally installed .NET tools",

  async checkIsAvailable(): Promise<boolean> {
    return checkCommandExists("dotnet");
  },

  async run(context: StepRunContext): Promise<void> {
    await runStep("dotnet tool update --global --all", context);
  },
};

export default dotnetStep;
