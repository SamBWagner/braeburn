import { describe, it, expect } from "vitest";
import { buildVersionReportLines } from "../versionReport.js";
import { stripAnsi } from "../../__tests__/helpers.js";
import type { ResolvedVersion } from "../state.js";

describe("buildVersionReportLines", () => {
  it("renders version labels and values with a header and completion message", () => {
    const versions: ResolvedVersion[] = [
      { label: "Node", value: "v22.1.0" },
      { label: "Python", value: "3.12.5" },
    ];
    const lines = buildVersionReportLines(versions);
    expect(lines.map(stripAnsi)).toEqual([
      "  ─── Versions ─────────────────────────",
      "  · Node: v22.1.0",
      "  · Python: 3.12.5",
      "",
      "  ✓ All done!",
    ]);
  });

  it("renders the completion message even with no versions", () => {
    const lines = buildVersionReportLines([]);
    expect(lines.map(stripAnsi)).toEqual([
      "  ─── Versions ─────────────────────────",
      "",
      "  ✓ All done!",
    ]);
  });

  it("renders 'not installed' values verbatim", () => {
    const versions: ResolvedVersion[] = [
      { label: "Zsh", value: "not installed" },
    ];
    const lines = buildVersionReportLines(versions);
    expect(lines.map(stripAnsi)).toEqual([
      "  ─── Versions ─────────────────────────",
      "  · Zsh: not installed",
      "",
      "  ✓ All done!",
    ]);
  });
});
