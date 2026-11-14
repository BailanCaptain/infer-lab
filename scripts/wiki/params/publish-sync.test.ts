import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { lintLog } from "../lint";
import { parsePage } from "../pages";
import { readPageRaw } from "../raw";
import { wikiFixture } from "../test-fixture";
import { buildParamPage, paramId } from "./pages";
import { publishParamSync } from "./publish-sync";
import { scanSources } from "./scan";

it("retains a patrol-only line relocation for review without changing the teaching page", async () => {
  const f = wikiFixture();
  try {
    const file = "vllm_ascend/config.py";
    const source = "class ExampleConfig:\n    limit: int = 1\n";
    f.write(`repo/${file}`, source);
    const before = { commit: f.commit("teaching pin"), entries: scanSources({ [file]: source }) };
    const entry = before.entries[0]!;
    const page = buildParamPage({ repo: "r", ref: "main", ...before, entry, date: "2026-11-10" });
    const path = `wiki/params/${paramId(entry)}.md`;
    f.write(path, page);
    f.write(`repo/${file}`, `\n${source}`);
    const after = { commit: f.commit("line shift"), entries: scanSources({ [file]: `\n${source}` }) };
    const result = await publishParamSync(f.root, {
      repo: "r",
      repoDir: join(f.root, "repo"),
      ref: "main",
      before,
      after,
      maxNewPages: 0,
      teachingRefs: { main: before.commit },
    });
    expect(result.written).toBe(0);
    expect(readFileSync(join(f.root, path), "utf8")).toBe(page);
    const queue = JSON.parse(readFileSync(join(f.root, "wiki/_drafts/_param-queue.json"), "utf8"));
    expect(queue[0].relocated).toMatchObject([{ before: { line: 2 }, after: { line: 3 } }]);
  } finally {
    f.cleanup();
  }
});

it("uncapped parameter sync stages all new definitions without publishing skeletons", async () => {
  const f = wikiFixture();
  try {
    const file = "vllm_ascend/config.py";
    const old = "class ExampleConfig:\n    existing: int = 0\n";
    f.write(`repo/${file}`, old);
    const before = { commit: f.commit("old"), entries: scanSources({ [file]: old }) };
    const next = old + Array.from({ length: 12 }, (_, i) => `    extra_${i}: int = ${i}\n`).join("");
    f.write(`repo/${file}`, next);
    const after = { commit: f.commit("new"), entries: scanSources({ [file]: next }) };
    const result = await publishParamSync(f.root, {
      repo: "r",
      repoDir: join(f.root, "repo"),
      ref: "main",
      before,
      after,
      maxNewPages: null,
    });
    expect(result.added).toBe(12);
    expect(result.heldBack ?? 0).toBe(0);
    for (const entry of after.entries.filter((entry) => entry.name.startsWith("extra_"))) {
      expect(readFileSync(join(f.root, `wiki/_drafts/${paramId(entry)}.md`), "utf8")).toContain(entry.name);
      expect(existsSync(join(f.root, `wiki/params/${paramId(entry)}.md`))).toBe(false);
    }
  } finally {
    f.cleanup();
  }
});
it("refreshes an existing draft without consuming the new-page allowance", async () => {
  const f = wikiFixture();
  try {
    const file = "vllm_ascend/config.py";
    f.write(`repo/${file}`, "# no parameters\n");
    const before = { commit: f.commit("old"), entries: [] };
    const source = "class ExampleConfig:\n    extra: int = 1\n";
    f.write(`repo/${file}`, source);
    const after = { commit: f.commit("new"), entries: scanSources({ [file]: source }) };
    const entry = after.entries[0]!;
    f.write(
      `wiki/_drafts/${paramId(entry)}.md`,
      buildParamPage({ repo: "r", ref: "main", commit: after.commit, entry, date: "2026-11-03" }).replace(
        "骨架，待补：为什么存在。",
        "已有解释，继续保留。",
      ),
    );
    const result = await publishParamSync(f.root, {
      repo: "r",
      repoDir: join(f.root, "repo"),
      ref: "release",
      before,
      after,
      maxNewPages: 0,
    });
    expect(result).toMatchObject({ added: 1, written: 1 });
    expect(readFileSync(join(f.root, `wiki/_drafts/${paramId(entry)}.md`), "utf8")).toContain(
      "已有解释，继续保留。",
    );
    expect(existsSync(join(f.root, `wiki/params/${paramId(entry)}.md`))).toBe(false);
  } finally {
    f.cleanup();
  }
});

