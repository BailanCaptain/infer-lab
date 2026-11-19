import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyWikiAstMigrationPlan,
  buildWikiAstMigrationPlan,
  planPageAstMigration,
  renderPlanPreviewText,
} from "./ast-migrate";

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const sha256 = (buf: Buffer | string) => createHash("sha256").update(buf).digest("hex");

describe("1160 AST migration read-only planner & disambiguation", () => {
  it("handles deterministic ordinals, lists, explicit ranges, code-line ranges, ambiguous comma ranges, narrative/param-table rules, and non-citable sources", () => {
    const raw = [
      "---",
      "id: sample-feature",
      "title: Sample Feature",
      "type: feature",
      "summary: 教学摘要保持原样",
      "aliases:",
      "  - 示例特性",
      "sources:",
      "  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L10-L20",
      "  - https://docs.vllm.ai/en/latest/configuration/optimization.html",
      "  - vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L30-L45",
      "  - vllm@0fc695fc:docs/configuration/optimization.md#L1-L15",
      "  - raw:sha256-0370306fb60f343548703a516fee1aa7c9045e1252a0df37a27d6d1bcfd47cbe.md#L1-L10",
      "  - https://example.org/blog/post",
      "verified:",
      "  - releases/v0.23.0",
      'evidence: "C"',
      "relations: []",
      "updated: '2026-10-06'",
      "---",
      "",
      "## 核心机制",
      "",
      "教学叙述里提到来源 1 只作自然语言交代，绝不插入机器角标；公式 $a + b = 来源 1$ 与行内代码 `来源 2` 及 [已有链接](other.md#来源-1) 原样不动。",
      "",
      "```wiki-scene",
      "inference-mechanism:7",
      "```",
      "",
      "```python",
      "# 来源 1 伪代码注释与伪标题都不动",
      "## 对照源码",
      "x = 1  # 来源 2",
      "```",
      "",
      "## 参数定义（自动生成）",
      "",
      "自动生成区内提到来源 1 与 **v0.30.0rc2 对照：** 必须整节保护至下一真实 H2。",
      "",
      "## 对照源码",
      "",
      "- 单条源码与官方文档：见来源 1，另见来源 1、2 与仓库内文档来源 4。",
      "- 显式来源区间：结合来源 1–3 的完整链路。",
      "- 显式代码行号：缺少清单时抛错（来源 3，262–274 行），且来源 1 的 10–20 行保持不变。",
      "- 歧义行段不误展：延期返回仍须检查（来源2，303–345）。",
      "- 越界与不可判定来源：来源 0、来源 999、本地快照来源 5、白名单外来源 6 均不臆造角标。",
      "- HTML 保护：<span>来源 1</span> 不改写。",
      "",
    ].join("\n");

    const plan = planPageAstMigration("concepts/sample-feature.md", raw);
    expect(plan.inputByteSha256).toBe(sha256(Buffer.from(raw, "utf8")));

    const preview = renderPlanPreviewText(raw, plan);
    // 1) Frontmatter、sources 顺序、verified、教学叙述、公式、代码、自动生成区、HTML 完全保留原字节
    expect(preview.slice(0, raw.indexOf("## 对照源码\n\n- 单条源码"))).toBe(
      raw.slice(0, raw.indexOf("## 对照源码\n\n- 单条源码")),
    );
    // 2) 对照源码区确定性角标：repo -> C，official / :docs/ -> S，区间完整展开，行号区间绝不吞成来源号
    expect(preview).toContain(
      "- 单条源码与官方文档：见来源 1 [C1]，另见来源 1、2 [C1][S2] 与仓库内文档来源 4 [S4]。",
    );
    expect(preview).toContain("- 显式来源区间：结合来源 1–3 [C1][S2][C3] 的完整链路。");
    expect(preview).toContain(
      "- 显式代码行号：缺少清单时抛错（来源 3 [C3]，262–274 行），且来源 1 [C1] 的 10–20 行保持不变。",
    );
    // 3) 歧义行段、越界编号、raw/unlisted、HTML 原样不动并记入 manualItems
    expect(preview).toContain("- 歧义行段不误展：延期返回仍须检查（来源2，303–345）。");
    expect(preview).toContain(
      "- 越界与不可判定来源：来源 0、来源 999、本地快照来源 5、白名单外来源 6 均不臆造角标。",
    );
    expect(preview).toContain("- HTML 保护：<span>来源 1</span> 不改写。");

    const manualKinds = new Set(plan.manualItems.map((m) => m.kind));
    expect(manualKinds.has("narrative-source-reference")).toBe(true);
    expect(manualKinds.has("ambiguous-code-line-context")).toBe(true);
    expect(manualKinds.has("invalid-source-ordinal")).toBe(true);
    expect(manualKinds.has("non-citable-or-raw-source-kind")).toBe(true);

    // 4) 二次规划严格幂等（0 新增拟议编辑）
    const secondPlan = planPageAstMigration("concepts/sample-feature.md", preview);
    expect(secondPlan.proposedEdits).toHaveLength(0);
    expect(renderPlanPreviewText(preview, secondPlan)).toBe(preview);
  });

  it("enforces narrow param facts-table rule, ends generated-section protection at next real H2, and preserves BOM + CRLF + astral UTF-16 offsets", () => {
    const crlfRaw = `\uFEFF${[
      "---",
      "id: sample-param",
      "title: sample_param",
      "type: param",
      "summary: 参数摘要 🧪",
      "sources:",
      "  - vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L120-L130",
      "  - https://docs.vllm.ai/projects/ascend/en/latest/user_guide/configuration/additional_config.html",
      'evidence: "C"',
      "relations: []",
      "updated: '2026-10-06'",
      "---",
      "",
      "## 一句话",
      "",
      "**v0.30.0rc2 对照：** 开篇版本补丁段默认不盲目搬移，保留全部就地条件 🧪🚀。",
      "",
      "说明正文里提到来源 1 属于教学叙述，不加角标。",
      "",
      "## 事实表",
      "",
      "| 项 | 值 | 意味着什么 |",
      "|---|---|---|",
      "| 默认行为 | `False` | 静态定义见来源 1，官方说明见来源 2 |",
      "",
      "## 版本谱系",
      "",
      "| 版本 | 定义是否存在 | 固定提交 |",
      "|---|---|---|",
      "| main | 有（来源 1 保护不动） | `baa023ad` |",
      "",
      "```markdown",
      "## 对照源码",
      "围栏内伪标题来源 1 绝不触发解保",
      "```",
      "",
      "## 对照源码",
      "",
      "真实下一 H2 恢复解析：核验入口见来源 1。",
      "",
    ].join("\r\n")}`;

    const plan = planPageAstMigration("params/sample-param.md", crlfRaw);
    expect(plan.hasBom).toBe(true);
    expect(plan.lineEnding).toBe("CRLF");
    // 版本补丁段被精确盘点，但未显式选中时不自动搬移
    expect(plan.versionParagraphs).toHaveLength(1);
    expect(plan.versionParagraphs[0]!.disposition).toBe("manual-phase-two");

    const preview = renderPlanPreviewText(crlfRaw, plan);
    expect(preview.startsWith("\uFEFF---\r\n")).toBe(true);
    expect(preview.includes("\r\n")).toBe(true);
    // 1) 参数事实表单元格允许确定性补充角标
    expect(preview).toContain("| 默认行为 | `False` | 静态定义见来源 1 [C1]，官方说明见来源 2 [S2] |\r\n");
    // 2) 自动生成区（版本谱系）及代码围栏内伪标题保持原样，而真实下一 H2（## 对照源码）恢复处理
    expect(preview).toContain("| main | 有（来源 1 保护不动） | `baa023ad` |\r\n");
    expect(preview).toContain("围栏内伪标题来源 1 绝不触发解保\r\n");
    expect(preview).toContain("真实下一 H2 恢复解析：核验入口见来源 1 [C1]。\r\n");
    // 3) 教学叙述中的来源 1 与版本补丁段保持原字节不变
    expect(preview).toContain("说明正文里提到来源 1 属于教学叙述，不加角标。\r\n");
    expect(preview).toContain(
      "**v0.30.0rc2 对照：** 开篇版本补丁段默认不盲目搬移，保留全部就地条件 🧪🚀。\r\n",
    );
  });

  it("satisfies all 6 version-patch paragraph selection invariants (byte-for-byte retention, duplicate prefix safety, missing destination, idempotence)", () => {
    const docWithDest = [
      "---",
      "id: move-demo",
      "title: Move Demo",
      "type: concept",
      "summary: 摘要",
      "sources:",
      "  - vllm@0fc695fc:vllm/config/model.py#L1-L10",
      'evidence: "C"',
      "relations: []",
      "updated: '2026-10-06'",
      "---",
      "",
      "## 核心原理",
      "",
      "**v0.30.0rc2 对照：** 第一处同前缀段落，含 `code` 与限定条件 A，仅在精确选中时整段原样搬移。",
      "",
      "主干保留段落。",
      "",
      "**v0.30.0rc2 对照：** 第二处同前缀段落，含限定条件 B，未被选中时绝不连带误移。",
      "",
      "## 对照源码",
      "",
      "### 版本差异",
      "",
      "既有四版说明。",
      "",
    ].join("\n");

    // 1) 仅传模糊 prefix 匹配到 2 处同前缀段落时，拒绝盲搬并记入 manualItems
    const ambiguousPlan = planPageAstMigration("concepts/move-demo.md", docWithDest, {
      selectedMoves: [{ file: "concepts/move-demo.md", prefix: "v0.30.0rc2 对照：" }],
    });
    expect(ambiguousPlan.stats.proposedParagraphMoves).toBe(0);
    expect(ambiguousPlan.manualItems.some((m) => m.kind === "ambiguous-paragraph-selection")).toBe(true);

    // 2) 按精确 AST 偏移 + blockSha256 选中第一段：整段逐字节保留迁入 ### 版本差异，第二段原样不动
    const inv0 = ambiguousPlan.versionParagraphs[0]!;
    const exactParagraphText = docWithDest.slice(inv0.startOffset, inv0.endOffset);
    const movePlan = planPageAstMigration("concepts/move-demo.md", docWithDest, {
      selectedMoves: [
        {
          file: "concepts/move-demo.md",
          startOffset: inv0.startOffset,
          endOffset: inv0.endOffset,
          blockSha256: inv0.blockSha256,
        },
      ],
    });
    expect(movePlan.stats.proposedParagraphMoves).toBe(1);
    const movedText = renderPlanPreviewText(docWithDest, movePlan);
    expect(movedText).toContain("主干保留段落。\n\n**v0.30.0rc2 对照：** 第二处同前缀段落");
    const sourceCheckAt = movedText.indexOf("## 对照源码");
    expect(movedText.slice(0, sourceCheckAt)).not.toContain("第一处同前缀段落");
    expect(movedText.slice(sourceCheckAt)).toContain(exactParagraphText);

    // 3) 对已搬移结果再次规划：不重复搬移、不产生副本
    const repeatPlan = planPageAstMigration("concepts/move-demo.md", movedText, {
      selectedMoves: [{ file: "concepts/move-demo.md", blockSha256: inv0.blockSha256 }],
    });
    expect(repeatPlan.stats.proposedParagraphMoves).toBe(0);

    // 4) 缺少 ## 对照源码 承接小节时显式报告 missing-move-destination 且 0 写入
    const docWithoutDest = docWithDest.slice(0, docWithDest.indexOf("## 对照源码"));
    const invNoDest = planPageAstMigration("concepts/no-dest.md", docWithoutDest).versionParagraphs[0]!;
    const noDestPlan = planPageAstMigration("concepts/no-dest.md", docWithoutDest, {
      selectedMoves: [
        {
          file: "concepts/no-dest.md",
          startOffset: invNoDest.startOffset,
          endOffset: invNoDest.endOffset,
          blockSha256: invNoDest.blockSha256,
        },
      ],
    });
    expect(noDestPlan.stats.proposedParagraphMoves).toBe(0);
    expect(noDestPlan.manualItems.some((m) => m.kind === "missing-move-destination")).toBe(true);
  });

  it("verifies all 5 real 1100 disambiguation cases and runs default dry-run CLI with zero file mutations", () => {
    const repoRoot = join(import.meta.dirname, "../..");
    const readPreMigration1100 = (rel: string) =>
      execFileSync("git", ["show", `8327b37:wiki/${rel}`], { cwd: repoRoot });

    const netloader = readPreMigration1100("concepts/netloader-guide.md");
    const netPlan = planPageAstMigration("concepts/netloader-guide.md", netloader);
    // 来源 13，262–274 行 -> 仅识别来源 13，绝不把 262..274 当作越界来源号
    expect(netPlan.manualItems.some((m) => m.kind === "invalid-source-ordinal")).toBe(false);
    expect(
      netPlan.proposedEdits.some((e) => e.beforeText === "来源 13" && e.afterText === "来源 13 [C13]"),
    ).toBe(true);

    for (const rel of [
      "concepts/rfork-lifecycle.md",
      "concepts/rfork-transfer.md",
      "concepts/rfork-troubleshooting.md",
    ]) {
      const buf = readPreMigration1100(rel);
      const p = planPageAstMigration(rel, buf);
      expect(p.manualItems.some((m) => m.kind === "invalid-source-ordinal")).toBe(false);
      expect(p.manualItems.some((m) => m.kind === "ambiguous-code-line-context")).toBe(true);
    }

    // CLI 默认 dry-run 在隔离目录运行：退出码 0、生成 JSON 计划报告、原 Markdown 字节 100% 不变
    const tmp = mkdtempSync(join(tmpdir(), "wiki-ast-cli-"));
    tempDirs.push(tmp);
    const wikiDir = join(tmp, "wiki", "concepts");
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(wikiDir, { recursive: true });
    const mdPath = join(wikiDir, "netloader-guide.md");
    writeFileSync(mdPath, netloader);
    const beforeSha = sha256(readFileSync(mdPath));
    const outJson = join(tmp, "plan.json");

    const directReport = buildWikiAstMigrationPlan(join(tmp, "wiki"));
    expect(directReport.pageCount).toBe(1);
    expect(directReport.pages[0]!.inputByteSha256).toBe(beforeSha);

    const res = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/wiki-ast-migrate.ts", "--wiki-root", join(tmp, "wiki"), "--out", outJson],
      { cwd: join(import.meta.dirname, "../.."), encoding: "utf8" },
    );
    expect(res.status, res.stderr).toBe(0);
    expect(sha256(readFileSync(mdPath))).toBe(beforeSha);
    const report = JSON.parse(readFileSync(outJson, "utf8"));
    expect(report.mode).toBe("dry-run-plan");
    expect(report.pageCount).toBe(1);
    expect(report.pages[0].inputByteSha256).toBe(beforeSha);
  });
});

describe("1163 AST read-only planner P2 closures", () => {
  it("P2-1: rejects Windows case-variant, directory junction, and file hardlink output aliases without mutating any input article", () => {
    const repoRoot = join(import.meta.dirname, "../..");
    const netloader = readFileSync(new URL("../../wiki/concepts/netloader-guide.md", import.meta.url));
    const tmp = mkdtempSync(join(tmpdir(), "wiki-ast-alias-"));
    tempDirs.push(tmp);
    const wikiRoot = join(tmp, "wiki");
    mkdirSync(join(wikiRoot, "concepts"), { recursive: true });
    const articlePath = join(wikiRoot, "concepts", "netloader-guide.md");
    writeFileSync(articlePath, netloader);
    const beforeSha = sha256(readFileSync(articlePath));

    const runCli = (outArg: string) =>
      spawnSync(
        process.execPath,
        ["--import", "tsx", "scripts/wiki-ast-migrate.ts", "--wiki-root", wikiRoot, "--out", outArg],
        { cwd: repoRoot, encoding: "utf8", windowsHide: true },
      );

    if (process.platform === "win32") {
      const upperArticleOut = join(tmp, "WIKI", "concepts", "netloader-guide.md");
      const rCase = runCli(upperArticleOut);
      expect(rCase.status).not.toBe(0);
      expect(sha256(readFileSync(articlePath))).toBe(beforeSha);

      const upperNewOut = join(tmp, "WIKI", "nested", "report.json");
      const rCaseNew = runCli(upperNewOut);
      expect(rCaseNew.status).not.toBe(0);
      expect(existsSync(join(wikiRoot, "nested", "report.json"))).toBe(false);
    }

    const junctionDir = join(tmp, "report-junction");
    symlinkSync(wikiRoot, junctionDir, "junction");
    const rJunctionArticle = runCli(join(junctionDir, "concepts", "netloader-guide.md"));
    expect(rJunctionArticle.status).not.toBe(0);
    expect(sha256(readFileSync(articlePath))).toBe(beforeSha);

    const rJunctionNew = runCli(join(junctionDir, "plan.json"));
    expect(rJunctionNew.status).not.toBe(0);
    expect(existsSync(join(wikiRoot, "plan.json"))).toBe(false);

    const hardlinkOut = join(tmp, "hardlinked-report.json");
    linkSync(articlePath, hardlinkOut);
    const rHardlink = runCli(hardlinkOut);
    expect(rHardlink.status).not.toBe(0);
    expect(sha256(readFileSync(articlePath))).toBe(beforeSha);

    const validExternalOut = join(tmp, "external-out", "plan.json");
    const rValid = runCli(validExternalOut);
    expect(rValid.status, rValid.stderr).toBe(0);
    expect(sha256(readFileSync(articlePath))).toBe(beforeSha);
    expect(JSON.parse(readFileSync(validExternalOut, "utf8")).pageCount).toBe(1);
  });

  it("P2-2: protects nested inline HTML (emphasis/strong) and blank-line multi-block HTML while editing plain controls", () => {
    const header = [
      "---",
      "id: html-guard-demo",
      "title: HTML Guard Demo",
      "type: concept",
      "summary: 摘要",
      "sources:",
      "  - vllm@0fc695fc:vllm/config/model.py#L1-L10",
      'evidence: "C"',
      "relations: []",
      "updated: '2026-10-06'",
      "---",
      "",
      "",
    ].join("\n");

    const cases = [
      { body: "## 对照源码\n\n见来源 1。\n", expectedEdits: 1 },
      { body: "## 对照源码\n\n<span>来源 1</span>\n", expectedEdits: 0 },
      { body: "## 对照源码\n\n<span>**来源 1**</span>\n", expectedEdits: 0 },
      {
        body: '## 对照源码\n\n<span title="a > b">*嵌套 **来源 1** 强调*</span> 后接来源 1。\n',
        expectedEdits: 1,
      },
      { body: "## 对照源码\n\n<div>\n\n来源 1\n\n</div>\n", expectedEdits: 0 },
      { body: "## 对照源码\n\n<div>\n\n**来源 1**\n\n</div>\n\n独立段落见来源 1。\n", expectedEdits: 1 },
      { body: "## 对照源码\n\n<!-- <div> -->\n\n见来源 1。\n", expectedEdits: 1 },
    ];

    for (const c of cases) {
      const raw = header + c.body;
      const plan = planPageAstMigration("concepts/html-guard-demo.md", raw);
      expect(plan.proposedEdits.length, c.body).toBe(c.expectedEdits);
      const preview = renderPlanPreviewText(raw, plan);
      const again = planPageAstMigration("concepts/html-guard-demo.md", preview);
      expect(again.proposedEdits.length, c.body).toBe(0);
    }
  });

  it("P2-3: emits git-apply valid zero-length hunk unified diffs matching renderPlanPreviewText byte-for-byte across LF, no-EOL, CRLF, and BOM+CRLF", () => {
    const base = [
      "---",
      "id: diff-demo",
      "title: Diff Demo",
      "type: concept",
      "summary: 摘要",
      "sources:",
      "  - vllm@0fc695fc:vllm/config/model.py#L1-L10",
      'evidence: "C"',
      "relations: []",
      "updated: '2026-10-06'",
      "---",
      "",
      "## 核心原理",
      "",
      "**v0.30.0rc2 对照：** 保留完整事实、条件和 emoji 🧪。",
      "",
      "主干内容。",
      "",
      "## 对照源码",
      "",
      "既有说明，见来源 1。",
      "",
    ].join("\n");

    const tmp = mkdtempSync(join(tmpdir(), "wiki-ast-diffs-"));
    tempDirs.push(tmp);

    for (const fmt of ["lf", "lf-no-eol", "crlf", "bom-crlf", "crlf-no-eol"] as const) {
      const trimmed = fmt.endsWith("no-eol") ? base.slice(0, -1) : base;
      const original =
        (fmt === "bom-crlf" ? "\uFEFF" : "") +
        (fmt.includes("crlf") ? trimmed.replace(/\n/g, "\r\n") : trimmed);
      const root = join(tmp, fmt);
      const file = join(root, "wiki", "concepts", "diff-demo.md");
      mkdirSync(join(root, "wiki", "concepts"), { recursive: true });
      writeFileSync(file, original);

      const p0 = planPageAstMigration("concepts/diff-demo.md", original);
      const p1 = planPageAstMigration("concepts/diff-demo.md", original, {
        selectedMoves: [
          {
            file: "concepts/diff-demo.md",
            startOffset: p0.versionParagraphs[0]!.startOffset,
            endOffset: p0.versionParagraphs[0]!.endOffset,
            blockSha256: p0.versionParagraphs[0]!.blockSha256,
          },
        ],
      });
      const expected = renderPlanPreviewText(original, p1);
      const diffPath = join(root, "move.diff");
      writeFileSync(diffPath, `${p1.proposedDiff}\n`);

      const chk = spawnSync(
        "git",
        ["-c", "core.autocrlf=false", "apply", "--check", "--unidiff-zero", diffPath],
        { cwd: root, encoding: "utf8", windowsHide: true },
      );
      expect(chk.status, `${fmt} check: ${chk.stderr}`).toBe(0);

      const app = spawnSync(
        "git",
        ["-c", "core.autocrlf=false", "apply", "--unidiff-zero", "--whitespace=nowarn", diffPath],
        { cwd: root, encoding: "utf8", windowsHide: true },
      );
      expect(app.status, `${fmt} apply: ${app.stderr}`).toBe(0);
      expect(sha256(readFileSync(file)), fmt).toBe(sha256(Buffer.from(expected, "utf8")));
    }
  });
});

describe("1183 AST read-only planner P2 follow-up closures", () => {
  it("P2-1 follow-up: protects junctioned input subdirectories and rejects out-of-tree --file paths without mutating any file", () => {
    const repoRoot = join(import.meta.dirname, "../..");
    const netloader = readFileSync(new URL("../../wiki/concepts/netloader-guide.md", import.meta.url));
    const tmp = mkdtempSync(join(tmpdir(), "wiki-ast-in-junc-"));
    tempDirs.push(tmp);

    const wikiRoot = join(tmp, "wiki");
    const physicalConcepts = join(tmp, "physical-concepts");
    const otherDir = join(tmp, "other");
    mkdirSync(wikiRoot, { recursive: true });
    mkdirSync(physicalConcepts, { recursive: true });
    mkdirSync(otherDir, { recursive: true });

    const physicalArticle = join(physicalConcepts, "netloader-guide.md");
    const otherArticle = join(otherDir, "netloader-guide.md");
    writeFileSync(physicalArticle, netloader);
    writeFileSync(otherArticle, netloader);
    const expectedSha = sha256(netloader);

    symlinkSync(physicalConcepts, join(wikiRoot, "concepts"), "junction");

    const rJunctionIn = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/wiki-ast-migrate.ts", "--wiki-root", wikiRoot, "--out", physicalArticle],
      { cwd: repoRoot, encoding: "utf8", windowsHide: true },
    );
    expect(rJunctionIn.status).not.toBe(0);
    expect(sha256(readFileSync(physicalArticle))).toBe(expectedSha);

    const rEscapeFile = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/wiki-ast-migrate.ts",
        "--wiki-root",
        wikiRoot,
        "--file",
        "../other/netloader-guide.md",
        "--out",
        otherArticle,
      ],
      { cwd: repoRoot, encoding: "utf8", windowsHide: true },
    );
    expect(rEscapeFile.status).not.toBe(0);
    expect(sha256(readFileSync(otherArticle))).toBe(expectedSha);

    expect(() => buildWikiAstMigrationPlan(wikiRoot, { files: ["../other/netloader-guide.md"] })).toThrow(
      /越出|非法/,
    );
  });

  it("P2-2 follow-up: computes unified document-wide closed HTML spans across H2 headings and blocks HTML-enclosed version paragraph moves", () => {
    const header = [
      "---",
      "id: html-scope-followup",
      "title: HTML Scope Followup",
      "type: concept",
      "summary: 摘要",
      "sources:",
      "  - vllm@0fc695fc:vllm/config/model.py#L1-L10",
      'evidence: "C"',
      "relations: []",
      "updated: '2026-10-06'",
      "---",
      "",
      "",
    ].join("\n");

    const crossH2Div = `${header}## 核心原理\n\n<div>\n\n## 对照源码\n\n来源 1。\n\n</div>\n\n外部来源 1。\n`;
    const pDiv = planPageAstMigration("concepts/html-scope-followup.md", crossH2Div);
    expect(pDiv.proposedEdits).toHaveLength(1);
    expect(renderPlanPreviewText(crossH2Div, pDiv)).toContain(
      "\n\n来源 1。\n\n</div>\n\n外部来源 1 [C1]。\n",
    );

    const crossH2Details = `${header}## 核心原理\n\n<details>\n<summary>可展开的原始 HTML</summary>\n\n## 对照源码\n\n**来源 1**\n\n</details>\n\n外部来源 1。\n`;
    const pDetails = planPageAstMigration("concepts/html-scope-followup.md", crossH2Details);
    expect(pDetails.proposedEdits).toHaveLength(1);
    expect(renderPlanPreviewText(crossH2Details, pDetails)).toContain(
      "**来源 1**\n\n</details>\n\n外部来源 1 [C1]。\n",
    );

    const htmlVersionBody = `${header}## 核心原理\n\n<div>\n\n**v0.30.0rc2 对照：** HTML 中的完整原文不搬动。\n\n</div>\n\n## 对照源码\n\n已有说明。\n`;
    const pVpInit = planPageAstMigration("concepts/html-scope-followup.md", htmlVersionBody);
    expect(pVpInit.versionParagraphs).toHaveLength(0);
    const paraText = "**v0.30.0rc2 对照：** HTML 中的完整原文不搬动。";
    const paraStart = htmlVersionBody.indexOf(paraText);
    const pVpMove = planPageAstMigration("concepts/html-scope-followup.md", htmlVersionBody, {
      selectedMoves: [
        {
          file: "concepts/html-scope-followup.md",
          startOffset: paraStart,
          endOffset: paraStart + paraText.length,
          blockSha256: sha256(paraText),
        },
      ],
    });
    expect(pVpMove.proposedEdits).toHaveLength(0);

    const unclosedPseudoTag = `${header}## 对照源码\n\n遇到 <eos> 终止符时结束，详见来源 1。\n`;
    const pPseudo = planPageAstMigration("concepts/html-scope-followup.md", unclosedPseudoTag);
    expect(pPseudo.proposedEdits).toHaveLength(1);
  });
});

