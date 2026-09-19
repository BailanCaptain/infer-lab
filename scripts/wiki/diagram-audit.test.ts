import { expect, it } from "vitest";
import { auditDiagram } from "./diagram-audit";
import { diagramSpecSchema } from "./diagrams";
import { parsePage } from "./pages";

it("requires diagram class and function identifiers to exist in pinned source blobs", () => {
  const page = parsePage(
    "sources/a.md",
    "---\nid: a\ntitle: A\ntype: source\nsummary: A\nsources: [r@abcdef0:a.py#L1]\nevidence: C\nupdated: '2026-09-15'\n---\n```mermaid\nsequenceDiagram\n participant R as ModelRunner\n R->>R: invented_function()\n```\n",
  ).page!;
  const deps = {
    repoRoots: { r: "repo" },
    readBlob: (_root: string, commit: string) => {
      expect(commit).toBe("abcdef0");
      return { kind: "ok" as const, text: "class ModelRunner:\n    def real_function(): pass\n" };
    },
  };
  expect(auditDiagram(page, deps)).toEqual([
    { file: page.file, rule: "diagram-symbol", message: expect.stringContaining("invented_function") },
  ]);
  page.body = page.body.replace("invented_function", "real_function");
  expect(auditDiagram(page, deps)).toEqual([]);
});

/** spec 图逐条 pin 查，错的那条能指名道姓——这是比 mermaid 那条更严的地方 */
it("requires each wiki-diagram pin's symbols to exist in its own pinned blob", () => {
  const page = parsePage(
    "concepts/a.md",
    "---\nid: a\ntitle: A\ntype: concept\nsummary: A\nsources: [r@abcdef0:a.py#L1-L9]\nevidence: C\nupdated: '2026-09-19'\n---\n## 一句话\n\n看图。[C1]\n\n```wiki-diagram\nfile: demo\n```\n",
  ).page!;
  const spec = (symbol: string) =>
    diagramSpecSchema.parse({
      layout: "scene",
      id: "demo",
      caption: "演示",
      size: [200, 100],
      boxes: [{ at: [0, 0], size: [160, 40], title: "Runner", tone: "ascend" }],
      pins: [{ source: "r@abcdef0:a.py#L1-L9", symbols: [symbol] }],
    });
  const deps = (symbol: string) => ({
    repoRoots: { r: "repo" },
    readBlob: () => ({ kind: "ok" as const, text: "class ModelRunner:\n    pass\n" }),
    diagrams: new Map([
      [
        "demo",
        { id: "demo", spec: spec(symbol), specFile: "diagrams/demo.yaml", svgFile: "diagrams/demo.svg" },
      ],
    ]),
  });
  expect(auditDiagram(page, deps("ImaginaryRunner"))).toEqual([
    {
      file: "diagrams/demo.yaml",
      rule: "diagram-symbol",
      message: expect.stringContaining("ImaginaryRunner"),
    },
  ]);
  expect(auditDiagram(page, deps("ModelRunner"))).toEqual([]);
});

it("reports a wiki-diagram fence with no spec, and a pin source the page does not cite", () => {
  const page = parsePage(
    "concepts/a.md",
    "---\nid: a\ntitle: A\ntype: concept\nsummary: A\nsources: [r@abcdef0:a.py#L1-L9]\nevidence: C\nupdated: '2026-09-19'\n---\n## 一句话\n\n看图。[C1]\n\n```wiki-diagram\nfile: demo\n```\n",
  ).page!;
  const base = { repoRoots: { r: "repo" }, readBlob: () => ({ kind: "ok" as const, text: "x\n" }) };
  expect(auditDiagram(page, { ...base, diagrams: new Map() })).toEqual([
    { file: page.file, rule: "diagram-missing", message: expect.stringContaining("demo.yaml") },
  ]);
  const elsewhere = diagramSpecSchema.parse({
    layout: "scene",
    id: "demo",
    caption: "演示",
    size: [200, 100],
    pins: [{ source: "r@abcdef0:other.py#L1", symbols: ["x"] }],
  });
  const problems = auditDiagram(page, {
    ...base,
    diagrams: new Map([
      ["demo", { id: "demo", spec: elsewhere, specFile: "diagrams/demo.yaml", svgFile: "diagrams/demo.svg" }],
    ]),
  });
  expect(problems.map((p) => p.rule)).toContain("diagram-identifier");
});
