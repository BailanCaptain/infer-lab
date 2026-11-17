import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { validateIntegration } from "./integration-check";
import { handbookFixture, wikiFixture } from "./test-fixture";

it("wiki:lint 在无外部源码仓（干净克隆 / CI）下零崩溃退出 0，而 wiki:audit 与 validateIntegration 拦住伪造 Mermaid 标识符", () => {
  const f = wikiFixture();
  try {
    f.write("wiki/HANDBOOK.md", handbookFixture());
    f.write("repo/a.py", "class ModelRunner: pass\n");
    const pin = f.commit("real class");
    f.write(
      "wiki/seeds/vllm-ascend.yaml",
      `repos:\n  r:\n    url: https://example.test/r\n    path: repo\n    refs: {main: "${pin}"}\nfeatures: []\n`,
    );
    const body = `---\nid: a\ntitle: A\ntype: source\nsummary: A\nsources: [r@${pin}:a.py#L1]\nevidence: C\nupdated: '2026-09-16'\n---\n## 一句话\n\n源码中的类。[C1]\n\n\`\`\`mermaid\nsequenceDiagram\nparticipant R as ImaginaryRunner\n\`\`\`\n`;
    f.write("wiki/sources/a.md", body);
    f.write("wiki/raw/a.md", `## r@${pin}:a.py#L1\nclass ModelRunner: pass\n`);

    // 审计门禁与准入闭环必须拦住伪造的源码类名
    const auditFailed = f.cli("wiki-audit", ["--seeds", "wiki/seeds/vllm-ascend.yaml"]);
    expect(auditFailed.status).not.toBe(0);
    expect(auditFailed.stdout + auditFailed.stderr).toContain("ImaginaryRunner");

    f.write("stage/wiki/sources/a.md", body);
    f.write("stage/wiki/raw/a.md", `## r@${pin}:a.py#L1\nclass ModelRunner: pass\n`);
    expect(validateIntegration(join(f.root, "stage"), { r: join(f.root, "repo") }).join("\n")).toContain(
      "ImaginaryRunner",
    );

    // 修正标识符后 wiki:audit 与 validateIntegration 均通过
    const fixedBody = body.replace("ImaginaryRunner", "ModelRunner");
    f.write("wiki/sources/a.md", fixedBody);
    const auditFixed = f.cli("wiki-audit", ["--seeds", "wiki/seeds/vllm-ascend.yaml"]);
    expect(auditFixed.status, auditFixed.stdout + auditFixed.stderr).toBe(0);

    f.write("stage/wiki/sources/a.md", fixedBody);
    expect(validateIntegration(join(f.root, "stage"), { r: join(f.root, "repo") })).toEqual([]);

    // 删除外部源码仓目录模拟干净克隆 / CI：wiki:lint 不依赖外部 git blob，必须零崩溃返回 0
    rmSync(join(f.root, "repo"), { recursive: true, force: true });
    const cleanCloneLint = f.cli("wiki-lint", []);
    expect(cleanCloneLint.status, cleanCloneLint.stdout + cleanCloneLint.stderr).toBe(0);
  } finally {
    f.cleanup();
  }
}, 20000);

