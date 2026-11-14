import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, expect, it } from "vitest";
import { saveRawSnapshot } from "../scripts/wiki/raw";
import { handbookFixture, wikiFixture } from "../scripts/wiki/test-fixture";
import { readKnowledgeSnapshot, readReaderSnapshot } from "./snapshot";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => fixtures.splice(0).forEach((f) => f.cleanup()));
const setup = () => {
  const f = wikiFixture(); fixtures.push(f);
  f.write("wiki/HANDBOOK.md", handbookFixture());
  const raw = saveRawSnapshot(join(f.root, "wiki"), "固定原文\n");
  f.write("wiki/sources/a.md", `---\nid: a\ntitle: A\ntype: source\nsummary: 快照测试\nsources: [raw:${raw.slice(4)}#L1]\nevidence: I\nupdated: '2026-11-10'\n---\n## 标题\n\n原始正文。\n`);
  return { ...f, raw };
};
function fresh(root: string) {
  const url = pathToFileURL(join(process.cwd(), "server/snapshot.ts")).href;
  return JSON.parse(execFileSync(process.execPath, ["--import", import.meta.resolve("tsx"), "--input-type=module", "-e", `import {readKnowledgeSnapshot} from ${JSON.stringify(url)}; const s=await readKnowledgeSnapshot(process.cwd()); console.log(JSON.stringify({revision:s.revision, text:s.pageTexts[0]?.text, compiled:s.compiledPages[s.pageTexts[0]?.file], index:s.index.exact instanceof Map}));`], { cwd: root, windowsHide: true, encoding: "utf8", timeout: 20_000, stdio: ["ignore", "pipe", "pipe"] }));
}
it("a fresh process shares the compiled snapshot and still observes changed, added and removed pages", async () => {
  const f = setup();
  const first = await readKnowledgeSnapshot(f.root);
  expect(existsSync(join(f.root, "tools/wiki-runtime/reader-snapshot.bin"))).toBe(true);
  expect(fresh(f.root)).toMatchObject({ revision: first.revision, compiled: { type: "root" }, index: true });
  const path = join(f.root, "wiki/sources/a.md");
  const original = readFileSync(path, "utf8");
  const originalTime = statSync(path).mtime;
  writeFileSync(path, original.replace("原始正文", "修改正文"));
  utimesSync(path, originalTime, originalTime);
  const changed = fresh(f.root);
  expect(changed.revision).not.toBe(first.revision);
  expect(changed.text).toContain("修改正文");
  expect(JSON.stringify(changed.compiled)).toContain("修改正文");
  f.write("wiki/sources/b.md", original.replace("id: a", "id: b"));
  const added = fresh(f.root);
  expect(added.revision).not.toBe(changed.revision);
  rmSync(join(f.root, "wiki/sources/b.md"));
  expect(fresh(f.root).revision).toBe(changed.revision);
});
it("a corrupt shared cache is rebuilt, while altered raw evidence is still rejected", async () => {
  const f = setup(); const snapshot = await readKnowledgeSnapshot(f.root);
  writeFileSync(join(f.root, "tools/wiki-runtime/reader-snapshot.bin"), "broken cache");
  expect(fresh(f.root).revision).toBe(snapshot.revision);
  writeFileSync(join(f.root, "wiki", f.raw), "被改原文\n");
  expect(() => fresh(f.root)).toThrow();
});
it("a shared reader cache containing skipped pages cannot become a valid chat snapshot", async () => {
  const f = setup();
  f.write("wiki/sources/b.md", "---\nid: b\ntitle: 未写完\n---\n临时草稿");
  expect((await readReaderSnapshot(f.root)).skipped).toHaveLength(1);
  expect(() => fresh(f.root)).toThrow();
});
