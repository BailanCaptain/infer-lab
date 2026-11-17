import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import type { RunAgent } from "../batch";
import { wikiFixture } from "../test-fixture";
import { WorkflowStore } from "../workflow";
import { ingestParam } from "./ingest";
import { buildParamPage, paramId, protectedParamSection } from "./pages";
import { scanSources } from "./scan";
import { parameterDiff } from "./sync";

it.each(["definition", "reference"])("honours a mapped %s identity during prose ingestion", async (role) => {
  const f = wikiFixture();
  try {
    const source = "class ExampleConfig:\n    limit: int = 1\n";
    const entry = scanSources({ "config.py": source })[0]!;
    const input = { repo: "r", ref: "main", commit: "a".repeat(40), entry, source };
    const id = "legacy-limit";
    const original = buildParamPage({ ...input, date: "2026-10-08", pageId: id });
    f.write(`wiki/params/${id}.md`, original);
    f.write(
      "wiki/params/identities.json",
      JSON.stringify({
        schemaVersion: 1,
        bindings: [
          { repo: "r", file: entry.file, class: entry.class, json_path: entry.json_path, pageId: id, role },
        ],
      }),
    );
    const runAgent = vi.fn<RunAgent>(async (req) => ({
      id: req.id,
      ok: true,
      exitCode: 0,
      stderrTail: "",
      costUsd: 0,
      output: JSON.stringify({
        summary: "限制数量。[D]",
        why: "控制资源。[D]",
        costs: "代价待核对。",
        conflicts: "互斥待核对。",
      }),
    }));
    const result = await ingestParam(
      f.root,
      input,
      { maxAttempts: 1, maxCostUsd: 1, reserveUsd: 1 },
      { runAgent },
    );
    if (role === "reference") {
      expect(result).toMatchObject({ skipped: true });
      expect(runAgent).not.toHaveBeenCalled();
      expect(existsSync(join(f.root, "wiki/_drafts"))).toBe(false);
    } else {
      expect(result.id).toBe(id);
      expect(new WorkflowStore(f.root).verifyDrafts([id])).toHaveLength(1);
      expect(protectedParamSection(readFileSync(join(f.root, `wiki/_drafts/${id}.md`), "utf8"))).toBe(
        protectedParamSection(original),
      );
    }
    expect(readFileSync(join(f.root, `wiki/params/${id}.md`), "utf8")).toBe(original);
    expect(existsSync(join(f.root, `wiki/_drafts/${paramId(entry)}.md`))).toBe(false);
  } finally {
    f.cleanup();
  }
});

it("does not replace reviewed prose with a narrow-source guess or spend a model call", async () => {
  const f = wikiFixture();
  try {
    const source = "class ExampleConfig:\n    limit: int = 1\n";
    const entry = scanSources({ "config.py": source })[0]!;
    const input = { repo: "r", ref: "main", commit: "a".repeat(40), entry, source };
    const original = buildParamPage({ ...input, date: "2026-10-07" })
      .replace("骨架，待补：limit 的静态参数定义。", "已核定的用途。")
      .replace("骨架，待补：为什么存在。", "已核定的设计依据。")
      .replace("骨架，待补：开了的代价与互斥关系。", "已核定的代价和边界。");
    f.write(`wiki/params/${paramId(entry)}.md`, original);
    const runAgent = vi.fn();
    const result = await ingestParam(
      f.root,
      input,
      { maxAttempts: 1, maxCostUsd: 1, reserveUsd: 1 },
      { runAgent },
    );
    expect(result).toMatchObject({ id: paramId(entry), skipped: true });
    expect(runAgent).not.toHaveBeenCalled();
    expect(readFileSync(join(f.root, `wiki/params/${paramId(entry)}.md`), "utf8")).toBe(original);
  } finally {
    f.cleanup();
  }
});

