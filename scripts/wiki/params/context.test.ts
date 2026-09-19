import { expect, it } from "vitest";
import { paramSourceContext } from "./context";
import { scanSources } from "./scan";

it("keeps long source context within a declared line scope, never silently presenting it as a full file", () => {
  const source = `${"# filler unrelated\n".repeat(1500)}class TestConfig:\n    limit: int = 1\n`;
  const entry = scanSources({ "config.py": source })[0]!;
  const context = paramSourceContext(entry, source);
  expect(context).toContain("L1502:     limit: int = 1");
  expect(context).toContain("未提供完整类或完整控制流");
  expect(context.length).toBeLessThan(20000);
});
