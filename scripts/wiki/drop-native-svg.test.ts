/**
 * 确定性零付费 RunAgent 协议与工程集成测试（Protocol / Engineering Integration Test）：
 * 真实走通 startDrop -> integrateDrop（generated / section / edited 三条输出路径）->
 * stageDropDiagram -> 默认 validateIntegration（含真实本地 Git 仓库 blob AC11 符号核验）+
 * validateDropAssets + validateDropReceipt -> createReview -> approveReview（含 afterWrite 中断恢复）。
 * 注：本文件使用确定性内存 RunAgent 夹具（costUsd=0），不冒充真实大模型语义质量 E2E。
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parse as parseYaml, stringify } from "yaml";
import type { RunAgent } from "./batch";
import { diagramSpecSchema, renderDiagram } from "./diagrams";
import { acceptBatch } from "./drop-batch";
import { startDrop } from "./drop-run";
import { validateIntegration } from "./integration-check";
import { configuredRepoRoots } from "./repo-roots";
import { approveReview, readReview } from "./review";
import { handbookFixture, wikiFixture } from "./test-fixture";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});

function createFixtureWithLocalRepo() {
  const f = wikiFixture();
  fixtures.push(f);
  f.write("wiki/HANDBOOK.md", handbookFixture());
  f.write("wiki/log.md", "# Wiki log\n");

  const repoDir = join(f.root, "repos/vllm");
  mkdirSync(join(repoDir, "vllm/v1/core/sched"), { recursive: true });
  writeFileSync(
    join(repoDir, "vllm/v1/core/sched/scheduler.py"),
    ["class NativeScheduler:", "    def schedule_step(self) -> int:", "        return 1", ""].join("\n"),
  );
  const git = (args: string[]) =>
    execFileSync("git", args, { cwd: repoDir, encoding: "utf8", windowsHide: true }).trim();
  git(["init"]);
  git(["config", "user.email", "test@example.com"]);
  git(["config", "user.name", "Test"]);
  git(["add", "."]);
  git(["commit", "-m", "pin scheduler"]);
  const commitSha = git(["rev-parse", "HEAD"]);

  f.write(
    "wiki/seeds/repos.yaml",
    stringify({
      repos: {
        vllm: {
          url: "https://github.com/vllm-project/vllm",
          path: "repos/vllm",
          refs: { main: commitSha },
        },
      },
      features: [],
    }),
  );
  return { f, commitSha };
}

const HUMAN_NATIVE_SVG = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240" width="600" height="240" role="img">',
  "  <title><![CDATA[原生调度时序 & 边界]]></title>",
  "  <!-- human-authored bytes must survive Drop -> Review -> Recovery verbatim -->",
  '  <defs><marker id="sched-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="currentColor"/></marker></defs>',
  '  <rect x="24" y="24" width="552" height="192" fill="var(--color-surface)" stroke="currentColor"/>',
  '  <path d="M72 150 C200 40 400 40 528 150" fill="none" stroke="currentColor" marker-end="url(#sched-arrow)"/>',
  '  <text x="300" y="190" text-anchor="middle" font-family="var(--font-mono)" font-size="15" fill="currentColor"><![CDATA[step = q < k && ready]]></text>',
  "</svg>",
  "",
].join("\n");

function makeNativeYaml(id: string, commitSha: string, symbol = "NativeScheduler") {
  return stringify({
    mode: "native-svg",
    id,
    caption: "原生调度时序 & 边界",
    size: [600, 240],
    pins: [
      {
        source: `vllm@${commitSha}:vllm/v1/core/sched/scheduler.py#L1-L3`,
        symbols: [symbol],
      },
    ],
  });
}
describe("Drop native-svg 三路共享契约、默认门禁与整组 Review 恢复（确定性 RunAgent 协议测试）", () => {
  it("drop-generate 真实调用链：拒绝代码/模块字段与 AC11 错误符号；合法 native-svg+pin 经默认 validateIntegration 进整组 Review，afterWrite 中断恢复后精确保留 SVG 原字节", async () => {
    const { f, commitSha } = createFixtureWithLocalRepo();
    const rawMaterial = "调度步进仅在 ready 队列非空时分配预算。\n";

    // 1) 代码/动态模块字段在真实 caller 边界被严格拒绝
    const badCodeBatch = await acceptBatch(f.root, {
      key: "reject-code-fields",
      items: [{ name: "sched.md", text: rawMaterial }],
    });
    const codeInjectAgent: RunAgent = async (req) => {
      const p = JSON.parse(req.stdin);
      if (p.mode === "drop-extract") {
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            summary: "调度预算",
            quotes: [p.materials[0].text.trim()],
            conditions: ["ready 非空"],
            topics: [{ name: "调度", query: "调度" }],
          }),
        };
      }
      if (p.mode === "drop-discover") {
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            read: [],
            fetch: [],
            search: [],
            pages: [
              {
                path: "sources/sched-code-bad.md",
                reason: "新增来源页",
                toc: { part: "references", section: "测试资料" },
                evidence: [p.notes[0].ref],
                comparisons: [],
              },
            ],
            question: "",
            report: "计划新增一页",
            done: true,
            outcome: { kind: "integrate", reason: "新增", comparisons: [] },
          }),
        };
      }
      if (p.mode === "drop-generate") {
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            text: `---\nid: sched-code-bad\ntitle: 调度样本\ntype: source\nsummary: 调度说明\nsources: [${p.notes[0].ref}]\nevidence: I\nupdated: '2026-11-16'\n---\n调度步进仅在 ready 队列非空时分配预算。\n\n\`\`\`wiki-diagram\nfile: native-sched\n\`\`\`\n`,
            diagrams: [
              {
                id: "native-sched",
                yaml: makeNativeYaml("native-sched", commitSha),
                svg: HUMAN_NATIVE_SVG,
                modulePath: "./EvilInteractive.tsx",
              },
            ],
            revision: null,
          }),
        };
      }
      return {
        id: req.id,
        ok: true,
        exitCode: 0,
        stderrTail: "",
        costUsd: 0,
        output: JSON.stringify({ issues: [], contradictions: [], report: "ok" }),
      };
    };
    const rejectedCodeDone = await (
      await startDrop(f.root, badCodeBatch.id, {}, { runAgent: codeInjectAgent })
    ).done;
    expect(rejectedCodeDone.state).toBe("failed");
    expect(existsSync(join(f.root, "wiki/diagrams/native-sched.svg"))).toBe(false);

    // 2) AC11 符号不存在时被默认 validateIntegration 拦截
    const badPinBatch = await acceptBatch(f.root, {
      key: "reject-bad-pin-symbol",
      items: [{ name: "sched-pin.md", text: "调度步进仅在 ready 队列非空时分配预算（AC11 负例样本）。\n" }],
    });
    const makeGenerateAgent =
      (pageId: string, diagId: string, symbol: string): RunAgent =>
      async (req) => {
        const p = JSON.parse(req.stdin);
        if (p.mode === "drop-extract") {
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              summary: "调度预算",
              quotes: [p.materials[0].text.trim()],
              conditions: ["ready 非空"],
              topics: [{ name: "调度", query: "调度" }],
            }),
          };
        }
        if (p.mode === "drop-discover") {
          const unread = p.catalog.filter(
            (c: { id: string }) => !p.read.some((r: { id: string }) => r.id === c.id),
          );
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              read: unread.map((x: { id: string }) => x.id),
              fetch: [],
              search: [],
              pages: unread.length
                ? []
                : [
                    {
                      path: `sources/${pageId}.md`,
                      reason: "新增来源页",
                      toc: { part: "references", section: "测试资料" },
                      evidence: [p.notes[0].ref],
                      comparisons: [],
                    },
                  ],
              question: "",
              report: "计划新增来源页",
              done: unread.length === 0,
              outcome: { kind: "integrate", reason: "新增", comparisons: [] },
            }),
          };
        }
        if (p.mode === "drop-generate") {
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              text: `---\nid: ${pageId}\ntitle: ${pageId}\ntype: source\nsummary: 调度说明\nsources: [${p.notes[0].ref}]\nevidence: I\nupdated: '2026-11-16'\n---\n调度步进仅在 ready 队列非空时分配预算。\n\n\`\`\`wiki-diagram\nfile: ${diagId}\n\`\`\`\n`,
              diagrams: [
                { id: diagId, yaml: makeNativeYaml(diagId, commitSha, symbol), svg: HUMAN_NATIVE_SVG },
              ],
              revision: null,
            }),
          };
        }
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({ issues: [], contradictions: [], report: "ok" }),
        };
      };

    const badPinDone = await (
      await startDrop(
        f.root,
        badPinBatch.id,
        {},
        { runAgent: makeGenerateAgent("sched-bad-sym", "native-bad-sym", "GhostClass") },
      )
    ).done;
    expect(badPinDone.state).toBe("failed");
    expect(badPinDone.error).toContain("GhostClass");
    expect(existsSync(join(f.root, "wiki/diagrams/native-bad-sym.svg"))).toBe(false);

    // 3) 合法 native-svg + pin + raw 来源：默认 validateIntegration（无 validate 绕过）-> Review -> afterWrite 中断 -> 恢复发布
    const goodBatch = await acceptBatch(f.root, {
      key: "valid-generate-native",
      items: [{ name: "sched-ok.md", text: "调度步进仅在 ready 队列非空时分配预算（正式整组验收样本）。\n" }],
    });
    const goodDone = await (
      await startDrop(
        f.root,
        goodBatch.id,
        {},
        { runAgent: makeGenerateAgent("sched-native-ok", "native-sched-ok", "NativeScheduler") },
      )
    ).done;
    expect(goodDone.state).toBe("review");
    expect(goodDone.reviewId).toBeTruthy();

    // 未批准前正式 wiki 无写入
    expect(existsSync(join(f.root, "wiki/sources/sched-native-ok.md"))).toBe(false);
    expect(existsSync(join(f.root, "wiki/diagrams/native-sched-ok.yaml"))).toBe(false);
    expect(existsSync(join(f.root, "wiki/diagrams/native-sched-ok.svg"))).toBe(false);

    const review = readReview(f.root, goodDone.reviewId!);
    expect(review.payload.writes.map((w) => w.path)).toEqual(
      expect.arrayContaining([
        "wiki/sources/sched-native-ok.md",
        "wiki/diagrams/native-sched-ok.yaml",
        "wiki/diagrams/native-sched-ok.svg",
      ]),
    );

    await expect(
      approveReview(f.root, goodDone.reviewId!, {
        afterWrite(path) {
          if (path.endsWith(".svg")) throw new Error("controlled stop after SVG write");
        },
      }),
    ).rejects.toThrow("controlled stop after SVG write");
    expect(readReview(f.root, goodDone.reviewId!).state).toBe("publishing");

    const resumed = await approveReview(f.root, goodDone.reviewId!);
    expect(resumed.state).toBe("published");
    expect(readFileSync(join(f.root, "wiki/diagrams/native-sched-ok.svg"), "utf8")).toBe(HUMAN_NATIVE_SVG);
    expect(validateIntegration(f.root, configuredRepoRoots(f.root))).toEqual([]);
  });
  it("drop-section 与 drop-edit 真实调用链：共享同一严格资源契约，保留旧事实/来源/版本谱系自动区与存量 figure 图", async () => {
    const { f, commitSha } = createFixtureWithLocalRepo();
    f.write(
      "wiki/sync.config.local.json",
      JSON.stringify({ contextWindowTokens: 52000, outputReserveTokens: 4096 }),
    );

    // 先布置一页 >13KB 的旧页（含旧事实、既有来源、受保护的 ## 版本谱系 小节以及一张旧 figure 图）
    const existingFigureYaml = stringify({
      layout: "figure",
      id: "legacy-fig",
      caption: "存量派生图",
      size: [480, 160],
      items: [{ at: [20, 20], size: [200, 60], text: "旧派生框", tone: "token" }],
    });
    const existingFigureSvg = renderDiagram(diagramSpecSchema.parse(parseYaml(existingFigureYaml)));
    f.write("wiki/diagrams/legacy-fig.yaml", existingFigureYaml);
    f.write("wiki/diagrams/legacy-fig.svg", existingFigureSvg);

    // A) drop-section（outline -> section）路径真实走通 + 拒绝代码字段
    const secBadBatch = await acceptBatch(f.root, {
      key: "section-reject-code",
      items: [{ name: "sec-bad.md", text: "分段章节补充新的就绪队列边界（代码拒绝负例）。\n" }],
    });
    const makeSectionAgent =
      (pageId: string, diagPayload: Record<string, unknown>): RunAgent =>
      async (req) => {
        const p = JSON.parse(req.stdin);
        if (p.mode === "drop-extract" || p.mode === "drop-read") {
          const chunkText = p.materials[0].text as string;
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              summary: "章节摘要",
              quotes: [chunkText.trim().slice(0, 40) || chunkText.slice(0, 20)],
              conditions: ["就绪边界"],
              topics: [{ name: "分段", query: "分段" }],
            }),
          };
        }
        if (p.mode === "drop-discover") {
          const unread = p.catalog.filter(
            (c: { id: string }) => !p.read.some((r: { id: string }) => r.id === c.id),
          );
          if (unread.length) {
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              costUsd: 0,
              output: JSON.stringify({
                request: {
                  pages: unread.map((x: { id: string }) => x.id),
                  stage: {
                    ruledOutPages: unread.map((x: { id: string }) => ({
                      page: x.id,
                      reason: "主题独立不合并",
                    })),
                  },
                },
              }),
            };
          }
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              read: p.catalog.map((x: { id: string }) => x.id),
              fetch: [],
              search: [],
              pages: [
                {
                  path: `sources/${pageId}.md`,
                  reason: "独立新增分段页",
                  toc: { part: "references", section: "测试资料" },
                  evidence: [p.notes[0].ref],
                  comparisons: [],
                },
              ],
              question: "",
              report: "分段生成",
              done: true,
              outcome: { kind: "integrate", reason: "新增", comparisons: [] },
            }),
          };
        }
        if (p.mode === "drop-generate") {
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              frontmatter: `---\nid: ${pageId}\ntitle: ${pageId}\ntype: source\nsummary: 分段页说明\nsources: [${p.notes[0].ref}]\nevidence: I\nupdated: '2026-11-16'\n---`,
              sections: [{ id: "sec-main", title: "主章节", instructions: "说明边界并附图" }],
            }),
          };
        }
        if (p.mode === "drop-section") {
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              text: `## 主章节\n\n分段章节补充新的就绪队列边界。\n\n\`\`\`wiki-diagram\nfile: ${String(diagPayload.id)}\n\`\`\``,
              diagrams: [diagPayload],
            }),
          };
        }
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({ issues: [], contradictions: [], report: "ok" }),
        };
      };

    const secRejected = await (
      await startDrop(
        f.root,
        secBadBatch.id,
        {},
        {
          runAgent: makeSectionAgent("sec-bad-page", {
            id: "native-sec-bad",
            yaml: makeNativeYaml("native-sec-bad", commitSha),
            svg: HUMAN_NATIVE_SVG,
            component: "() => null",
          }),
        },
      )
    ).done;
    expect(secRejected.state).toBe("failed");

    const secOkBatch = await acceptBatch(f.root, {
      key: "section-valid-native",
      items: [{ name: "sec-ok.md", text: "分段章节补充新的就绪队列边界。\n" }],
    });
    const secOkDone = await (
      await startDrop(
        f.root,
        secOkBatch.id,
        {},
        {
          runAgent: makeSectionAgent("sec-native-page", {
            id: "native-sec-ok",
            yaml: makeNativeYaml("native-sec-ok", commitSha),
            svg: HUMAN_NATIVE_SVG,
          }),
        },
      )
    ).done;
    expect(secOkDone.state).toBe("review");
    const secPublished = await approveReview(f.root, secOkDone.reviewId!);
    expect(secPublished.state).toBe("published");
    expect(readFileSync(join(f.root, "wiki/diagrams/native-sec-ok.svg"), "utf8")).toBe(HUMAN_NATIVE_SVG);

    // B) drop-edit（长文局部修订）路径真实走通：拒绝代码字段 + 保留旧事实/来源/版本谱系/legacy-fig 并新增 native-edit-ok
    const longProse = "既有调度条件要求队列长度不小于一且保留原有版本边界说明。\n".repeat(170);
    const oldPageContent = [
      "---",
      "id: existing-long-page",
      "title: 既有长来源页",
      "type: source",
      "summary: 既有长页说明",
      "sources:",
      `  - "vllm@${commitSha}:vllm/v1/core/sched/scheduler.py#L1-L3"`,
      'evidence: "I"',
      "updated: '2026-11-10'",
      "---",
      "## 核心记录",
      "",
      longProse,
      "```wiki-diagram",
      "file: legacy-fig",
      "```",
      "",
      "## 版本谱系",
      "",
      "- `v0.10.0`：保留脚本生成的版本谱系记录。",
      "",
    ].join("\n");
    f.write("wiki/sources/existing-long-page.md", oldPageContent);

    let sawDropEditMode = false;
    const makeEditAgent =
      (diagPayload: Record<string, unknown>): RunAgent =>
      async (req) => {
        const p = JSON.parse(req.stdin);
        if (p.mode === "drop-extract" || p.mode === "drop-read") {
          const chunkText = p.materials[0].text as string;
          const firstLine = chunkText.split("\n").find((l) => l.trim().length > 4) ?? chunkText.trim();
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              summary: "旧页或新材料摘要",
              quotes: [firstLine.slice(0, 36)],
              conditions: ["保留旧条件"],
              topics: [{ name: "既有长来源页", query: "existing-long-page" }],
            }),
          };
        }
        if (p.mode === "drop-discover") {
          const unread = p.catalog.filter(
            (c: { id: string }) => !p.read.some((r: { id: string }) => r.id === c.id),
          );
          if (unread.length) {
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              costUsd: 0,
              output: JSON.stringify({
                request: {
                  pages: unread.map((x: { id: string }) => x.id),
                  stage: {
                    ruledOutPages: unread
                      .filter((x: { id: string }) => x.id !== "existing-long-page")
                      .map((x: { id: string }) => ({ page: x.id, reason: "无关页" })),
                  },
                },
              }),
            };
          }
          const targetRead = p.read.find((r: { id: string }) => r.id === "existing-long-page");
          const rem = targetRead?.remainingRanges ?? [];
          if (rem.length) {
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              costUsd: 0,
              output: JSON.stringify({
                request: {
                  materials: [{ id: targetRead.material, start: rem[0].start, end: rem[0].end }],
                  stage: {
                    comparisons: [
                      {
                        page: "existing-long-page",
                        quote: "既有调度条件要求队列长度不小于一且保留原有版本边界说明。",
                        reason: "在同一长页补充原生图",
                      },
                    ],
                    ruledOutPages: p.read
                      .filter((x: { id: string }) => x.id !== "existing-long-page")
                      .map((x: { id: string }) => ({ page: x.id, reason: "无关页" })),
                  },
                },
              }),
            };
          }
          const stillUnaccounted = p.materials.some(
            (m: { id: string }) =>
              m.id === targetRead?.material &&
              !(p.discoveryProgress?.stagedComparisons ?? []).some(
                (c: { page: string }) => c.page === "existing-long-page",
              ),
          );
          if (stillUnaccounted) {
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              costUsd: 0,
              output: JSON.stringify({
                request: {
                  materials: [{ id: targetRead.material, start: 0, end: 120 }],
                  stage: {
                    comparisons: [
                      {
                        page: "existing-long-page",
                        quote: "既有调度条件要求队列长度不小于一且保留原有版本边界说明。",
                        reason: "在同一长页补充原生图",
                      },
                    ],
                  },
                },
              }),
            };
          }
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              read: p.catalog.map((x: { id: string }) => x.id),
              fetch: [],
              search: [],
              pages: [
                {
                  path: "sources/existing-long-page.md",
                  reason: "补充原生时序图",
                  toc: { part: "references", section: "测试资料" },
                  evidence: [p.notes[0].ref],
                  comparisons: [
                    {
                      page: "existing-long-page",
                      quote: "既有调度条件要求队列长度不小于一且保留原有版本边界说明。",
                      reason: "在同一长页补充原生图",
                    },
                  ],
                },
              ],
              question: "",
              report: "长页局部修订",
              done: true,
              outcome: { kind: "integrate", reason: "补充", comparisons: [] },
            }),
          };
        }
        if (p.mode === "drop-edit") {
          sawDropEditMode = true;
          const chunkMat = p.materials.find(
            (m: { id: string; start: number }) => m.id === p.range.id && m.start === p.range.start,
          )!;
          const text = chunkMat.text as string;
          if (p.range.start === 0) {
            const anchor = `  - "vllm@${commitSha}:vllm/v1/core/sched/scheduler.py#L1-L3"`;
            const idx = text.indexOf(anchor);
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              costUsd: 0,
              output: JSON.stringify({
                edits: [
                  {
                    start: p.range.start + idx,
                    end: p.range.start + idx + anchor.length,
                    old: anchor,
                    text: `${anchor}\n  - "${p.notes[0].ref}"`,
                  },
                ],
                revision: { id: "existing-long-page", kind: "supplement", reason: "补充新材料与原生图" },
                diagrams: [],
              }),
            };
          }
          const figFence = "```wiki-diagram\nfile: legacy-fig\n```";
          const fIdx = text.indexOf(figFence);
          if (fIdx >= 0) {
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              costUsd: 0,
              output: JSON.stringify({
                edits: [
                  {
                    start: p.range.start + fIdx,
                    end: p.range.start + fIdx + figFence.length,
                    old: figFence,
                    text: `${figFence}\n\n局部修订新增原生时序图与补充段落。\n\n\`\`\`wiki-diagram\nfile: ${String(diagPayload.id)}\n\`\`\``,
                  },
                ],
                revision: { id: "existing-long-page", kind: "supplement", reason: "补充新材料与原生图" },
                diagrams: [diagPayload],
              }),
            };
          }
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({ edits: [], revision: null, diagrams: [] }),
          };
        }
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({ issues: [], contradictions: [], report: "ok" }),
        };
      };

    const editBadBatch = await acceptBatch(f.root, {
      key: "edit-reject-code",
      items: [{ name: "edit-bad.md", text: "局部修订新增原生时序图与补充段落（动态导入拒绝负例）。\n" }],
    });
    const editBadDone = await (
      await startDrop(
        f.root,
        editBadBatch.id,
        {},
        {
          runAgent: makeEditAgent({
            id: "native-edit-bad",
            yaml: makeNativeYaml("native-edit-bad", commitSha),
            svg: HUMAN_NATIVE_SVG,
            dynamicImport: "import('./evil')",
          }),
        },
      )
    ).done;
    expect(editBadDone.state).toBe("failed");

    sawDropEditMode = false;
    const editOkBatch = await acceptBatch(f.root, {
      key: "edit-valid-native",
      items: [{ name: "edit-ok.md", text: "局部修订新增原生时序图与补充段落。\n" }],
    });
    const editDone = await (
      await startDrop(
        f.root,
        editOkBatch.id,
        {},
        {
          runAgent: makeEditAgent({
            id: "native-edit-ok",
            yaml: makeNativeYaml("native-edit-ok", commitSha),
            svg: HUMAN_NATIVE_SVG,
          }),
        },
      )
    ).done;
    expect(sawDropEditMode).toBe(true);
    expect(editDone.state, editDone.error).toBe("review");
    const editPublished = await approveReview(f.root, editDone.reviewId!);
    expect(editPublished.state).toBe("published");
    expect(readFileSync(join(f.root, "wiki/diagrams/native-edit-ok.svg"), "utf8")).toBe(HUMAN_NATIVE_SVG);
    expect(readFileSync(join(f.root, "wiki/diagrams/legacy-fig.svg"), "utf8")).toBe(existingFigureSvg);
    const updatedPage = readFileSync(join(f.root, "wiki/sources/existing-long-page.md"), "utf8");
    expect(updatedPage).toContain(`vllm@${commitSha}:vllm/v1/core/sched/scheduler.py#L1-L3`);
    expect(updatedPage).toContain("## 版本谱系\n\n- `v0.10.0`：保留脚本生成的版本谱系记录。");
    expect(validateIntegration(f.root, configuredRepoRoots(f.root))).toEqual([]);
  });

  it("真实调用链整链拦截缺伴生 SVG / 恶意 SVG / 非 native 附带 svg / 篡改版本谱系，并保持旧 {id,yaml} figure 全链路兼容", async () => {
    const { f, commitSha } = createFixtureWithLocalRepo();
    const runSinglePageDrop = async (
      batchKey: string,
      rawLine: string,
      pageId: string,
      diagramEntry: Record<string, unknown>,
    ) => {
      const batch = await acceptBatch(f.root, {
        key: batchKey,
        items: [{ name: `${batchKey}.md`, text: `${rawLine}\n` }],
      });
      const agent: RunAgent = async (req) => {
        const p = JSON.parse(req.stdin);
        if (p.mode === "drop-extract" || p.mode === "drop-read") {
          const t = (p.materials[0].text as string).trim();
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              summary: "单页测试摘要",
              quotes: [t.slice(0, 32)],
              conditions: ["边界条件"],
              topics: [{ name: batchKey, query: batchKey }],
            }),
          };
        }
        if (p.mode === "drop-discover") {
          const unread = p.catalog.filter(
            (c: { id: string }) => !p.read.some((r: { id: string }) => r.id === c.id),
          );
          if (unread.length) {
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              costUsd: 0,
              output: JSON.stringify({
                request: {
                  pages: unread.map((x: { id: string }) => x.id),
                  stage: {
                    ruledOutPages: unread.map((x: { id: string }) => ({ page: x.id, reason: "独立样本页" })),
                  },
                },
              }),
            };
          }
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              read: p.catalog.map((x: { id: string }) => x.id),
              fetch: [],
              search: [],
              pages: [
                {
                  path: `sources/${pageId}.md`,
                  reason: "独立样本",
                  toc: { part: "references", section: "测试资料" },
                  evidence: [p.notes[0].ref],
                  comparisons: [],
                },
              ],
              question: "",
              report: "单页计划",
              done: true,
              outcome: { kind: "integrate", reason: "新增", comparisons: [] },
            }),
          };
        }
        if (p.mode === "drop-generate") {
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              text: `---\nid: ${pageId}\ntitle: ${pageId}\ntype: source\nsummary: 样本说明\nsources: [${p.notes[0].ref}]\nevidence: I\nupdated: '2026-11-16'\n---\n${rawLine}\n\n\`\`\`wiki-diagram\nfile: ${String(diagramEntry.id)}\n\`\`\`\n`,
              diagrams: [diagramEntry],
              revision: null,
            }),
          };
        }
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({ issues: [], contradictions: [], report: "ok" }),
        };
      };
      return (await startDrop(f.root, batch.id, {}, { runAgent: agent })).done;
    };

    // 1) native-svg 缺少伴生 svg
    const missingSvgDone = await runSinglePageDrop(
      "missing-svg-case",
      "缺少伴生 SVG 的负例原文。",
      "p-no-svg",
      {
        id: "d-no-svg",
        yaml: makeNativeYaml("d-no-svg", commitSha),
      },
    );
    expect(missingSvgDone.state).toBe("failed");

    // 2) native-svg 携带恶意 <script>
    const unsafeSvgDone = await runSinglePageDrop(
      "unsafe-svg-case",
      "携带脚本标签的负例原文。",
      "p-bad-svg",
      {
        id: "d-bad-svg",
        yaml: makeNativeYaml("d-bad-svg", commitSha),
        svg: HUMAN_NATIVE_SVG.replace("</svg>", "<script>alert(1)</script></svg>"),
      },
    );
    expect(unsafeSvgDone.state).toBe("failed");

    // 3) figure 规格违规附带额外 svg 字段
    const figureYaml = stringify({
      layout: "figure",
      id: "d-fig-compat",
      caption: "兼容派生图",
      size: [480, 160],
      items: [{ at: [20, 20], size: [200, 60], text: "派生框", tone: "token" }],
    });
    const straySvgOnFigureDone = await runSinglePageDrop(
      "stray-svg-figure",
      "派生图误传额外 SVG 的负例原文。",
      "p-stray-fig",
      { id: "d-fig-compat", yaml: figureYaml, svg: HUMAN_NATIVE_SVG },
    );
    expect(straySvgOnFigureDone.state).toBe("failed");

    // 4) 传统 { id, yaml } figure 规格经同一共享契约正常生成并批准发布
    const legacyFigureDone = await runSinglePageDrop(
      "legacy-figure-ok",
      "传统派生图保持兼容的正例原文。",
      "p-fig-ok",
      { id: "d-fig-compat", yaml: figureYaml },
    );
    expect(legacyFigureDone.state, legacyFigureDone.error).toBe("review");
    const figPublished = await approveReview(f.root, legacyFigureDone.reviewId!);
    expect(figPublished.state).toBe("published");
    expect(readFileSync(join(f.root, "wiki/diagrams/d-fig-compat.svg"), "utf8")).toBe(
      renderDiagram(diagramSpecSchema.parse(parseYaml(figureYaml))),
    );
  });
});