it.each(["field", "lookup"])(
  "requires a legacy identity mapping and refreshes the mapped page without changing its public id",
  async (form) => {
    const f = wikiFixture();
    try {
      const file = "vllm_ascend/config.py";
      const old =
        form === "field"
          ? "class ExampleConfig:\n    changed: int = 1\n"
          : 'changed = additional_config.get("changed", 1)\n';
      f.write(`repo/${file}`, old);
      const before = { commit: f.commit("old"), entries: scanSources({ [file]: old }) };
      const next = old.replace("= 1", "= 2").replace(", 1)", ", 2)");
      f.write(`repo/${file}`, next);
      const after = { commit: f.commit("new"), entries: scanSources({ [file]: next }) };
      const entry = before.entries[0]!;
      f.write(
        "wiki/params/changed.md",
        buildParamPage({
          repo: "r",
          ref: "main",
          commit: before.commit,
          entry: { ...entry, review: { verdict: "param", reason: "Existing reviewed page" } },
          date: "2026-09-16",
        }).replace(`id: ${paramId(entry)}`, "id: changed"),
      );
      const input = { repo: "r", repoDir: join(f.root, "repo"), ref: "main", before, after, maxNewPages: 0 };
      await expect(publishParamSync(f.root, input)).rejects.toThrow("身份映射");
      f.write("wiki/raw/changed.md", "Original archived evidence, kept intact.\n");
      f.write(
        "wiki/params/identities.json",
        JSON.stringify({
          schemaVersion: 1,
          bindings: [{ repo: "r", file, class: entry.class, json_path: entry.json_path, pageId: "changed" }],
        }),
      );
      expect(await publishParamSync(f.root, input)).toMatchObject({ changed: 1, written: 1 });
      const text = readFileSync(join(f.root, "wiki/params/changed.md"), "utf8");
      expect(text).toContain("id: changed");
      expect(text).toContain("默认表达式 | `2`");
      const page = parsePage("params/changed.md", text).page!;
      const raw = readPageRaw(join(f.root, "wiki"), page.fm.id, page.fm.rawSources);
      expect(raw).toContain("Original archived evidence, kept intact.");
      expect(raw).toContain(`r@${after.commit}:${file}#L1`);
      expect(raw).toContain(next);
      f.write(
        "wiki/seeds/vllm-ascend.yaml",
        "repos:\n  r:\n    url: https://github.com/example/r\n    path: repo\n    refs: { main: " +
          after.commit +
          " }\nfeatures: []\n",
      );
      f.write("input.json", JSON.stringify({ repo: "r", ref: "main", ...after }));
      const output = execFileSync(
        process.execPath,
        [
          "--import",
          import.meta.resolve("tsx"),
          fileURLToPath(new URL("../../wiki-build-param-pages.ts", import.meta.url)),
          "--input",
          "input.json",
          "--only",
          "changed",
          "--dry-run",
        ],
        { cwd: f.root, encoding: "utf8", windowsHide: true },
      );
      expect(JSON.parse(output)).toMatchObject({ count: 1, paths: [join(f.root, "wiki/params/changed.md")] });
    } finally {
      f.cleanup();
    }
  },
);

it("publishes one addition, removal and default change without overwriting prose or repeating the transaction", async () => {
  const f = wikiFixture();
  try {
    const file = "vllm_ascend/config.py";
    const beforeText = "class ExampleConfig:\n    changed: int = 1\n    removed: bool = False\n";
    f.write(`repo/${file}`, beforeText);
    const before = { commit: f.commit("initial"), entries: scanSources({ [file]: beforeText }) };
    f.git(["tag", "v1"]);
    f.git(["branch", "releases/v0.23.0"]);
    for (const entry of before.entries)
      f.write(
        `wiki/params/${paramId(entry)}.md`,
        buildParamPage({
          repo: "r",
          ref: "main",
          commit: before.commit,
          entry: { ...entry, review: { verdict: "param", reason: "Existing reviewed page" } },
          date: "2026-09-16",
        }).replace("骨架，待补：为什么存在。", "人工保留解释。[D]"),
      );
    const afterText = "class ExampleConfig:\n    changed: int = 2\n    added: bool = True\n";
    f.write(`repo/${file}`, afterText);
    const after = { commit: f.commit("add remove change (#2)"), entries: scanSources({ [file]: afterText }) };
    f.git(["tag", "v2"]);
    const input = { repo: "r", repoDir: join(f.root, "repo"), ref: "main", before, after, maxNewPages: 1 };
    await expect(publishParamSync(f.root, { ...input, maxNewPages: 0 })).rejects.toThrow("非批量上限");
    expect(await publishParamSync(f.root, input)).toEqual({ added: 1, removed: 1, changed: 1, written: 3 });
    const text = readFileSync(join(f.root, `wiki/params/${paramId(after.entries[0]!)}.md`), "utf8");
    expect(text).toContain("人工保留解释。[D]");
    expect(text).toContain("默认表达式 | `2`");
    expect(text).toContain("ExampleConfig.changed");
    // 版本谱系按发布分支列（wiki:lineage 的口径），不许被刷成裸提交对——2026-09-24 夜间就这么把 8 页的表顶掉过
    expect(text).toContain("| releases/v0.23.0 | 有");
    expect(text).toContain("| main | 有");
    expect(text).not.toMatch(/^\| [a-f0-9]{40} \|/m);
    const removed = readFileSync(join(f.root, `wiki/params/${paramId(before.entries[1]!)}.md`), "utf8");
    expect(removed).toContain("ExampleConfig.removed");
    expect(removed).toContain("| main | 无 |");
    const log = readFileSync(join(f.root, "wiki/log.md"), "utf8");
    expect(lintLog(log)).toEqual([]);
    expect(log).toContain('"1" → "2"');
    await publishParamSync(f.root, input);
    expect(readFileSync(join(f.root, "wiki/log.md"), "utf8")).toBe(log);
    await publishParamSync(f.root, { ...input, ref: "release" });
    expect(JSON.parse(readFileSync(join(f.root, "wiki/_drafts/_param-queue.json"), "utf8"))).toHaveLength(2);
  } finally {
    f.cleanup();
  }
});
