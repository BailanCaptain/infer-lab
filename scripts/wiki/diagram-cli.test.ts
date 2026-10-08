import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { validateIntegration } from "./integration-check";
import { wikiFixture } from "./test-fixture";

it("rejects an invented Mermaid class through the production lint CLI using a pinned blob", () => {
  const f = wikiFixture();
  try {
    f.write("repo/a.py", "class ModelRunner: pass\n");
    const pin = f.commit("real class");
    f.write(
      "wiki/seeds/vllm-ascend.yaml",
      `repos:\n  r:\n    url: https://example.test/r\n    path: repo\n    refs: {main: ${pin}}\nfeatures: []\n`,
    );
    const body = `---\nid: a\ntitle: A\ntype: source\nsummary: A\nsources: [r@${pin}:a.py#L1]\nevidence: C\nupdated: '2026-09-16'\n---\n## 一句话\n\n源码中的类。[C1]\n\n\`\`\`mermaid\nsequenceDiagram\nparticipant R as ImaginaryRunner\n\`\`\`\n`;
    f.write("wiki/sources/a.md", body);
    const failed = f.cli("wiki-lint", []);
    expect(failed.status).not.toBe(0);
    expect(failed.stdout + failed.stderr).toContain("ImaginaryRunner");
    f.write("wiki/sources/a.md", body.replace("ImaginaryRunner", "ModelRunner"));
    const fixed = f.cli("wiki-lint", []);
    expect(fixed.status, fixed.stdout + fixed.stderr).toBe(0);
    f.write("stage/wiki/sources/a.md", body.replace("ImaginaryRunner", "ModelRunner"));
    expect(validateIntegration(join(f.root, "stage"), { r: join(f.root, "repo") })).toEqual([]);
  } finally {
    f.cleanup();
  }
});

it("rejects an invented wiki-diagram symbol through the production lint CLI, and keeps SVG in step with its spec", () => {
  const f = wikiFixture();
  try {
    f.write("repo/a.py", "class ModelRunner: pass\n");
    const pin = f.commit("real class");
    f.write(
      "wiki/seeds/vllm-ascend.yaml",
      `repos:\n  r:\n    url: https://example.test/r\n    path: repo\n    refs: {main: ${pin}}\nfeatures: []\n`,
    );
    f.write(
      "wiki/sources/a.md",
      `---\nid: a\ntitle: A\ntype: source\nsummary: A\nsources: [r@${pin}:a.py#L1]\nevidence: C\nupdated: '2026-09-19'\n---\n## 一句话\n\n源码中的类。[C1]\n\n\`\`\`wiki-diagram\nfile: demo\n\`\`\`\n`,
    );
    const spec = (symbol: string) =>
      [
        "layout: scene",
        "id: demo",
        "caption: 演示",
        "size: [240, 80]",
        "boxes:",
        `  - { at: [20, 20], size: [200, 40], title: "${symbol}", tone: ascend }`,
        "pins:",
        `  - { source: "r@${pin}:a.py#L1", symbols: [${symbol}] }`,
        "",
      ].join("\n");

    // spec 在、SVG 还没生成时，lint 要拦住——渲染层读的是 SVG
    f.write("wiki/diagrams/demo.yaml", spec("ImaginaryRunner"));
    const noSvg = f.cli("wiki-lint", []);
    expect(noSvg.status).not.toBe(0);
    expect(noSvg.stdout + noSvg.stderr).toContain("diagrams/demo.svg");

    const drawn = f.cli("wiki-diagrams", []);
    expect(drawn.status, drawn.stdout + drawn.stderr).toBe(0);
    const failed = f.cli("wiki-lint", []);
    expect(failed.status).not.toBe(0);
    expect(failed.stdout + failed.stderr).toContain("ImaginaryRunner");

    f.write("wiki/diagrams/demo.yaml", spec("ModelRunner"));
    expect(f.cli("wiki-diagrams", []).status).toBe(0);
    const fixed = f.cli("wiki-lint", []);
    expect(fixed.status, fixed.stdout + fixed.stderr).toBe(0);

    // 派生纪律：spec 没改就不该有改动，手改了 SVG 要被 --check 抓住
    expect(f.cli("wiki-diagrams", ["--check"]).status).toBe(0);
    const svg = join(f.root, "wiki/diagrams/demo.svg");
    writeFileSync(svg, `${readFileSync(svg, "utf8")}<!-- 手改 -->`);
    const stale = f.cli("wiki-diagrams", ["--check"]);
    expect(stale.status).not.toBe(0);
    expect(stale.stdout + stale.stderr).toContain("diagrams/demo.svg");
  } finally {
    f.cleanup();
  }
});