it("wiki:lint 保留纯静态缺图检查 [diagram-missing]，wiki:audit 与 validateIntegration 按图去重拦截伪造 spec 符号", () => {
  const f = wikiFixture();
  try {
    f.write("wiki/HANDBOOK.md", handbookFixture());
    f.write("repo/a.py", "class ModelRunner: pass\n");
    const pin = f.commit("real class");
    f.write(
      "wiki/seeds/vllm-ascend.yaml",
      `repos:\n  r:\n    url: https://example.test/r\n    path: repo\n    refs: {main: "${pin}"}\nfeatures: []\n`,
    );
    const pageDoc = (id: string) =>
      `---\nid: ${id}\ntitle: ${id.toUpperCase()}\ntype: source\nsummary: ${id}\nsources: [r@${pin}:a.py#L1]\nevidence: C\nupdated: '2026-09-19'\n---\n## 一句话\n\n源码中的类。[C1]\n\n\`\`\`wiki-diagram\nfile: demo\n\`\`\`\n`;
    f.write("wiki/sources/a.md", pageDoc("a"));
    f.write("wiki/sources/b.md", pageDoc("b"));
    f.write("wiki/raw/a.md", `## r@${pin}:a.py#L1\nclass ModelRunner: pass\n`);
    f.write("wiki/raw/b.md", `## r@${pin}:a.py#L1\nclass ModelRunner: pass\n`);

    // 1. 正文引用了不存在的 demo.yaml 时，纯静态 wiki:lint（即使无外部仓）也必须报 diagram-missing
    const missingSpec = f.cli("wiki-lint", []);
    expect(missingSpec.status).not.toBe(0);
    expect(missingSpec.stdout + missingSpec.stderr).toContain("demo.yaml");

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

    // 2. spec 在、SVG 还没生成时，纯静态 wiki:lint 必须拦住
    f.write("wiki/diagrams/demo.yaml", spec("ImaginaryRunner"));
    const noSvg = f.cli("wiki-lint", []);
    expect(noSvg.status).not.toBe(0);
    expect(noSvg.stdout + noSvg.stderr).toContain("diagrams/demo.svg");

    const drawn = f.cli("wiki-diagrams", []);
    expect(drawn.status, drawn.stdout + drawn.stderr).toBe(0);

    // 3. SVG 生成后纯静态 wiki:lint 通过；伪造符号由 wiki:audit 与 validateIntegration 按图去重（2 页共用只报 1 次）拦截
    const lintOk = f.cli("wiki-lint", []);
    expect(lintOk.status, lintOk.stdout + lintOk.stderr).toBe(0);

    const auditFailed = f.cli("wiki-audit", ["--seeds", "wiki/seeds/vllm-ascend.yaml"]);
    expect(auditFailed.status).not.toBe(0);
    const matches = (auditFailed.stdout + auditFailed.stderr).match(/ImaginaryRunner/g) ?? [];
    expect(matches).toHaveLength(1);

    const stageProblems = validateIntegration(f.root, { r: join(f.root, "repo") });
    expect(stageProblems.filter((p) => p.includes("ImaginaryRunner"))).toHaveLength(1);

    // 4. 修正符号并重绘后，wiki:audit、validateIntegration 与 wiki:diagrams --check 全部通过
    f.write("wiki/diagrams/demo.yaml", spec("ModelRunner"));
    expect(f.cli("wiki-diagrams", []).status).toBe(0);
    const auditFixed = f.cli("wiki-audit", ["--seeds", "wiki/seeds/vllm-ascend.yaml"]);
    expect(auditFixed.status, auditFixed.stdout + auditFixed.stderr).toBe(0);
    expect(validateIntegration(f.root, { r: join(f.root, "repo") })).toEqual([]);

    expect(f.cli("wiki-diagrams", ["--check"]).status).toBe(0);
    const svg = join(f.root, "wiki/diagrams/demo.svg");
    writeFileSync(svg, `${readFileSync(svg, "utf8")}<!-- 手改 -->`);
    const stale = f.cli("wiki-diagrams", ["--check"]);
    expect(stale.status).not.toBe(0);
    expect(stale.stdout + stale.stderr).toContain("diagrams/demo.svg");
  } finally {
    f.cleanup();
  }
}, 25000);

