import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parsePage } from "./pages";
import { bindRawSnapshot, readPageRaw, saveRawSnapshot } from "./raw";
import { wikiFixture } from "./test-fixture";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});
const setup = () => {
  const f = wikiFixture();
  fixtures.push(f);
  mkdirSync(join(f.root, "raw"));
  return f;
};
const draft =
  "---\nid: a\ntitle: A\ntype: concept\nsummary: A\nsources: [r@abcdef0:a.py#L1]\nevidence: C\nupdated: '2026-09-15'\n---\n[原文](../raw/a.md#L1)\n`[示例](../raw/a.md)`\n```md\n[示例](../raw/a.md)\n```\n";

describe("immutable raw snapshots", () => {
  it("preserves snapshot bytes across git storage and checkout using repository attributes", () => {
    const f = setup();
    const text = "原文\r\nsecond\r\n";
    const repo = join(f.root, "repo");
    f.write("repo/.gitattributes", readFileSync(new URL("../../.gitattributes", import.meta.url), "utf8"));
    const snapshot = saveRawSnapshot(join(repo, "wiki"), text);
    f.commit("snapshot");
    expect(execFileSync("git", ["show", `HEAD:wiki/${snapshot}`], { cwd: repo })).toEqual(Buffer.from(text));
    f.git(["checkout-index", "-f", "--", `wiki/${snapshot}`]);
    expect(readPageRaw(join(repo, "wiki"), "a", [snapshot])).toBe(text);
  });
  it("deduplicates exact content and retains previous revisions and legacy evidence", () => {
    const f = setup();
    f.write("raw/a.md", "legacy");
    const first = saveRawSnapshot(f.root, "first\r\n");
    expect(saveRawSnapshot(f.root, "first\r\n")).toBe(first);
    const second = saveRawSnapshot(f.root, "second\n");
    expect(second).not.toBe(first);
    expect(readFileSync(join(f.root, first), "utf8")).toBe("first\r\n");
    expect(readFileSync(join(f.root, "raw/a.md"), "utf8")).toBe("legacy");
  });
  it("refuses corrupted snapshots and escaped paths", () => {
    const f = setup();
    const file = saveRawSnapshot(f.root, "original");
    writeFileSync(join(f.root, file), "tampered");
    expect(() => readPageRaw(f.root, "a", [file])).toThrow(/hash/);
    expect(() => saveRawSnapshot(f.root, "original")).toThrow(/hash/);
    expect(() => readPageRaw(f.root, "a", ["../outside.md"])).toThrow(/路径/);
  });
  it("binds the draft to its snapshot and rewrites links without changing code examples", () => {
    const bound = bindRawSnapshot(draft, "source", "a");
    const parsed = parsePage("_drafts/a.md", bound.text);
    expect(parsed.problems).toEqual([]);
    expect(parsed.page?.fm.rawSources).toEqual([bound.path]);
    expect(parsed.page?.fm.sources).toEqual(["r@abcdef0:a.py#L1"]);
    expect(bound.text).toContain(`[原文](../${bound.path}#L1)`);
    expect(bound.text).toContain("`[示例](../raw/a.md)`");
    expect(bound.text).toContain("```md\n[示例](../raw/a.md)\n```");
  });
  it("reads legacy pages without requiring a migration", () => {
    const f = setup();
    f.write("raw/a.md", "old evidence");
    expect(readPageRaw(f.root, "a")).toBe("old evidence");
  });
});
