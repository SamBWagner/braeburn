import { checkCommandExists } from "./runtime.js";
import type { Step, StepRunContext } from "./types.js";

const rustupStep: Step = {
  id: "rustup",
  name: "Rust (rustup)",
  categoryId: "runtimes",
  description: "Update installed Rust toolchains and rustup",

  async checkIsAvailable(): Promise<boolean> {
    return checkCommandExists("rustup");
  },

  async run(context: StepRunContext): Promise<void> {
    await context.runStep("rustup update");
  },
};

export default rustupStep;