it("native-svg CLI 与下游链路：连续两次 wiki-diagrams 保留原字节、损坏 XML 拒绝且不改写，snapshot/evidence/AC11 共同消费", async () => {
  const { readKnowledgeSnapshot, readLockedEvidenceSnapshot } = await import("../../server/snapshot");
  const { buildPageEvidenceFromLocked } = await import("./evidence");
  const { runBuild } = await import("./build");
  const f = wikiFixture();
  try {
    f.write("wiki/HANDBOOK.md", handbookFixture());
    f.write("repo/a.py", "def compute_native_step():\n    return 42\n");
    const pin = f.commit("native pin");
    f.write(
      "wiki/seeds/vllm-ascend.yaml",
      `repos:\n  r:\n    url: https://example.test/r\n    path: repo\n    refs: {main: "${pin}"}\nfeatures: []\n`,
    );
    f.write(
      "wiki/sources/native-page.md",
      `---\nid: native-page\ntitle: 原生图页\ntype: source\nsummary: 验收原生图\nsources: ["https://example.test/doc"]\nevidence: I\nupdated: '2026-11-16'\n---\n## 机制\n\n\`\`\`wiki-diagram\nfile: native-flow\n\`\`\`\n`,
    );
    const nativeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200" width="600" height="200" role="img"><title>原生流向图</title><!-- keep exact human bytes -->\n  <rect x="16" y="16" width="568" height="168" fill="var(--color-surface)" stroke="currentColor"/>\n  <text x="300" y="108" text-anchor="middle" font-family="var(--font-mono)" font-size="14">compute_native_step()</text>\n</svg>\n`;
    const makeYaml = (sym: string) =>
      [
        "mode: native-svg",
        "id: native-flow",
        "caption: 原生流向图",
        "size: [600, 200]",
        "pins:",
        `  - { source: "r@${pin}:a.py#L1-L2", symbols: [${sym}] }`,
        "",
      ].join("\n");
    f.write("wiki/diagrams/native-flow.yaml", makeYaml("compute_native_step"));
    f.write("wiki/diagrams/native-flow.svg", nativeSvg);
    runBuild(f.root);

    expect(f.cli("wiki-diagrams", ["--check"]).status).toBe(0);
    expect(f.cli("wiki-diagrams", []).status).toBe(0);
    expect(f.cli("wiki-diagrams", []).status).toBe(0);
    expect(readFileSync(join(f.root, "wiki/diagrams/native-flow.svg"), "utf8")).toBe(nativeSvg);

    expect(f.cli("wiki-audit", ["--seeds", "wiki/seeds/vllm-ascend.yaml"]).status).toBe(0);
    f.write("wiki/diagrams/native-flow.yaml", makeYaml("invented_native_step"));
    const badAudit = f.cli("wiki-audit", ["--seeds", "wiki/seeds/vllm-ascend.yaml"]);
    expect(badAudit.status).not.toBe(0);
    expect(badAudit.stdout + badAudit.stderr).toContain("invented_native_step");
    f.write("wiki/diagrams/native-flow.yaml", makeYaml("compute_native_step"));

    const snap = await readKnowledgeSnapshot(f.root);
    expect(snap.diagrams).toEqual([{ id: "native-flow", svg: nativeSvg }]);
    const locked = await readLockedEvidenceSnapshot(f.root);
    const pack = buildPageEvidenceFromLocked(f.root, locked, "native-page")!;
    expect(pack.diagrams[0]?.pins[0]?.symbols).toEqual(["compute_native_step"]);
    expect(pack.entries[`r@${pin}:a.py#L1-L2`]).toMatchObject({
      status: "ok",
      lines: [
        { number: 1, text: "def compute_native_step():" },
        { number: 2, text: "    return 42" },
      ],
    });

    // 损坏 XML（无引号属性）：CLI 与 snapshot 均须拒绝，且不得静默修复原文件字节
    const malformed = nativeSvg.replace('width="568"', "width=568");
    f.write("wiki/diagrams/native-flow.svg", malformed);
    expect(f.cli("wiki-diagrams", ["--check"]).status).not.toBe(0);
    expect(f.cli("wiki-diagrams", []).status).not.toBe(0);
    expect(readFileSync(join(f.root, "wiki/diagrams/native-flow.svg"), "utf8")).toBe(malformed);
    await expect(readKnowledgeSnapshot(f.root)).rejects.toThrow("图 spec 不合法");
  } finally {
    f.cleanup();
  }
}, 25000);
