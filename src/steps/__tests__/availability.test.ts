import { describe, it, expect } from "vitest";
import { checkCommandExists, checkPathExists } from "../index.js";

describe("checkCommandExists", () => {
  it("returns true for a command that exists (ls)", async () => {
    const result = await checkCommandExists("ls");
    expect(result).toBe(true);
  });

  it("returns true for bash", async () => {
    const result = await checkCommandExists("bash");
    expect(result).toBe(true);
  });

  it("returns false for a command that does not exist", async () => {
    const result = await checkCommandExists("nonexistent_command_xyz_12345");
    expect(result).toBe(false);
  });

  it("returns false for a command with special characters", async () => {
    const result = await checkCommandExists("@nonexistent_cmd_12345!");
    expect(result).toBe(false);
  });
});

describe("checkPathExists", () => {
  it("returns true for /tmp", async () => {
    const result = await checkPathExists("/tmp");
    expect(result).toBe(true);
  });

  it("returns true for the root directory", async () => {
    const result = await checkPathExists("/");
    expect(result).toBe(true);
  });

  it("returns false for a nonexistent path", async () => {
    const result = await checkPathExists("/nonexistent/path/xyz/12345");
    expect(result).toBe(false);
  });
});
