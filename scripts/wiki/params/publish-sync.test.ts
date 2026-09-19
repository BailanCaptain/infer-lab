import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
    expect(text).toContain("v2");
    const removed = readFileSync(join(f.root, `wiki/params/${paramId(before.entries[1]!)}.md`), "utf8");
    expect(removed).toContain("**移除**");
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
