import { describe, it, expect } from "vitest";
import { createScreenRenderer } from "../screen.js";

type MockOutput = NodeJS.WritableStream & {
  chunks: string[];
};

function createMockOutput(): MockOutput {
  const chunks: string[] = [];
  const output = {
    chunks,
    write(chunk: string | Uint8Array): boolean {
      chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf-8"));
      return true;
    },
  };
  return output as unknown as MockOutput;
}

describe("createScreenRenderer", () => {
  it("clears the screen and writes the content", () => {
    const output = createMockOutput();
    const render = createScreenRenderer(output);

    render("frame one\n");

    expect(output.chunks).toEqual([
      "\x1b[H\x1b[2J",
      "frame one\n",
    ]);
  });

  it("clears the screen on every frame", () => {
    const output = createMockOutput();
    const render = createScreenRenderer(output);

    render("frame one\n");
    render("frame two\n");

    expect(output.chunks).toEqual([
      "\x1b[H\x1b[2J",
      "frame one\n",
      "\x1b[H\x1b[2J",
      "frame two\n",
    ]);
  });
});
