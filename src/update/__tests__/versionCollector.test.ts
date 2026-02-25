import { beforeEach, describe, expect, it, vi } from "vitest";
import { collectVersions } from "../versionCollector.js";
import { captureShellCommandOutput } from "../../runner.js";

vi.mock("../../runner.js", () => ({
  captureShellCommandOutput: vi.fn(),
}));

const mockedCaptureShellCommandOutput = vi.mocked(captureShellCommandOutput);

describe("collectVersions", () => {
  beforeEach(() => {
    mockedCaptureShellCommandOutput.mockReset();
  });

  it("collects all configured versions", async () => {
    mockedCaptureShellCommandOutput.mockResolvedValue("v1.0.0");

    const versions = await collectVersions();

    expect(versions).toHaveLength(7);
    expect(versions[0]).toEqual({ label: "macOS", value: "v1.0.0" });
    expect(mockedCaptureShellCommandOutput).toHaveBeenCalledTimes(7);
  });

  it("uses not installed when output is empty or command capture fails", async () => {
    mockedCaptureShellCommandOutput.mockImplementation(async ({ shellCommand }) => {
      if (shellCommand.includes("node -v")) {
        return "";
      }
      if (shellCommand.includes("npm -v")) {
        throw new Error("command failed");
      }
      return "ok";
    });

    const versions = await collectVersions();

    const nodeVersion = versions.find((version) => version.label === "Node");
    const npmVersion = versions.find((version) => version.label === "NPM");

    expect(nodeVersion?.value).toBe("not installed");
    expect(npmVersion?.value).toBe("not installed");
  });
});
