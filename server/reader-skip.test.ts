import { rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { handbookFixture, wikiFixture } from "../scripts/wiki/test-fixture";
import { readKnowledgeSnapshot, readReaderSnapshot } from "./snapshot";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});

const page = (id: string, extra = "", body = "## 一句话\n\n能读。\n") =>
  `---\nid: ${id}\ntitle: ${id} 页\ntype: source\nsummary: ${id} 页\nsources: ["https://example.com/${id}"]\nevidence: I\nupdated: '2026-10-02'\n${extra}---\n${body}`;

/** 一页好页，外加写手写到一半会留下的三种坏页 */
function fixtureWithBadPages() {
  const f = wikiFixture();
  fixtures.push(f);
  f.write("wiki/HANDBOOK.md", handbookFixture());
  // 好页还挂着一条指向坏页的边：坏页被拿掉，好页也得照常给出
  f.write(
    "wiki/sources/good.md",
    page("good", "relations:\n  - { to: bad, kind: builds-on, note: 建在坏页上 }\n"),
  );
  f.write("wiki/sources/bad.md", "---\nid: bad\ntitle: 写到一半\n---\n");
  f.write("wiki/sources/broken.md", "---\nid: broken\ntitle: [没写完\n---\n");
  f.write("wiki/sources/ghost.md", page("ghost", "", "```wiki-diagram\nfile: ghost-figure\n```\n"));
  return f;
}

it("读者快照跳过不合法的页、记下原因，好页照常给出；问答仍整份拒绝", async () => {
  const f = fixtureWithBadPages();
  // 先红：2026-10-02 前读者也走这条严格路径，一页不合法整站打不开
  await expect(readKnowledgeSnapshot(f.root)).rejects.toThrow("知识库页面不合法");

  const snapshot = await readReaderSnapshot(f.root);
  expect(snapshot.registry.pages.map((p) => p.id)).toEqual(["good"]);
  expect(snapshot.pageTexts.map((p) => p.file)).toEqual(["sources/good.md"]);
  const reasons = new Map(snapshot.skipped.map((p) => [p.id, p]));
  expect([...reasons.keys()].sort()).toEqual(["bad", "broken", "ghost"]);
  expect(reasons.get("bad")).toMatchObject({
    file: "sources/bad.md",
    reason: expect.stringContaining("summary"),
  });
  expect(reasons.get("broken")?.reason).toContain("[schema]");
  expect(reasons.get("ghost")?.reason).toContain("ghost-figure");
});

it("没有坏页时，读者快照与问答快照是同一个 revision", async () => {
  const f = fixtureWithBadPages();
  for (const id of ["bad", "broken", "ghost"]) rmSync(join(f.root, `wiki/sources/${id}.md`));
  const reader = await readReaderSnapshot(f.root);
  expect(reader.skipped).toEqual([]);
  expect(reader.revision).toBe((await readKnowledgeSnapshot(f.root)).revision);
});

it("保留被跳过页（schema-invalid 与缺图两类）的规范 ID 占位，禁止其他健康页用 legacyIds 抢占", async () => {
  // 1) schema-invalid 坏页：unavailable.md 仅 type 非法进入 skipped，healthy.md 声明 legacyIds: [unavailable] 必须拒绝
  const fSchema = wikiFixture();
  fixtures.push(fSchema);
  fSchema.write("wiki/HANDBOOK.md", handbookFixture());
  fSchema.write("wiki/sources/healthy.md", page("healthy", "legacyIds:\n  - unavailable\n"));
  fSchema.write("wiki/sources/unavailable.md", page("unavailable").replace("type: source", "type: INVALID"));
  await expect(readReaderSnapshot(fSchema.root)).rejects.toThrow(/legacyIds/);

  // 2) missing-diagram 坏页：ghost.md frontmatter 合法但缺图进入 skipped，healthy.md 声明 legacyIds: [ghost] 同样必须拒绝
  const fDiagram = wikiFixture();
  fixtures.push(fDiagram);
  fDiagram.write("wiki/HANDBOOK.md", handbookFixture());
  fDiagram.write("wiki/sources/healthy.md", page("healthy", "legacyIds:\n  - ghost\n"));
  fDiagram.write("wiki/sources/ghost.md", page("ghost", "", "```wiki-diagram\nfile: missing-fig\n```\n"));
  await expect(readReaderSnapshot(fDiagram.root)).rejects.toThrow(/legacyIds/);

  // 3) 对照：healthy.md 声明与被跳过页无关的 legacyIds: [former-healthy] 时，坏页仍正常 skip、健康页正常可读
  fSchema.write("wiki/sources/healthy.md", page("healthy", "legacyIds:\n  - former-healthy\n"));
  const cleanSkip = await readReaderSnapshot(fSchema.root);
  expect(cleanSkip.registry.pages.map((p) => p.id)).toEqual(["healthy"]);
  expect(cleanSkip.skipped.map((p) => p.id)).toEqual(["unavailable"]);
});