it("prose supplementation cannot replace a published generated definition from another snapshot", async () => {
  const f = wikiFixture();
  try {
    const source = "class ExampleConfig:\n    limit: int = 1\n";
    const entry = scanSources({ "config.py": source })[0]!;
    const input = { repo: "r", ref: "main", commit: "a".repeat(40), entry, source };
    f.write(
      `wiki/params/${paramId(entry)}.md`,
      buildParamPage({
        ...input,
        commit: "b".repeat(40),
        entry: { ...entry, default: "2" },
        date: "2026-10-07",
      }),
    );
    const runAgent = vi.fn();
    await expect(
      ingestParam(f.root, input, { maxAttempts: 1, maxCostUsd: 1, reserveUsd: 1 }, { runAgent }),
    ).rejects.toThrow("参数定义与本次快照不同");
    expect(runAgent).not.toHaveBeenCalled();
  } finally {
    f.cleanup();
  }
});

it.each(["params", "_drafts"])(
  "supplements existing %s prose while keeping generated definitions byte-identical",
  async (folder) => {
    const f = wikiFixture();
    try {
      const source = "class ExampleConfig:\n    limit: int = 1\n";
      const row = scanSources({ "vllm_ascend/config.py": source })[0]!;
      const input = { repo: "r", ref: "main", commit: "a".repeat(40), entry: row, source };
      const original = buildParamPage({ ...input, date: "2026-09-15" }).replace(
        "骨架，待补：limit 的静态参数定义。",
        "已有用途，不能由本次较窄证据替换。",
      );
      f.write(`wiki/${folder}/${paramId(row)}.md`, original);
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
      if (!result.id) throw new Error("definition must produce a canonical page id");
      expect(new WorkflowStore(f.root).verifyDrafts([result.id])).toHaveLength(1);
      const draft = readFileSync(join(f.root, `wiki/_drafts/${result.id}.md`), "utf8");
      expect(protectedParamSection(draft)).toBe(protectedParamSection(original));
      expect(draft).toContain("限制资源使用。");
      expect(draft).toContain("已有用途，不能由本次较窄证据替换。");
      expect(draft).not.toContain("控制上限。[D]");
      expect(draft).toContain("summary: 已有用途，不能由本次较窄证据替换。");
      expect(draft).not.toContain("正文待补");
      if (folder === "params")
        expect(readFileSync(join(f.root, `wiki/params/${result.id}.md`), "utf8")).toBe(original);
      else expect(existsSync(join(f.root, `wiki/params/${result.id}.md`))).toBe(false);
    } finally {
      f.cleanup();
    }
  },
);
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

it("supplements same-version legacy classless parameter page without altering protected section bytes", async () => {
  const f = wikiFixture();
  try {
    const file = "vllm_ascend/config.py";
    const source = "class ExampleConfig:\n    limit: int = 1\n";
    f.write(`repo/${file}`, source);
    const commit = f.commit("legacy param");
    f.write(
      "wiki/seeds/r.yaml",
      `repos:\n  r:\n    url: https://github.com/example/r\n    path: repo\n    refs: { main: ${commit} }\nfeatures: []\n`,
    );
    const entry = scanSources({ [file]: source })[0]!;
    const id = paramId(entry);
    const legacy = buildParamPage({ repo: "r", ref: "main", commit, entry, date: "2026-11-16" }).replace(
      /^\| 所属类 \| `[^`]*` \|\r?\n/gm,
      "",
    );
    f.write(`wiki/params/${id}.md`, legacy);
    const result = await ingestParam(
      f.root,
      { repo: "r", ref: "main", commit, entry, source },
      { maxAttempts: 1, maxCostUsd: 1, reserveUsd: 1 },
      {
        runAgent: async (req) => ({
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            summary: "数量上限。[D]",
            why: "控制资源。[D]",
            costs: "代价待核对。",
            conflicts: "互斥待核对。",
          }),
        }),
      },
    );
    expect(result.id).toBe(id);
    const draft = readFileSync(join(f.root, `wiki/_drafts/${id}.md`), "utf8");
    expect(protectedParamSection(draft)).toBe(protectedParamSection(legacy));
    expect(readFileSync(join(f.root, `wiki/params/${id}.md`), "utf8")).toBe(legacy);
  } finally {
    f.cleanup();
  }
});