describe("1189 AST HTML raw-text & protected-destination closures", () => {
  it("ignores decoy closing tags inside HTML raw-text elements (script/style/textarea) and blocks paragraph moves into HTML-protected destinations", () => {
    const header = [
      "---",
      "id: html-target",
      "title: HTML Target",
      "type: concept",
      "summary: 摘要",
      "sources:",
      "  - vllm@0fc695fc:vllm/config/model.py#L1-L10",
      'evidence: "C"',
      "relations: []",
      "updated: '2026-10-06'",
      "---",
      "",
      "",
    ].join("\n");

    const scriptDecoy = `${header}## 对照源码\n\n<div>\n\n<script>const text = "</div>";</script>\n\n来源 1。\n\n</div>\n\n外部来源 1。\n`;
    const pScript = planPageAstMigration("concepts/html-target.md", scriptDecoy);
    expect(pScript.proposedEdits).toHaveLength(1);
    expect(renderPlanPreviewText(scriptDecoy, pScript)).toContain(
      "\n\n来源 1。\n\n</div>\n\n外部来源 1 [C1]。\n",
    );

    const styleDecoy = `${header}## 对照源码\n\n<div>\n\n<style>.a::after { content: "</div>"; }</style>\n\n来源 1。\n\n</div>\n\n外部来源 1。\n`;
    const pStyle = planPageAstMigration("concepts/html-target.md", styleDecoy);
    expect(pStyle.proposedEdits).toHaveLength(1);

    const protectedDest = `${header}## 核心原理\n\n**v0.30.0rc2 对照：** 外部的完整版本段。\n\n<div>\n\n## 对照源码\n\n已有原文。\n\n## HTML 内的下一节\n\n保持。\n\n</div>\n`;
    const pInit = planPageAstMigration("concepts/html-target.md", protectedDest);
    expect(pInit.versionParagraphs).toHaveLength(1);
    const vp = pInit.versionParagraphs[0]!;
    const pMove = planPageAstMigration("concepts/html-target.md", protectedDest, {
      selectedMoves: [
        {
          file: "concepts/html-target.md",
          startOffset: vp.startOffset,
          endOffset: vp.endOffset,
          blockSha256: vp.blockSha256,
        },
      ],
    });
    expect(pMove.proposedEdits).toHaveLength(0);
    expect(pMove.versionParagraphs[0]!.disposition).toBe("manual-blocked");
    expect(pMove.manualItems.some((m) => m.kind === "missing-move-destination")).toBe(true);
    expect(renderPlanPreviewText(protectedDest, pMove)).toBe(protectedDest);
  });

  it("applies a dry-run plan to an isolated copy, preserves line endings/BOM, and is idempotent on repeat apply and post-apply dry-run", () => {
    const dir = mkdtempSync(join(tmpdir(), "ast-migrate-apply-ok-"));
    tempDirs.push(dir);
    const wikiRoot = join(dir, "isolated-wiki");
    mkdirSync(join(wikiRoot, "concepts"), { recursive: true });

    const pageA = [
      "\uFEFF---",
      "id: apply-crlf",
      "title: Apply CRLF",
      "type: concept",
      "summary: 摘要",
      "evidence: C",
      "updated: 2026-03-20",
      "sources:",
      "  - vllm@0fc695fc:vllm/a.py#L1-L5",
      "  - vllm@0fc695fc:vllm/b.py#L6-L10",
      "---",
      "",
      "## 核心原理",
      "",
      "**v0.30.0rc2 对照：** 待搬移版本段。",
      "",
      "保留的机制说明。",
      "",
      "## 对照源码",
      "",
      "对应来源 1。",
      "",
      "## 关联卡片",
      "",
      "- [x](./x.md) — 保护区不改",
    ].join("\r\n");

    const pageB = [
      "---",
      "id: apply-no-eol",
      "title: Apply No EOL",
      "type: concept",
      "summary: 摘要",
      "evidence: C",
      "updated: 2026-03-20",
      "sources:",
      "  - vllm@0fc695fc:vllm/a.py#L1-L5",
      "---",
      "",
      "## 对照源码",
      "",
      "唯一来源 1 说明。",
    ].join("\n");

    const pageUnchanged = [
      "---",
      "id: apply-unchanged",
      "title: Apply Unchanged",
      "type: concept",
      "summary: 摘要",
      "evidence: C",
      "updated: 2026-03-20",
      "sources:",
      "  - vllm@0fc695fc:vllm/a.py#L1-L5",
      "---",
      "",
      "## 对照源码",
      "",
      "已标注 [C1]。",
      "",
    ].join("\n");

    const fileA = join(wikiRoot, "concepts", "apply-crlf.md");
    const fileB = join(wikiRoot, "concepts", "apply-no-eol.md");
    const fileU = join(wikiRoot, "concepts", "apply-unchanged.md");
    writeFileSync(fileA, pageA, "utf8");
    writeFileSync(fileB, pageB, "utf8");
    writeFileSync(fileU, pageUnchanged, "utf8");

    const initialPlan = buildWikiAstMigrationPlan(wikiRoot);
    const vpA = initialPlan.pages.find((p) => p.file === "concepts/apply-crlf.md")!.versionParagraphs[0]!;
    const planWithMove = buildWikiAstMigrationPlan(wikiRoot, {
      selectedMoves: [
        {
          file: "concepts/apply-crlf.md",
          startOffset: vpA.startOffset,
          endOffset: vpA.endOffset,
          blockSha256: vpA.blockSha256,
        },
      ],
    });

    const planJsonPath = join(dir, "plan.json");
    writeFileSync(planJsonPath, `${JSON.stringify(planWithMove, null, 2)}\n`, "utf8");
    const planShaBefore = sha256(readFileSync(planJsonPath));

    const repoRoot = join(import.meta.dirname, "../..");
    const applyReport1Path = join(dir, "apply-report-1.json");

    const run1 = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/wiki-ast-migrate.ts",
        "--apply",
        planJsonPath,
        "--wiki-root",
        wikiRoot,
        "--out",
        applyReport1Path,
      ],
      { cwd: repoRoot, encoding: "utf8", windowsHide: true },
    );
    expect(run1.status).toBe(0);
    expect(sha256(readFileSync(planJsonPath))).toBe(planShaBefore);

    const report1 = JSON.parse(readFileSync(applyReport1Path, "utf8"));
    expect(report1.mode).toBe("apply-plan");
    expect(report1.status).toBe("applied");
    expect(report1.alreadyApplied).toBe(false);
    expect(report1.writtenPageCount).toBe(2);
    expect(report1.writtenPages).toBe(2);
    expect(report1.unchangedPageCount).toBe(1);

    for (const pagePlan of planWithMove.pages) {
      const diskSha = sha256(readFileSync(join(wikiRoot, pagePlan.file)));
      expect(diskSha).toBe(pagePlan.previewOutputByteSha256);
    }

    const afterAText = readFileSync(fileA, "utf8");
    expect(afterAText.startsWith("\uFEFF---\r\n")).toBe(true);
    expect(afterAText).toContain(
      "## 对照源码\r\n\r\n对应来源 1 [C1]。\r\n\r\n**v0.30.0rc2 对照：** 待搬移版本段。",
    );
    expect(readFileSync(fileB, "utf8").endsWith("唯一来源 1 [C1] 说明。")).toBe(true);

    // Second apply with identical plan must be a zero-write idempotent success
    const applyReport2Path = join(dir, "apply-report-2.json");
    const run2 = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/wiki-ast-migrate.ts",
        "--apply",
        planJsonPath,
        "--wiki-root",
        wikiRoot,
        "--out",
        applyReport2Path,
      ],
      { cwd: repoRoot, encoding: "utf8", windowsHide: true },
    );
    expect(run2.status).toBe(0);
    const report2 = JSON.parse(readFileSync(applyReport2Path, "utf8"));
    expect(report2.status).toBe("already-applied-idempotent");
    expect(report2.alreadyApplied).toBe(true);
    expect(report2.writtenPageCount).toBe(0);
    expect(report2.writtenPages).toBe(0);
    expect(report2.unchangedPageCount).toBe(3);

    for (const pagePlan of planWithMove.pages) {
      const diskSha = sha256(readFileSync(join(wikiRoot, pagePlan.file)));
      expect(diskSha).toBe(pagePlan.previewOutputByteSha256);
    }

    // Re-running dry-run after apply must propose 0 edits
    const replanAfterApply = buildWikiAstMigrationPlan(wikiRoot);
    expect(replanAfterApply.summary.totalProposedEdits).toBe(0);
    expect(replanAfterApply.summary.pagesWithProposedEdits).toBe(0);
  });

  it("enforces all-or-nothing pre-flight validation (0 files written on stale file, partial apply state, or tampered plan/protected ranges)", () => {
    const dir = mkdtempSync(join(tmpdir(), "ast-migrate-preflight-"));
    tempDirs.push(dir);
    const wikiRoot = join(dir, "isolated-wiki");
    mkdirSync(join(wikiRoot, "concepts"), { recursive: true });

    const makePage = (id: string, bodyLine: string) =>
      [
        "---",
        `id: ${id}`,
        `title: ${id}`,
        "type: concept",
        "summary: 摘要",
        "evidence: C",
        "updated: 2026-03-20",
        "sources:",
        "  - vllm@0fc695fc:vllm/a.py#L1-L5",
        "---",
        "",
        "## 对照源码",
        "",
        bodyLine,
        "",
        "<div>",
        "",
        "HTML 保护区内容。",
        "",
        "</div>",
        "",
        "## 关联卡片",
        "",
        "- [x](./x.md) — 保护区",
        "",
      ].join("\n");

    const file1 = join(wikiRoot, "concepts", "p1.md");
    const file2 = join(wikiRoot, "concepts", "p2.md");
    const raw1 = makePage("p1", "第一页来源 1 说明。");
    const raw2 = makePage("p2", "第二页来源 1 说明。");
    writeFileSync(file1, raw1, "utf8");
    writeFileSync(file2, raw2, "utf8");

    const plan = buildWikiAstMigrationPlan(wikiRoot);
    const sha1Before = sha256(Buffer.from(raw1, "utf8"));
    const sha2Before = sha256(Buffer.from(raw2, "utf8"));

    // 1. Stale file on disk (file2 modified after plan generation): must reject before writing file1
    writeFileSync(file2, `${raw2}\n额外改动\n`, "utf8");
    expect(() => applyWikiAstMigrationPlan(wikiRoot, plan)).toThrow(/SHA-256|stale|modified/i);
    expect(sha256(readFileSync(file1))).toBe(sha1Before);
    writeFileSync(file2, raw2, "utf8");

    // 2. Partial/mixed apply state (file1 already at previewOutputByteSha256, file2 still at inputByteSha256)
    const p1Plan = plan.pages.find((p) => p.file === "concepts/p1.md")!;
    const p1Preview = renderPlanPreviewText(raw1, p1Plan);
    writeFileSync(file1, p1Preview, "utf8");
    expect(() => applyWikiAstMigrationPlan(wikiRoot, plan)).toThrow(/partial|mixed/i);
    expect(sha256(readFileSync(file2))).toBe(sha2Before);
    writeFileSync(file1, raw1, "utf8");

    // 3. Tampered previewOutputByteSha256 on page 2 -> must not write page 1
    const tamperedHashPlan = structuredClone(plan);
    tamperedHashPlan.pages[1]!.previewOutputByteSha256 = "0".repeat(64);
    expect(() => applyWikiAstMigrationPlan(wikiRoot, tamperedHashPlan)).toThrow(
      /previewOutputByteSha256|mismatch|tamper/i,
    );
    expect(sha256(readFileSync(file1))).toBe(sha1Before);
    expect(sha256(readFileSync(file2))).toBe(sha2Before);

    // 4. Tampered proposedEdits touching protected HTML / generated H2 / frontmatter (even with recomputed previewOutputByteSha256)
    const maliciousPlan = structuredClone(plan);
    const htmlIdx = raw2.indexOf("HTML 保护区内容。");
    const badAfterText = "HTML 被篡改内容。";
    maliciousPlan.pages[1]!.proposedEdits = [
      {
        kind: "source-reference-mark",
        file: "concepts/p2.md",
        lineStart: 1,
        lineEnd: 1,
        startOffset: htmlIdx,
        endOffset: htmlIdx + "HTML 保护区内容。".length,
        beforeText: "HTML 保护区内容。",
        afterText: badAfterText,
        reason: "tampered edit inside protected HTML",
      },
    ];
    const maliciousPreview2 =
      raw2.slice(0, htmlIdx) + badAfterText + raw2.slice(htmlIdx + "HTML 保护区内容。".length);
    maliciousPlan.pages[1]!.previewOutputByteSha256 = sha256(Buffer.from(maliciousPreview2, "utf8"));
    expect(() => applyWikiAstMigrationPlan(wikiRoot, maliciousPlan)).toThrow(/protected|mismatch|tamper/i);
    expect(sha256(readFileSync(file1))).toBe(sha1Before);
    expect(sha256(readFileSync(file2))).toBe(sha2Before);
  });

  it("strictly blocks applying to the formal repository wiki directory, junctions/symlinks, hardlinked files, or unsafe output paths", () => {
    const dir = mkdtempSync(join(tmpdir(), "ast-migrate-guard-"));
    tempDirs.push(dir);
    const formalWiki = join(process.cwd(), "wiki");

    const isolatedWiki = join(dir, "isolated-wiki");
    mkdirSync(join(isolatedWiki, "concepts"), { recursive: true });
    const sampleMd = [
      "---",
      "id: guard-test",
      "title: Guard Test",
      "type: concept",
      "summary: 摘要",
      "evidence: C",
      "updated: 2026-03-20",
      "sources:",
      "  - vllm@0fc695fc:vllm/a.py#L1-L5",
      "---",
      "",
      "## 对照源码",
      "",
      "唯一来源 1 说明。",
      "",
    ].join("\n");
    writeFileSync(join(isolatedWiki, "concepts", "guard-test.md"), sampleMd, "utf8");
    const validPlan = buildWikiAstMigrationPlan(isolatedWiki);
    const planPath = join(dir, "valid-plan.json");
    writeFileSync(planPath, `${JSON.stringify(validPlan, null, 2)}\n`, "utf8");

    // 1. Direct formal wiki/ directory and Windows case-variant
    expect(() => applyWikiAstMigrationPlan(formalWiki, validPlan)).toThrow(/protected|formal|refusing/i);
    expect(() => applyWikiAstMigrationPlan(formalWiki.toUpperCase(), validPlan)).toThrow(
      /protected|formal|refusing/i,
    );

    // 2. Junction pointing to formal wiki/ or isolated wiki
    const junctionToFormal = join(dir, "junction-formal");
    symlinkSync(formalWiki, junctionToFormal, "junction");
    expect(() => applyWikiAstMigrationPlan(junctionToFormal, validPlan)).toThrow(
      /symbolic link|junction|protected|formal/i,
    );

    // 3. Hardlinked file inside an otherwise isolated directory sharing inode / nlink > 1
    const hardlinkWiki = join(dir, "hardlink-wiki");
    mkdirSync(join(hardlinkWiki, "concepts"), { recursive: true });
    linkSync(
      join(isolatedWiki, "concepts", "guard-test.md"),
      join(hardlinkWiki, "concepts", "guard-test.md"),
    );
    expect(() => applyWikiAstMigrationPlan(hardlinkWiki, validPlan)).toThrow(/hardlink|nlink|protected/i);

    // 4. CLI rejects --apply when --out overwrites the input plan file or writes inside wikiRoot
    const repoRoot = join(import.meta.dirname, "../..");
    const overwritePlanRun = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/wiki-ast-migrate.ts",
        "--apply",
        planPath,
        "--wiki-root",
        isolatedWiki,
        "--out",
        planPath,
      ],
      { cwd: repoRoot, encoding: "utf8", windowsHide: true },
    );
    expect(overwritePlanRun.status).not.toBe(0);
    expect(overwritePlanRun.stderr).toMatch(/plan|output|overwrite|refusing/i);
  });

  it("1221 P2 closures: blocks subdirectory junction protected wiki bypass, CLI --apply --out junction/alias overwrite, and fabricated idempotent plans", () => {
    const dir = mkdtempSync(join(tmpdir(), "ast-migrate-1221-p2-"));
    tempDirs.push(dir);
    const repoRoot = join(import.meta.dirname, "../..");

    const sampleWithEdit = [
      "---",
      "id: p2-probe",
      "title: P2 Probe",
      "type: concept",
      "summary: 摘要",
      "evidence: C",
      "updated: 2026-03-20",
      "sources:",
      "  - vllm@0fc695fc:vllm/a.py#L1-L5",
      "---",
      "",
      "## 对照源码",
      "",
      "唯一来源 1 说明。",
      "",
    ].join("\n");

    // Probe A: protectedWiki/concepts is a junction pointing to physicalStore/concepts (regular file, nlink=1)
    const physicalStore = join(dir, "physical-store");
    const protectedWiki = join(dir, "protected-wiki");
    mkdirSync(join(physicalStore, "concepts"), { recursive: true });
    mkdirSync(protectedWiki, { recursive: true });
    const physicalArticle = join(physicalStore, "concepts", "p2-probe.md");
    writeFileSync(physicalArticle, sampleWithEdit, "utf8");
    const physicalShaBefore = sha256(readFileSync(physicalArticle));
    symlinkSync(join(physicalStore, "concepts"), join(protectedWiki, "concepts"), "junction");

    const planA = buildWikiAstMigrationPlan(physicalStore);
    expect(() =>
      applyWikiAstMigrationPlan(physicalStore, planA, { protectedWikiRoot: protectedWiki }),
    ).toThrow(/protected|formal|refusing|overlapping|inode|alias/i);
    expect(sha256(readFileSync(physicalArticle))).toBe(physicalShaBefore);

    // Probe B: CLI --apply --out pointing through a parent junction to a protected article or input plan alias
    const isolatedCopy = join(dir, "isolated-copy");
    mkdirSync(join(isolatedCopy, "concepts"), { recursive: true });
    writeFileSync(join(isolatedCopy, "concepts", "p2-probe.md"), sampleWithEdit, "utf8");
    const planB = buildWikiAstMigrationPlan(isolatedCopy);
    const planBPath = join(dir, "plan-b.json");
    writeFileSync(planBPath, `${JSON.stringify(planB, null, 2)}\n`, "utf8");
    const planBShaBefore = sha256(readFileSync(planBPath));

    const fakeFormalWiki = join(dir, "fake-formal-wiki");
    mkdirSync(join(fakeFormalWiki, "concepts"), { recursive: true });
    const protectedAclArticle = join(fakeFormalWiki, "concepts", "acl-graph.md");
    writeFileSync(protectedAclArticle, sampleWithEdit, "utf8");
    const aclShaBefore = sha256(readFileSync(protectedAclArticle));

    const juncToFakeFormal = join(dir, "junc-to-fake-formal");
    symlinkSync(fakeFormalWiki, juncToFakeFormal, "junction");
    const outViaJunction = join(juncToFakeFormal, "concepts", "acl-graph.md");

    const runProbeB = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/wiki-ast-migrate.ts",
        "--apply",
        planBPath,
        "--wiki-root",
        isolatedCopy,
        "--out",
        outViaJunction,
      ],
      { cwd: repoRoot, encoding: "utf8", windowsHide: true },
    );
    expect(runProbeB.status).not.toBe(0);
    expect(sha256(readFileSync(protectedAclArticle))).toBe(aclShaBefore);
    expect(sha256(readFileSync(join(isolatedCopy, "concepts", "p2-probe.md")))).toBe(physicalShaBefore);

    // Also test --out pointing through a directory junction to overwrite plan-b.json
    const juncToDir = join(dir, "junc-to-plan-dir");
    symlinkSync(dir, juncToDir, "junction");
    const runProbeBPlanAlias = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/wiki-ast-migrate.ts",
        "--apply",
        planBPath,
        "--wiki-root",
        isolatedCopy,
        "--out",
        join(juncToDir, "plan-b.json"),
      ],
      { cwd: repoRoot, encoding: "utf8", windowsHide: true },
    );
    expect(runProbeBPlanAlias.status).not.toBe(0);
    expect(sha256(readFileSync(planBPath))).toBe(planBShaBefore);

    // Probe C: Fabricated idempotent plan where disk matches previewOutputByteSha256 but inputByteSha256 / proposedEdits are bogus
    const advC = join(dir, "adv-c");
    mkdirSync(join(advC, "concepts"), { recursive: true });
    const cleanMd = [
      "---",
      "id: ai-core",
      "title: AI Core",
      "type: concept",
      "summary: 摘要",
      "evidence: C",
      "updated: 2026-03-20",
      "sources:",
      "  - vllm@0fc695fc:vllm/a.py#L1-L5",
      "---",
      "",
      "## 对照源码",
      "",
      "已标注来源 [C1]。",
      "",
    ].join("\n");
    const cleanFile = join(advC, "concepts", "ai-core.md");
    writeFileSync(cleanFile, cleanMd, "utf8");
    const cleanSha = sha256(Buffer.from(cleanMd, "utf8"));

    const realCleanPlan = buildWikiAstMigrationPlan(advC);
    const bogusPlan = structuredClone(realCleanPlan);
    bogusPlan.summary.pagesWithProposedEdits = 1;
    bogusPlan.summary.totalProposedEdits = 1;
    bogusPlan.pages[0]!.inputByteSha256 = "a".repeat(64);
    bogusPlan.pages[0]!.previewOutputByteSha256 = cleanSha;
    bogusPlan.pages[0]!.proposedEdits = [
      {
        kind: "source-reference-mark",
        file: "concepts/ai-core.md",
        lineStart: 1,
        lineEnd: 1,
        startOffset: 0,
        endOffset: 3,
        beforeText: "---",
        afterText: "HACK",
        reason: "fabricated frontmatter edit masquerading as already-applied",
      },
    ];
    expect(() => applyWikiAstMigrationPlan(advC, bogusPlan)).toThrow(
      /tampered|invalid|mismatch|idempot|reconstruct|protected/i,
    );
    expect(sha256(readFileSync(cleanFile))).toBe(cleanSha);
  });
});
