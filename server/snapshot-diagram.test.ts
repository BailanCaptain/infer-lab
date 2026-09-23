import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { runBuild } from "../scripts/wiki/build";
import { diagramSpecSchema, renderDiagram } from "../scripts/wiki/diagrams";
import { saveRawSnapshot } from "../scripts/wiki/raw";
import { handbookFixture, wikiFixture } from "../scripts/wiki/test-fixture";
import { readKnowledgeSnapshot } from "./snapshot";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});

const SPEC = [
  "layout: scene",
  "id: demo",
  "caption: 演示",
  "size: [240, 80]",
  "boxes:",
  '  - { at: [20, 20], size: [200, 40], title: "入口", tone: neutral }',
  "",
].join("\n");

function fixtureWithDiagram() {
  const f = wikiFixture();
  fixtures.push(f);
  f.write(
    "wiki/HANDBOOK.md",
    handbookFixture(),
  );
  const raw = saveRawSnapshot(join(f.root, "wiki"), "图说明了入口在哪里。\n");
  f.write(
    "wiki/sources/a.md",
    `---\nid: a\ntitle: 有图的页\ntype: source\nsummary: 有图的页\nsources: [raw:${raw.slice(4)}#L1]\nevidence: I\nupdated: '2026-09-19'\n---\n## 一句话\n\n看图。\n\n\`\`\`wiki-diagram\nfile: demo\n\`\`\`\n`,
  );
  f.write("wiki/diagrams/demo.yaml", SPEC);
  f.write("wiki/diagrams/demo.svg", renderDiagram(diagramSpecSchema.parse(parseYaml(SPEC))));
  runBuild(f.root);
  return f;
}

it("图进快照：spec 与 SVG 都随页面送达，改了图就换 revision", async () => {
  const f = fixtureWithDiagram();
  const first = await readKnowledgeSnapshot(f.root);
  // 问答 agent 的 cwd 就是这批文件——spec 在里面，它才读得出谁指向谁
  expect(first.files.map((x) => x.file)).toContain("diagrams/demo.yaml");
  expect(first.files.map((x) => x.file)).toContain("diagrams/demo.svg");
  expect(first.diagrams).toEqual([{ id: "demo", svg: expect.stringContaining("<title>演示</title>") }]);

  // 先红后绿的那条红：SVG 不进 digest 时，改了画面 revision 不变，
  // 问答会拿旧版本号引用新图。
  const svg = join(f.root, "wiki/diagrams/demo.svg");
  writeFileSync(svg, readFileSync(svg, "utf8").replace("演示", "改过的说明"));
  const afterSvg = await readKnowledgeSnapshot(f.root);
  expect(afterSvg.revision).not.toBe(first.revision);

  writeFileSync(join(f.root, "wiki/diagrams/demo.yaml"), SPEC.replace("入口", "另一个入口"));
  const afterSpec = await readKnowledgeSnapshot(f.root);
  expect(afterSpec.revision).not.toBe(afterSvg.revision);
});

it("正文引用了不存在的图就不给出快照，而不是静静少一张图", async () => {
  const f = fixtureWithDiagram();
  writeFileSync(
    join(f.root, "wiki/sources/a.md"),
    readFileSync(join(f.root, "wiki/sources/a.md"), "utf8").replace("file: demo", "file: ghost"),
  );
  await expect(readKnowledgeSnapshot(f.root)).rejects.toThrow("ghost");
});

it("spec 不合法就不给出快照", async () => {
  const f = fixtureWithDiagram();
  writeFileSync(join(f.root, "wiki/diagrams/demo.yaml"), "id: demo\ncaption: 演示\nsize: [1, 1]\n");
  await expect(readKnowledgeSnapshot(f.root)).rejects.toThrow("图 spec 不合法");
});
