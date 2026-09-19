import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { wikiFixture } from "../test-fixture";
import { WorkflowStore } from "../workflow";
import { ingestParam } from "./ingest";
import { buildParamPage, paramId, protectedParamSection } from "./pages";
import { scanSources } from "./scan";
import { parameterDiff } from "./sync";

it("supplements prose in a reviewed draft while keeping generated definitions byte-identical", async () => {
  const f = wikiFixture();
  try {
    const source = "class ExampleConfig:\n    limit: int = 1\n";
    const row = scanSources({ "vllm_ascend/config.py": source })[0]!;
    const input = { repo: "r", ref: "main", commit: "a".repeat(40), entry: row, source };
    const original = buildParamPage({ ...input, date: "2026-09-15" });
    f.write(`wiki/params/${paramId(row)}.md`, original);
    const result = await ingestParam(
      f.root,
      input,
      { maxAttempts: 1, maxCostUsd: 1, reserveUsd: 1 },
      {
        runAgent: async (req) => ({
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            summary: "控制上限。[D]",
            why: "限制资源使用。[D]",
            costs: "性能影响待核对。[I]",
            conflicts: "没有提供互斥证据。",
          }),
        }),
      },
    );
    expect(new WorkflowStore(f.root).verifyDrafts([result.id])).toHaveLength(1);
    const draft = readFileSync(join(f.root, `wiki/_drafts/${result.id}.md`), "utf8");
    expect(protectedParamSection(draft)).toBe(protectedParamSection(original));
    expect(draft).toContain("限制资源使用。");
    expect(readFileSync(join(f.root, `wiki/params/${result.id}.md`), "utf8")).toBe(original);
  } finally {
    f.cleanup();
  }
});
it("distinguishes semantic parameter changes from shifted definition lines", () => {
  const [entry] = scanSources({ "config.py": "class ExampleConfig:\n    limit: int = 1\n" });
  expect(parameterDiff([entry!], [{ ...entry!, line: 100 }])).toMatchObject({
    added: [],
    removed: [],
    changed: [],
    relocated: [{ after: { line: 100 } }],
  });
  expect(parameterDiff([entry!], [{ ...entry!, default: "2" }]).changed).toHaveLength(1);
});
