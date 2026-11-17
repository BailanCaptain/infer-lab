/**
 * 922 返修回归（确定性零付费 RunAgent 协议与完整性复核测试，不冒充真实大模型语义 E2E）：
 * 1) P2-1：真实 startDrop 在 drop-generate / drop-section / drop-edit 三路送给 RunAgent 的 req.args
 *    必须广告 mode="native-svg" 纯数据契约、移除冲突的“禁止提供 SVG”，并保留历史封存 rules-snapshot 字节。
 * 2) P2-2：未改写旧页共享 native-svg 且仅修改 .svg 时，生产 asset 复核与批准门禁 validateDropReceipt
 *    均强制绑定当前候选 YAML + SVG 完整范围，拦截矛盾更新与删/换/截断 SVG 绑定。
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { stringify } from "yaml";
import type { RunAgent } from "./batch";
import { stageDropDiagram } from "./drop-assets";
import { acceptBatch } from "./drop-batch";
import { validateDropReceipt } from "./drop-receipt";
import { startDrop } from "./drop-run";
import { saveRawSnapshot } from "./raw";
import { approveReview, readReview } from "./review";
import { loadStandardConfig } from "./standard";
import { handbookFixture, wikiFixture } from "./test-fixture";
import { atomicText, digest } from "./workflow";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});

function createBaseFixture() {
  const f = wikiFixture();
  fixtures.push(f);
  f.write("wiki/HANDBOOK.md", handbookFixture());
  f.write("wiki/log.md", "# Wiki log\n");
  return f;
}

const SHARED_YAML = stringify({
  mode: "native-svg",
  id: "shared-native",
  caption: "队列配置",
  size: [240, 80],
  pins: [],
});
const makeSharedSvg = (label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80" viewBox="0 0 240 80"><title>队列配置</title><text x="10" y="30">${label}</text></svg>\n`;
describe("922 P2-1 & P2-2 回归：三路真实指令广告与共享 native-svg 双文件复核门禁", () => {
  it("P2-1: generated / section / edited 三路真实 req.args 均广告 native-svg 契约且无禁止提供 SVG，旧封存快照保留原字节", async () => {
    const f = createBaseFixture();
    f.write(
      "wiki/sync.config.local.json",
      JSON.stringify({ contextWindowTokens: 52000, outputReserveTokens: 4096 }),
    );
    const oldRaw = saveRawSnapshot(join(f.root, "wiki"), "既有长页原始依据。\n");
    const longBody = "既有长页段落保留全部有效限定条件。\n".repeat(260);
    f.write(
      "wiki/sources/long-target.md",
      `---\nid: long-target\ntitle: 长页目标\ntype: source\nsummary: 长页目标\nsources: ["raw:${oldRaw.slice(4)}#L1"]\nevidence: "I"\nupdated: '2026-11-16'\n---\n## 记录\n\n${longBody}`,
    );

    const capturedArgs = { generate: "", section: "", edit: "" };
    let capturedDiagramContract = "";
    const batch = await acceptBatch(f.root, {
      key: "three-modes-args-audit",
      items: [{ name: "multi.md", text: "本批同时验证整页生成、分节生成与长页局部修订的实际系统指令。\n" }],
    });

    const agent: RunAgent = async (req) => {
      const p = JSON.parse(req.stdin);
      const argsJoined = req.args.join("\n");
      if (p.mode === "drop-extract" || p.mode === "drop-read") {
        const line = (p.materials[0].text as string).split("\n").find((l) => l.trim().length > 3)!;
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            summary: "摘要",
            quotes: [line.trim().slice(0, 32)],
            conditions: ["条件"],
            topics: [{ name: "长页目标", query: "long-target" }],
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
            output: JSON.stringify({ request: { pages: unread.map((x: { id: string }) => x.id) } }),
          };
        }
        const lt = p.read.find((r: { id: string }) => r.id === "long-target");
        const rem = lt?.remainingRanges ?? [];
        if (rem.length) {
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              request: {
                materials: [{ id: lt.material, start: rem[0].start, end: rem[0].end }],
                stage: {
                  comparisons: [
                    { page: "long-target", quote: "既有长页段落保留全部有效限定条件。", reason: "补充" },
                  ],
                },
              },
            }),
          };
        }
        const needStage = p.materials.some(
          (m: { id: string }) =>
            m.id === lt?.material &&
            !(p.discoveryProgress?.stagedComparisons ?? []).some(
              (c: { page: string }) => c.page === "long-target",
            ),
        );
        if (needStage) {
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              request: {
                materials: [{ id: lt.material, start: 0, end: 80 }],
                stage: {
                  comparisons: [
                    { page: "long-target", quote: "既有长页段落保留全部有效限定条件。", reason: "补充" },
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
            read: ["long-target"],
            fetch: [],
            search: [],
            pages: [
              {
                path: "sources/gen-page.md",
                reason: "验证整页生成",
                toc: { part: "references", section: "测试" },
                evidence: [p.notes[0].ref],
                comparisons: [],
              },
              {
                path: "sources/sec-page.md",
                reason: "验证分节生成",
                toc: { part: "references", section: "测试" },
                evidence: [p.notes[0].ref],
                comparisons: [],
              },
              {
                path: "sources/long-target.md",
                reason: "验证长页修订",
                toc: { part: "references", section: "测试" },
                evidence: [p.notes[0].ref],
                comparisons: [
                  { page: "long-target", quote: "既有长页段落保留全部有效限定条件。", reason: "补充" },
                ],
              },
            ],
            question: "",
            report: "三路验证",
            done: true,
            outcome: { kind: "integrate", reason: "新增与补充", comparisons: [] },
          }),
        };
      }
      if (p.mode === "drop-generate") {
        capturedArgs.generate = argsJoined;
        if (p.target.path === "sources/gen-page.md") {
          const contractMat = p.materials.find(
            (m: { id: string; text: string }) => m.id === p.diagramContract?.material,
          );
          if (!contractMat) {
            const info = p.navigation.inventory.find(
              (r: { id: string; length: number }) => r.id === p.diagramContract.material,
            )!;
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              costUsd: 0,
              output: JSON.stringify({
                request: {
                  materials: [
                    {
                      id: p.diagramContract.material,
                      start: Math.max(0, info.length - 10000),
                      end: info.length,
                    },
                  ],
                },
              }),
            };
          }
          capturedDiagramContract = contractMat.text as string;
        }
        if (p.target.path === "sources/sec-page.md") {
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              frontmatter: `---\nid: sec-page\ntitle: 分节页\ntype: source\nsummary: 分节页\nsources: [${p.notes[0].ref}]\nevidence: I\nupdated: '2026-11-16'\n---`,
              sections: [{ id: "s1", title: "第一节", instructions: "写内容" }],
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
            text: `---\nid: gen-page\ntitle: 生成页\ntype: source\nsummary: 生成页\nsources: [${p.notes[0].ref}]\nevidence: I\nupdated: '2026-11-16'\n---\n本批同时验证整页生成、分节生成与长页局部修订的实际系统指令。\n`,
            diagrams: [],
            revision: null,
          }),
        };
      }
      if (p.mode === "drop-section") {
        capturedArgs.section = argsJoined;
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            text: "## 第一节\n\n本批同时验证整页生成、分节生成与长页局部修订的实际系统指令。",
            diagrams: [],
          }),
        };
      }
      if (p.mode === "drop-edit") {
        capturedArgs.edit = argsJoined;
        const mat = p.materials.find(
          (m: { id: string; start: number }) => m.id === p.range.id && m.start === p.range.start,
        )!;
        const t = mat.text as string;
        if (p.range.start === 0) {
          const oldRef = `"raw:${oldRaw.slice(4)}#L1"`;
          const idx = t.indexOf(oldRef);
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              edits: [
                {
                  start: idx,
                  end: idx + oldRef.length,
                  old: oldRef,
                  text: `${oldRef}, "${p.notes[0].ref}"`,
                },
              ],
              revision: { id: "long-target", kind: "supplement", reason: "补充来源" },
              diagrams: [],
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

    const done = await (await startDrop(f.root, batch.id, {}, { runAgent: agent })).done;
    expect(done.state, done.error).toBe("review");
    for (const [modeName, argsText] of Object.entries(capturedArgs)) {
      expect(argsText.length, `${modeName} must be invoked`).toBeGreaterThan(0);
      expect(argsText, `${modeName} must not forbid SVG`).not.toContain("禁止提供 SVG");
      expect(argsText, `${modeName} must advertise native-svg`).toContain("native-svg");
      expect(argsText, `${modeName} must forbid code/components`).toMatch(/组件|模块路径|代码/);
    }
    expect(capturedDiagramContract).toContain("nativeSvgSpecSchema");
    expect(capturedDiagramContract).toContain("ALLOWED_TAGS");
    expect(capturedDiagramContract).toContain("ATTR_GRAMMARS");
    expect(capturedDiagramContract).toContain("validateNativeSvg");

    // 旧封存 rules-snapshot.json（无 nativeSvgContract 字段）保留原规则字节
    const legacyBatch = await acceptBatch(f.root, {
      key: "legacy-sealed-snapshot",
      items: [{ name: "legacy.md", text: "旧封存批次保留旧系统提示词字节。\n" }],
    });
    const runDir = join(f.root, `wiki/_jobs/drops/runs/${legacyBatch.id}/0`);
    mkdirSync(runDir, { recursive: true });
    const { pages: _p, skip: _s, ...wc } = loadStandardConfig();
    writeFileSync(
      join(runDir, "rules-snapshot.json"),
      JSON.stringify({
        standard: "fixture-std",
        calc: "fixture-calc",
        diagramContract: "fixture-contract",
        writingChecks: wc,
        runDate: "2026-11-10",
      }),
    );
    let legacyGenArgs = "";
    await (
      await startDrop(
        f.root,
        legacyBatch.id,
        {},
        {
          runAgent: async (req) => {
            const p = JSON.parse(req.stdin);
            if (p.mode === "drop-generate") legacyGenArgs = req.args.join("\n");
            if (p.mode === "drop-extract" || p.mode === "drop-read") {
              return {
                id: req.id,
                ok: true,
                exitCode: 0,
                stderrTail: "",
                costUsd: 0,
                output: JSON.stringify({
                  summary: "s",
                  quotes: [(p.materials[0].text as string).trim().slice(0, 20)],
                  conditions: [],
                  topics: [{ name: "legacy", query: "legacy" }],
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
                        ruledOutPages: unread.map((x: { id: string }) => ({ page: x.id, reason: "无关" })),
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
                      path: "sources/legacy-out.md",
                      reason: "旧快照验证",
                      toc: { part: "references", section: "测试" },
                      evidence: [p.notes[0].ref],
                      comparisons: [],
                    },
                  ],
                  question: "",
                  report: "ok",
                  done: true,
                  outcome: { kind: "integrate", reason: "ok", comparisons: [] },
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
                  text: `---\nid: legacy-out\ntitle: 旧快照页\ntype: source\nsummary: 旧快照页\nsources: [${p.notes[0].ref}]\nevidence: I\nupdated: '2026-11-10'\n---\n旧封存批次保留旧系统提示词字节。\n`,
                  diagrams: [],
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
          },
        },
      )
    ).done;
    expect(legacyGenArgs).toContain("禁止提供 SVG 或任意代码");
  });
  it("P2-2: 共享 native-svg 仅修改 SVG 时向未改写旧页提供完整 YAML+SVG，拦截矛盾更新并在批准门禁拒绝删/换/截断 SVG 绑定", async () => {
    const f = createBaseFixture();
    const oldStatement = "设备甲的队列上限始终是四个请求。";
    const oldRaw = saveRawSnapshot(join(f.root, "wiki"), `${oldStatement}\n`);
    stageDropDiagram(f.root, "shared-native", SHARED_YAML, makeSharedSvg("MAX_QUEUE=4"));
    const makePage = (id: string, title: string, ref: string, body: string) =>
      `---\nid: ${id}\ntitle: ${title}\ntype: source\nsummary: ${title}\nsources: ["${ref}"]\nevidence: "I"\nupdated: '2026-11-16'\n---\n## 配置\n\n${body}\n\n\`\`\`wiki-diagram\nfile: shared-native\n\`\`\`\n`;
    f.write(
      "wiki/sources/old-device.md",
      makePage("old-device", "设备甲配置", `raw:${oldRaw.slice(4)}#L1`, oldStatement),
    );

    const runSharedUpdate = async (
      batchKey: string,
      newBody: string,
      newLabel: string,
      contradictOnEight: boolean,
    ) => {
      const batch = await acceptBatch(f.root, {
        key: batchKey,
        items: [{ name: `${batchKey}.md`, text: `${newBody}\n` }],
      });
      let oldPageSawNewSvg = false;
      const done = await (
        await startDrop(
          f.root,
          batch.id,
          {},
          {
            runAgent: async (req) => {
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
                    summary: "设备配置",
                    quotes: [t.slice(0, 60)],
                    conditions: ["按设备核对"],
                    topics: [{ name: "设备配置", query: "设备配置" }],
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
                    output: JSON.stringify({ request: { pages: unread.map((c: { id: string }) => c.id) } }),
                  };
                }
                return {
                  id: req.id,
                  ok: true,
                  exitCode: 0,
                  stderrTail: "",
                  costUsd: 0,
                  output: JSON.stringify({
                    read: p.catalog.map((c: { id: string }) => c.id),
                    fetch: [],
                    search: [],
                    pages: [
                      {
                        path: `sources/${batchKey}-page.md`,
                        reason: "新增设备配置页",
                        toc: { part: "references", section: "测试资料" },
                        evidence: [p.notes[0].ref],
                        comparisons: [
                          { page: "old-device", quote: oldStatement, reason: "核对共享图兼容性" },
                        ],
                      },
                    ],
                    question: "",
                    report: "共享图核对",
                    done: true,
                    outcome: { kind: "integrate", reason: "新增设备页", comparisons: [] },
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
                    text: makePage(`${batchKey}-page`, "新设备配置", p.notes[0].ref, newBody),
                    revision: null,
                    diagrams: [{ id: "shared-native", yaml: SHARED_YAML, svg: makeSharedSvg(newLabel) }],
                  }),
                };
              }
              if (
                p.mode === "drop-check" &&
                p.task?.kind === "asset" &&
                p.task.pages.includes("old-device")
              ) {
                if (p.materials.some((m: { text: string }) => m.text.includes(newLabel))) {
                  oldPageSawNewSvg = true;
                  if (contradictOnEight) {
                    return {
                      id: req.id,
                      ok: true,
                      exitCode: 0,
                      stderrTail: "",
                      costUsd: 0,
                      output: JSON.stringify({
                        issues: ["设备甲旧页要求四个请求，但共享原生图改为八请求产生矛盾"],
                        contradictions: [],
                        report: "contradiction detected via shared native SVG",
                      }),
                    };
                  }
                }
              }
              return {
                id: req.id,
                ok: true,
                exitCode: 0,
                stderrTail: "",
                costUsd: 0,
                output: JSON.stringify({ issues: [], contradictions: [], report: "ok" }),
              };
            },
          },
        )
      ).done;
      return { done, oldPageSawNewSvg };
    };

    // 1) 共享 SVG 仅改内容且与未改写旧页矛盾 -> 复核看到新 SVG 并整链拒绝
    const conflict = await runSharedUpdate(
      "conflict-b",
      "设备乙的独立队列上限是八个请求。",
      "MAX_QUEUE=8",
      true,
    );
    expect(conflict.oldPageSawNewSvg).toBe(true);
    expect(conflict.done.state).toBe("failed");
    expect(conflict.done.error).toContain("设备甲旧页要求四个请求");
    expect(readFileSync(join(f.root, "wiki/diagrams/shared-native.svg"), "utf8")).toContain("MAX_QUEUE=4");

    // 2) 兼容共享更新（同时标明 A=4, B=8）-> 复核看到新 SVG 并进入待审阅
    const compatSvg = makeSharedSvg("MAX_QUEUE_A=4, MAX_QUEUE_B=8");
    const compat = await runSharedUpdate(
      "compat-b",
      "设备乙队列上限八请求，共享图同时保留甲四乙八。",
      "MAX_QUEUE_A=4, MAX_QUEUE_B=8",
      false,
    );
    expect(compat.oldPageSawNewSvg).toBe(true);
    expect(compat.done.state, compat.done.error).toBe("review");

    const review = readReview(f.root, compat.done.reviewId!);
    const drop = review.payload.drop!;
    const receipt = drop.receipt!;
    const oldAssetCheck = receipt.checks.find((c) => c.kind === "asset" && c.pages.includes("old-device"))!;
    const newSvgRes = receipt.resources.find(
      (r) => r.kind === "diagram" && r.path === "diagrams/shared-native.svg" && r.hash === digest(compatSvg),
    );
    expect(newSvgRes).toBeTruthy();

    // 2a) 篡改回执：删掉 old-device asset 复核中的 SVG 绑定 -> validateDropReceipt 与持久化 approveReview 均拒绝
    const droppedSvgDrop = structuredClone(drop);
    for (const c of droppedSvgDrop.receipt!.checks) {
      if (c.kind === "asset" && c.pages.includes("old-device")) {
        c.bindings = c.bindings.filter((b) => b.id !== newSvgRes!.id);
      }
    }
    expect(() =>
      validateDropReceipt(f.root, droppedSvgDrop, review.payload.writes, review.payload.decision.revisions),
    ).toThrow();

    // 2b) 篡改回执：把 SVG 绑定换成旧版 MAX_QUEUE=4 资源或截断为残缺范围 -> 均拒绝
    const oldSvgRes = receipt.resources.find(
      (r) =>
        r.kind === "diagram" &&
        r.path === "diagrams/shared-native.svg" &&
        r.hash === digest(makeSharedSvg("MAX_QUEUE=4")),
    );
    expect(oldSvgRes).toBeTruthy();
    const swappedSvgDrop = structuredClone(drop);
    for (const c of swappedSvgDrop.receipt!.checks) {
      if (c.kind === "asset" && c.pages.includes("old-device")) {
        c.bindings = c.bindings.map((b) =>
          b.id === newSvgRes!.id
            ? { id: oldSvgRes!.id, hash: oldSvgRes!.hash, start: 0, end: oldSvgRes!.length }
            : b,
        );
      }
    }
    expect(() =>
      validateDropReceipt(f.root, swappedSvgDrop, review.payload.writes, review.payload.decision.revisions),
    ).toThrow();

    const truncatedSvgDrop = structuredClone(drop);
    for (const c of truncatedSvgDrop.receipt!.checks) {
      if (c.kind === "asset" && c.pages.includes("old-device")) {
        c.bindings = c.bindings.map((b) =>
          b.id === newSvgRes!.id ? { ...b, end: Math.max(1, b.end - 5) } : b,
        );
      }
    }
    expect(() =>
      validateDropReceipt(f.root, truncatedSvgDrop, review.payload.writes, review.payload.decision.revisions),
    ).toThrow();

    // 持久化落盘篡改后的 Review 并重算外层 id，验证真实 approveReview 同样拒绝
    const tamperedPayload = { ...review.payload, drop: droppedSvgDrop };
    const tamperedId = digest(JSON.stringify(tamperedPayload));
    atomicText(
      join(f.root, `wiki/_jobs/reviews/${tamperedId}.json`),
      `${JSON.stringify({ id: tamperedId, state: "pending", payload: tamperedPayload }, null, 2)}\n`,
    );
    await expect(approveReview(f.root, tamperedId)).rejects.toThrow();

    // 2c) 未篡改的原始 Review 正常批准发布，SVG 字节精确更新
    expect(
      oldAssetCheck.bindings.some(
        (b) => b.id === newSvgRes!.id && b.start === 0 && b.end === newSvgRes!.length,
      ),
    ).toBe(true);
    const published = await approveReview(f.root, review.id);
    expect(published.state).toBe("published");
    expect(readFileSync(join(f.root, "wiki/diagrams/shared-native.svg"), "utf8")).toBe(compatSvg);
  });

  it("953 P2: 128K 真实手册/写作标准/术语表下长教学页与临界教学页按真实协议负载动态分片修订并完整覆盖 [0, length]", async () => {
    for (const repeatCount of [260, 210]) {
      const f = createBaseFixture();
      f.write("wiki/HANDBOOK.md", readFileSync(new URL("../../wiki/HANDBOOK.md", import.meta.url), "utf8"));
      f.write("wiki/TERMS.md", readFileSync(new URL("../../wiki/TERMS.md", import.meta.url), "utf8"));
      f.write(
        "wiki/sync.config.local.json",
        JSON.stringify({ contextWindowTokens: 128_000, outputReserveTokens: 16_384 }),
      );
      f.write(
        "wiki/sources/base-ref.md",
        '---\nid: base-ref\ntitle: base-ref\ntype: source\nsummary: Reference\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: I\nupdated: "2026-10-06"\n---\nReference definition.\n',
      );
      const oldConcept =
        "---\nid: paged-attention\ntitle: PagedAttention：块表与分页缓存\ntype: concept\nsummary: 分页管理 KV Cache 避免连续预留碎片。\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: S\nrelations:\n  - to: base-ref\n    kind: builds-on\n    note: 基于基础定义\nupdated: '2026-10-06'\n---\n## 为什么固定预留会浪费显存\n" +
        "分页块表按 128 个位置切块，避免把整段预留空白算成占用。\n".repeat(repeatCount) +
        "\n## 对照源码\n见上游文档说明 [S1]。\n";
      f.write("wiki/concepts/paged-attention.md", oldConcept);
      const sourceMaterial = "补充跨请求前缀共享计数引用条件与归还时机。\n".repeat(160);
      const b = await acceptBatch(f.root, {
        key: `concept-128k-${repeatCount}`,
        items: [{ name: "pa-notes.md", text: sourceMaterial }],
      });
      const editSpans: { start: number; end: number; inputBytes: number }[] = [];
      const done = await (
        await startDrop(
          f.root,
          b.id,
          { newAttempt: true },
          {
            validate: () => [],
            runAgent: async (req) => {
              const p = JSON.parse(req.stdin);
              if (p.mode === "drop-extract" || p.mode === "drop-read") {
                return {
                  id: req.id,
                  ok: true,
                  exitCode: 0,
                  stderrTail: "",
                  costUsd: 0,
                  output: JSON.stringify({
                    summary: "块表与引用计数条件",
                    quotes: [p.materials[0].text.slice(0, 40)],
                    conditions: ["block_size=128"],
                    topics: [{ name: "PagedAttention", query: "paged-attention" }],
                  }),
                };
              }
              if (p.mode === "drop-discover") {
                const needRead = !p.read.some((r: { id: string }) => r.id === "paged-attention");
                return {
                  id: req.id,
                  ok: true,
                  exitCode: 0,
                  stderrTail: "",
                  costUsd: 0,
                  output: JSON.stringify({
                    read: needRead ? ["paged-attention", "base-ref"] : [],
                    fetch: [],
                    search: [],
                    pages: needRead
                      ? []
                      : [
                          {
                            path: "concepts/paged-attention.md",
                            reason: "补充共享引用归还条件",
                            toc: { part: "inference", section: "KV 缓存" },
                            evidence: [p.notes[0].ref],
                            comparisons: [
                              {
                                page: "paged-attention",
                                quote: "分页块表按 128 个位置切块，避免把整段预留空白算成占用。",
                                reason: "在原块表机制上补充共享归还条件",
                              },
                            ],
                          },
                        ],
                    question: "",
                    report: "补充 PagedAttention 共享块归还条件",
                    done: !needRead,
                    outcome: { kind: "integrate", reason: "修订现有教学页", comparisons: [] },
                  }),
                };
              }
              if (p.mode === "drop-edit") {
                editSpans.push({
                  start: p.range.start,
                  end: p.range.end,
                  inputBytes: Buffer.byteLength(req.stdin, "utf8"),
                });
                const edits = [];
                if (p.range.start === 0) {
                  const srcNeedle = "https://docs.vllm.ai/en/latest/";
                  const start = oldConcept.indexOf(srcNeedle);
                  edits.push({
                    start,
                    end: start + srcNeedle.length,
                    old: srcNeedle,
                    text: `${srcNeedle}, ${p.notes[0].ref}`,
                  });
                }
                const firstMatch = p.materials.find((m: { id: string }) => m.id === p.range.id);
                const needle = "见上游文档说明 [S1]。";
                const idx = firstMatch ? firstMatch.text.indexOf(needle) : -1;
                if (idx >= 0) {
                  edits.push({
                    start: p.range.start + idx,
                    end: p.range.start + idx + needle.length,
                    old: needle,
                    text: `${needle}\n补充跨请求前缀共享计数引用条件与归还时机 [I]。`,
                  });
                }
                return {
                  id: req.id,
                  ok: true,
                  exitCode: 0,
                  stderrTail: "",
                  costUsd: 0,
                  output: JSON.stringify({
                    edits,
                    diagrams: [],
                    revision: { id: "paged-attention", kind: "supplement", reason: "补充共享归还条件" },
                  }),
                };
              }
              return {
                id: req.id,
                ok: true,
                exitCode: 0,
                stderrTail: "",
                costUsd: 0,
                output: JSON.stringify({ issues: [], contradictions: [], report: "一致" }),
              };
            },
          },
        )
      ).done;
      expect(done.state, `repeat=${repeatCount}: ${done.error ?? ""}`).toBe("review");
      expect(editSpans.length).toBeGreaterThanOrEqual(2);
      expect(editSpans[0]!.start).toBe(0);
      expect(editSpans.at(-1)!.end).toBe(oldConcept.length);
      for (let i = 1; i < editSpans.length; i++) {
        expect(editSpans[i]!.start).toBe(editSpans[i - 1]!.end);
      }
      const review = readReview(f.root, done.reviewId!);
      expect(() =>
        validateDropReceipt(
          f.root,
          review.payload.drop,
          review.payload.writes,
          review.payload.decision.revisions,
        ),
      ).not.toThrow();
    }
  });

  it("960 P2: 窄预算下代理对 emoji、重转义单行与 ASCII 精确分片严格收敛且不切裂 Unicode 字符，超限则有限失败", async () => {
    const assertWellFormedUtf16 = (slice: string) => {
      expect(/^[\uDC00-\uDFFF]/.test(slice)).toBe(false);
      expect(/[\uD800-\uDBFF]$/.test(slice)).toBe(false);
      for (let i = 0; i < slice.length; i++) {
        const code = slice.charCodeAt(i);
        if (code >= 0xd800 && code <= 0xdbff) {
          const low = slice.charCodeAt(i + 1);
          expect(low >= 0xdc00 && low <= 0xdfff).toBe(true);
          i++;
        } else {
          expect(code >= 0xdc00 && code <= 0xdfff).toBe(false);
        }
      }
    };

    for (const [keySuffix, lineUnit] of [
      ["emoji", "🔍🧪🚀".repeat(120)],
      ["escaped-emoji", '\\"🔍\\t'.repeat(95)],
      ["escaped-ascii", '\\"\\\\'.repeat(130)],
    ] as const) {
      const f = createBaseFixture();
      f.write("wiki/HANDBOOK.md", readFileSync(new URL("../../wiki/HANDBOOK.md", import.meta.url), "utf8"));
      f.write("wiki/TERMS.md", readFileSync(new URL("../../wiki/TERMS.md", import.meta.url), "utf8"));
      // 真实手册/标准下 drop-edit 规则约 76KB，121K 窗口使编辑每片仅余约 3.8KB，强制多片精确切分
      f.write(
        "wiki/sync.config.local.json",
        JSON.stringify({ contextWindowTokens: 121_000, outputReserveTokens: 16_384 }),
      );
      const oldRaw = saveRawSnapshot(join(f.root, "wiki"), "窄预算 Unicode 代理对原始依据。\n");
      const oldDoc = `---\nid: uni-doc\ntitle: Unicode 窄预算验证\ntype: concept\nsummary: 窄预算验证\nsources: ["raw:${oldRaw.slice(4)}#L1"]\nevidence: "S"\nupdated: '2026-11-16'\n---\n## 为什么需要校验代理对边界\n\n${`${lineUnit}\n`.repeat(14)}\n## 对照源码\n见原始记录 [S1]。\n`;
      f.write("wiki/concepts/uni-doc.md", oldDoc);

      const b = await acceptBatch(f.root, {
        key: `narrow-${keySuffix}`,
        items: [{ name: "u.md", text: `${"补充窄预算代理对条件。\n".repeat(160)}` }],
      });
      const spans: { start: number; end: number; text: string }[] = [];
      const done = await (
        await startDrop(
          f.root,
          b.id,
          { newAttempt: true },
          {
            validate: () => [],
            runAgent: async (req) => {
              const p = JSON.parse(req.stdin);
              if (p.mode === "drop-extract" || p.mode === "drop-read") {
                return {
                  id: req.id,
                  ok: true,
                  exitCode: 0,
                  stderrTail: "",
                  costUsd: 0,
                  output: JSON.stringify({
                    summary: "窄预算摘要",
                    quotes: [(p.materials[0].text as string).trim().slice(0, 18)],
                    conditions: [],
                    topics: [{ name: "uni", query: "uni-doc" }],
                  }),
                };
              }
              if (p.mode === "drop-discover") {
                const needRead = !p.read.some((r: { id: string }) => r.id === "uni-doc");
                return {
                  id: req.id,
                  ok: true,
                  exitCode: 0,
                  stderrTail: "",
                  costUsd: 0,
                  output: JSON.stringify({
                    read: needRead ? ["uni-doc"] : [],
                    fetch: [],
                    search: [],
                    pages: needRead
                      ? []
                      : [
                          {
                            path: "concepts/uni-doc.md",
                            reason: "补充窄预算条件",
                            toc: { part: "inference", section: "KV 缓存" },
                            evidence: [p.notes[0].ref],
                            comparisons: [
                              { page: "uni-doc", quote: "## 为什么需要校验代理对边界", reason: "补充" },
                            ],
                          },
                        ],
                    question: "",
                    report: "窄预算测试",
                    done: !needRead,
                    outcome: { kind: "integrate", reason: "补充", comparisons: [] },
                  }),
                };
              }
              if (p.mode === "drop-edit") {
                const mat = p.materials.find(
                  (m: { id: string; start: number }) => m.id === p.range.id && m.start === p.range.start,
                )!;
                spans.push({ start: p.range.start, end: p.range.end, text: mat.text as string });
                if (p.range.start === 0) {
                  const oldRef = `"raw:${oldRaw.slice(4)}#L1"`;
                  const idx = (mat.text as string).indexOf(oldRef);
                  return {
                    id: req.id,
                    ok: true,
                    exitCode: 0,
                    stderrTail: "",
                    costUsd: 0,
                    output: JSON.stringify({
                      edits: [
                        {
                          start: idx,
                          end: idx + oldRef.length,
                          old: oldRef,
                          text: `${oldRef}, "${p.notes[0].ref}"`,
                        },
                      ],
                      revision: { id: "uni-doc", kind: "supplement", reason: "补充来源" },
                      diagrams: [],
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
            },
          },
        )
      ).done;
      expect(done.state, `${keySuffix}: ${done.error ?? ""}`).toBe("review");
      expect(spans.length).toBeGreaterThanOrEqual(2);
      expect(spans[0]!.start).toBe(0);
      expect(spans.at(-1)!.end).toBe(oldDoc.length);
      for (let i = 0; i < spans.length; i++) {
        assertWellFormedUtf16(spans[i]!.text);
        if (i > 0) expect(spans[i]!.start).toBe(spans[i - 1]!.end);
      }
      const review = readReview(f.root, done.reviewId!);
      expect(() =>
        validateDropReceipt(
          f.root,
          review.payload.drop,
          review.payload.writes,
          review.payload.decision.revisions,
        ),
      ).not.toThrow();
    }

    // 不可容纳的极端窄预算（真实标准下直达 drop-edit 时必需来源本身已超编辑上限）：必须有限终止并返回明确预算不足错误
    const tight = createBaseFixture();
    tight.write("wiki/HANDBOOK.md", readFileSync(new URL("../../wiki/HANDBOOK.md", import.meta.url), "utf8"));
    tight.write("wiki/TERMS.md", readFileSync(new URL("../../wiki/TERMS.md", import.meta.url), "utf8"));
    tight.write(
      "wiki/sync.config.local.json",
      JSON.stringify({ contextWindowTokens: 108_000, outputReserveTokens: 16_384 }),
    );
    const tightRaw = saveRawSnapshot(join(tight.root, "wiki"), "紧预算依据。\n");
    tight.write(
      "wiki/concepts/tight-doc.md",
      `---\nid: tight-doc\ntitle: 紧预算\ntype: concept\nsummary: 紧预算\nsources: ["raw:${tightRaw.slice(4)}#L1"]\nevidence: "S"\nupdated: '2026-11-16'\n---\n## 记录\n\n${"🔍".repeat(6500)}\n\n## 对照源码\n见依据 [S1]。\n`,
    );
    const tightBatch = await acceptBatch(tight.root, {
      key: "unfit-emoji-finite-fail",
      items: [{ name: "tight.md", text: `${"必需来源占据编辑可用预算上限。\n".repeat(160)}` }],
    });
    const tightDone = await (
      await startDrop(
        tight.root,
        tightBatch.id,
        { newAttempt: true },
        {
          validate: () => [],
          runAgent: async (req) => {
            const p = JSON.parse(req.stdin);
            if (p.mode === "drop-extract" || p.mode === "drop-read") {
              return {
                id: req.id,
                ok: true,
                exitCode: 0,
                stderrTail: "",
                costUsd: 0,
                output: JSON.stringify({
                  summary: "s",
                  quotes: [(p.materials[0].text as string).trim().slice(0, 12)],
                  conditions: [],
                  topics: [{ name: "tight", query: "tight-doc" }],
                }),
              };
            }
            if (p.mode === "drop-discover") {
              const needRead = !p.read.some((r: { id: string }) => r.id === "tight-doc");
              return {
                id: req.id,
                ok: true,
                exitCode: 0,
                stderrTail: "",
                costUsd: 0,
                output: JSON.stringify({
                  read: needRead ? ["tight-doc"] : [],
                  fetch: [],
                  search: [],
                  pages: needRead
                    ? []
                    : [
                        {
                          path: "concepts/tight-doc.md",
                          reason: "补充",
                          toc: { part: "inference", section: "KV 缓存" },
                          evidence: [p.notes[0].ref],
                          comparisons: [{ page: "tight-doc", quote: "## 记录", reason: "补充" }],
                        },
                      ],
                  question: "",
                  report: "tight",
                  done: !needRead,
                  outcome: { kind: "integrate", reason: "补充", comparisons: [] },
                }),
              };
            }
            if (p.mode === "drop-edit") {
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
          },
        },
      )
    ).done;
    expect(tightDone.state).toBe("failed");
    expect(tightDone.error).toContain("整合：tight-doc:0:0");
    expect(tightDone.error).toContain("上下文预算不足");
  });
});
