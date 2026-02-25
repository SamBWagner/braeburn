import { describe, it, expect, vi } from "vitest";
import type { StepRunContext } from "../index.js";
import nvmStep from "../nvm.js";

function createMockContext(runStepCommands: string[]): StepRunContext {
  return {
    onOutputLine: () => {},
    logWriter: async () => {},
    runStep: vi.fn(async (shellCommand: string) => {
      runStepCommands.push(shellCommand);
    }),
    captureOutput: vi.fn(async () => ""),
  };
}

describe("nvmStep", () => {
  it("has the correct id and name", () => {
    expect(nvmStep.id).toBe("nvm");
    expect(nvmStep.name).toBe("Node.js (nvm)");
  });

  it("runs nvm with non-interactive bootstrap and explicit reinstall source", async () => {
    const runStepCommands: string[] = [];
    const context = createMockContext(runStepCommands);

    await nvmStep.run(context);

    expect(runStepCommands).toHaveLength(1);
    expect(runStepCommands[0]).toContain('source "$NVM_DIR/nvm.sh" --no-use');
    expect(runStepCommands[0]).toContain('CURRENT_NODE_VERSION="$(nvm current)"');
    expect(runStepCommands[0]).toContain(
      'nvm install node --reinstall-packages-from="$CURRENT_NODE_VERSION"',
    );
    expect(runStepCommands[0]).not.toContain("--reinstall-packages-from=node");
  });
});
