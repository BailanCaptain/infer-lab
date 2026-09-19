import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runLint } from "./lint";
import { saveRawSnapshot, withRawSources } from "./raw";
import { wikiFixture } from "./test-fixture";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});

function setup() {
  const f = wikiFixture();
  fixtures.push(f);
  f.write("repo/a.py", "first\nsecond\n");
  const old = f.commit("old");
  f.write("repo/a.py", "new\n");
  const current = f.commit("current");
  f.write(
    "seeds.yaml",
    `repos:\n  r:\n    url: https://example.test/r\n    path: repo\n    refs: {main: ${current}}\nfeatures: []\n`,
  );
  const source = (ref: string) => {
    f.write(
      "wiki/concepts/x.md",
      `---\nid: x\ntitle: X\ntype: concept\nsummary: x\nsources: [${ref}]\nevidence: C\nupdated: '2026-09-14'\n---\n## 一句话\nx\n`,
    );
    f.write("wiki/raw/x.md", `## ${ref}\n\nsource\n`);
  };
  return { ...f, old, current, source };
}

describe("wiki:audit pinned blobs", () => {
  it("audits local source lines and rejects corruption without Git or URL fallback", () => {
    const f = setup();
    const wiki = join(f.root, "wiki");
    const snapshot = saveRawSnapshot(wiki, "first\nsecond\n");
    const ref = `raw:${snapshot.slice(4)}#L2`;
    f.source(ref);
    let result = f.cli("wiki-audit", ["--seeds", "seeds.yaml"]);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain("行号有效 1，URL 未联网验证 0");
    expect(runLint(f.root, { terms: false }).some((p) => p.rule === "source-local-evidence")).toBe(true);
    f.source(ref.replace("#L2", "#L3"));
    result = f.cli("wiki-audit", ["--seeds", "seeds.yaml"]);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("out-of-range");
    expect(runLint(f.root, { terms: false }).some((p) => p.rule === "raw-line-range")).toBe(true);
    f.source(ref);
    f.write(`wiki/${snapshot}`, "corrupt");
    expect(f.cli("wiki-audit", ["--seeds", "seeds.yaml"]).status).toBe(1);
    expect(runLint(f.root, { terms: false }).some((p) => p.rule === "raw-integrity")).toBe(true);
  }, 15000);
  it("uses mapped snapshots and rejects missing or tampered raw in audit and lint", () => {
    const f = setup();
    const ref = `r@${f.old}:a.py#L2`;
    f.source(ref);
    const wiki = join(f.root, "wiki");
    const snapshot = saveRawSnapshot(wiki, `## ${ref}\nsource\n`);
    const text = readFileSync(join(wiki, "concepts/x.md"), "utf8");
    f.write("wiki/concepts/x.md", withRawSources(text, [snapshot]));
    f.write("wiki/raw/x.md", "legacy without matching citation");
    const valid = f.cli("wiki-audit", ["--seeds", "seeds.yaml"]);
    expect(valid.status, valid.stdout + valid.stderr).toBe(0);
    expect(valid.stdout).toContain("raw 引用待核对 0");
    expect(runLint(f.root, { terms: false }).filter((p) => p.rule === "raw-integrity")).toEqual([]);
    for (const failure of ["tampered", "missing"]) {
      if (failure === "tampered") f.write(`wiki/${snapshot}`, "corrupted");
      else f.write("wiki/concepts/x.md", withRawSources(text, [`raw/sha256-${"0".repeat(64)}.md`]));
      const result = f.cli("wiki-audit", ["--seeds", "seeds.yaml"]);
      expect(result.status).toBe(1);
      expect(result.stdout + result.stderr).toMatch(/hash 不符|快照不存在/);
      expect(runLint(f.root, { terms: false }).some((p) => p.rule === "raw-integrity")).toBe(true);
    }
  }, 15000);
  it("accepts a historical line beyond the current checkout", () => {
    const f = setup();
    f.source(`r@${f.old}:a.py#L2`);
    f.write("repo/a.py", "");
    const result = f.cli("wiki-audit", ["--seeds", "seeds.yaml"]);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain("行号有效 1");
  });
  it("does not invent a third line from a trailing newline", () => {
    const f = setup();
    f.source(`r@${f.old}:a.py#L3`);
    f.write("repo/a.py", "one\ntwo\nthree\nfour\n");
    const result = f.cli("wiki-audit", ["--seeds", "seeds.yaml"]);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("out-of-range");
  });
  it("distinguishes an invalid commit from a missing file", () => {
    const f = setup();
    f.source("r@deadbee:a.py#L1");
    const result = f.cli("wiki-audit", ["--seeds", "seeds.yaml"]);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("invalid-commit");
    f.source(`r@${f.old}:missing.py#L1`);
    const missing = f.cli("wiki-audit", ["--seeds", "seeds.yaml"]);
    expect(missing.status).toBe(1);
    expect(missing.stdout).toContain("missing-file");
  });
});
