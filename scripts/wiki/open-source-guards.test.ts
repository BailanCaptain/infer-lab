import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stringify } from "yaml";
import { buildChatRequest } from "../../server/chat";
import { readStatus, saveChatModel } from "../../server/status";
import { resolveClaudeCommand, resolveWindowsCmdShim } from "./claude-cli";
import { stageDropDiagram } from "./drop-assets";
import { acceptBatch } from "./drop-batch";
import { startDrop } from "./drop-run";
import { createBlobReader } from "./git";
import { stripNonAuthoringStandard } from "./handbook";
import { validateIntegrationDetailed } from "./integration-check";
import { runLint, splitProblems } from "./lint";
import { normalizeNativeSvg, validateNativeSvg } from "./native-svg";
import { saveRawSnapshot } from "./raw";
import { restrictedArgs } from "./restricted-claude";
import { approveReview, createReview } from "./review";
import { wikiContents } from "./review-files";
import { integrateSections } from "./section-integration";
import { readSyncConfig } from "./sync-config";
import { handbookFixture, wikiFixture } from "./test-fixture";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
const tempDirs: string[] = [];

afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
  for (const d of tempDirs.splice(0)) rmSync(d, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("Deliverable 1: staging public/wiki-illustrations & upfront disk check", () => {
  it("lint checks both double- and single-quoted href='./wiki-illustrations/...' and resolves publicRoot", () => {
    const f = wikiFixture();
    fixtures.push(f);
    f.write("wiki/HANDBOOK.md", handbookFixture());
    const svgSingle =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240" width="600" height="240"><image href=\'./wiki-illustrations/demo-plate.webp\' x="20" y="20" width="200" height="120"/></svg>\n';
    f.write(
      "wiki/diagrams/demo-plate.yaml",
      stringify({ mode: "native-svg", id: "demo-plate", caption: "测试剖面图", size: [600, 240], pins: [] }),
    );
    f.write("wiki/diagrams/demo-plate.svg", svgSingle);

    const missing = splitProblems(runLint(f.root, { terms: false })).errors;
    expect(missing.some((p) => p.rule === "missing-diagram-illustration")).toBe(true);

    // Providing a separate publicRoot containing the webp resolves cleanly
    const externalPublic = mkdtempSync(join(tmpdir(), "wiki-public-"));
    tempDirs.push(externalPublic);
    mkdirSync(join(externalPublic, "wiki-illustrations"), { recursive: true });
    writeFileSync(join(externalPublic, "wiki-illustrations/demo-plate.webp"), Buffer.from("RIFFWEBP"));

    const ok = splitProblems(runLint(f.root, { terms: false, publicRoot: externalPublic })).errors;
    expect(ok.some((p) => p.rule === "missing-diagram-illustration")).toBe(false);
  });

  it("validateNativeSvg and stageDropDiagram reject hallucinated ./wiki-illustrations/* upfront with pure-vector hint", () => {
    const f = wikiFixture();
    fixtures.push(f);
    const pubRoot = join(f.root, "public");
    mkdirSync(join(pubRoot, "wiki-illustrations"), { recursive: true });
    writeFileSync(join(pubRoot, "wiki-illustrations/real.webp"), Buffer.from("RIFFWEBP"));

    const yaml = stringify({
      mode: "native-svg",
      id: "hallucinated-plate",
      caption: "幻觉图",
      size: [600, 240],
      pins: [],
    });
    const ghostSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240" width="600" height="240"><image href="./wiki-illustrations/ghost.webp" x="10" y="10" width="200" height="120"/></svg>\n';
    const realSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240" width="600" height="240"><image href="./wiki-illustrations/real.webp" x="10" y="10" width="200" height="120"/></svg>\n';

    const issues = validateNativeSvg(ghostSvg, [600, 240], { publicRoot: pubRoot });
    expect(issues.some((m) => m.includes("public/wiki-illustrations/ghost.webp"))).toBe(true);
    expect(issues.some((m) => m.includes("纯矢量 native-svg"))).toBe(true);
    expect(validateNativeSvg(realSvg, [600, 240], { publicRoot: pubRoot })).toEqual([]);

    expect(() =>
      stageDropDiagram(f.root, "hallucinated-plate", yaml, ghostSvg, { publicRoot: pubRoot }),
    ).toThrow(/纯矢量 native-svg/);
    expect(() =>
      stageDropDiagram(f.root, "real-plate", yaml.replace("hallucinated-plate", "real-plate"), realSvg, {
        publicRoot: pubRoot,
      }),
    ).not.toThrow();
  });

  it("approveReview staging mirrors public/wiki-illustrations so existing PLATE diagrams never fail staging", async () => {
    const f = wikiFixture();
    fixtures.push(f);
    f.write("wiki/HANDBOOK.md", handbookFixture());
    f.write("public/wiki-illustrations/existing-plate.webp", "RIFFWEBP");
    f.write(
      "wiki/diagrams/existing-plate.yaml",
      stringify({
        mode: "native-svg",
        id: "existing-plate",
        caption: "已有剖面",
        size: [600, 240],
        pins: [],
      }),
    );
    f.write(
      "wiki/diagrams/existing-plate.svg",
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240" width="600" height="240"><image href="./wiki-illustrations/existing-plate.webp" x="10" y="10" width="200" height="120"/></svg>\n',
    );
    const raw = saveRawSnapshot(join(f.root, "wiki"), "新材料说明。\n");
    f.write(
      "wiki/sources/seed-note.md",
      `---\nid: seed-note\ntitle: Seed\ntype: source\nsummary: Seed\nsources: ["raw:${raw.slice(4)}#L1"]\nevidence: I\nrawSources: ["${raw}"]\nupdated: '2026-11-19'\n---\n初始说明。\n`,
    );

    const before = wikiContents(f.root);
    const after = new Map(before);
    after.set(
      "wiki/sources/seed-note.md",
      `---\nid: seed-note\ntitle: Seed\ntype: source\nsummary: Seed\nsources: ["raw:${raw.slice(4)}#L1"]\nevidence: I\nrawSources: ["${raw}"]\nupdated: '2026-11-19'\n---\n初始说明。\n补充说明。\n`,
    );
    const review = await createReview(f.root, before, after, {
      promoted: [],
      merged: [],
      rejected: [],
      contradictions: [],
      revisions: [{ id: "seed-note", kind: "supplement", reason: "补充说明" }],
    });
    const published = await approveReview(f.root, review.id);
    expect(published.state).toBe("published");
  });
});

describe("Deliverable 2: SVG pre-normalizer & pure-SVG guardrails", () => {
  it("normalizeNativeSvg fixes trivial open-source SVG quirks while preserving valid SVGs byte-for-byte", () => {
    const valid =
      '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240" width="600" height="240"><!-- keep exact --><rect x="10" y="10" width="120" height="40" rx="6" fill="#ddf4ef" stroke="#087f73" stroke-width="1.5"/><text x="20" y="34" font-size="14" font-family="var(--font-sans)" fill="#17211f">OK</text></svg>\n';
    expect(normalizeNativeSvg(valid)).toBe(valid);

    const quirky =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240" width="600px" height="240px"><rect x="10px" y="10px" width="120px" height="40px" rx="6px" fill="white" stroke="black" stroke-width="1.5px"/><rect x="150" y="10" width="60" height="40" fill="transparent" stroke="#087f73"/><text x="20" y="34" font-size="14px" font-family=\'"Noto Sans SC", sans-serif\' fill="black">Hello</text></svg>\n';
    const normalized = normalizeNativeSvg(quirky);
    expect(normalized).toContain('width="600"');
    expect(normalized).toContain('height="240"');
    expect(normalized).toContain('font-size="14"');
    expect(normalized).toContain('fill="#ffffff"');
    expect(normalized).toContain('stroke="#17211f"');
    expect(normalized).toContain('fill="none"');
    expect(normalized).toContain("font-family=\"'Noto Sans SC', sans-serif\"");
    expect(validateNativeSvg(normalized, [600, 240])).toEqual([]);

    // Forbidden SVG constructs remain strictly rejected even after normalization
    for (const bad of [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240" width="600" height="240"><style>.a{fill:red}</style></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240" width="600" height="240"><defs><linearGradient id="g"/></defs></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240" width="600" height="240"><defs><clipPath id="c"/></defs></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240" width="600" height="240"><defs><filter id="f"/></defs></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240" width="600" height="240"><rect x="0" y="0" width="10" height="10" style="fill:#087f73"/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240" width="600" height="240"><rect x="0" y="0" width="10" height="10" fill="rgba(8,127,115,0.5)"/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240" width="600" height="240"><text x="10" y="20" dx="4">hi</text></svg>',
    ]) {
      expect(validateNativeSvg(normalizeNativeSvg(bad), [600, 240]).length).toBeGreaterThan(0);
    }
  });

  it("keeps warm mineral palette & pure-vector guardrails in stripped standard and Drop prompts (no calc, valid toc.part)", async () => {
    const std = readFileSync(new URL("../../docs/wiki-writing-standard.md", import.meta.url), "utf8");
    const kept = stripNonAuthoringStandard(std, { keepVisualSpec: true });
    for (const token of [
      "#087f73",
      "#c78300",
      "#4c65b6",
      "#9a4b86",
      "#b54237",
      "#66716d",
      "#fbfaf6",
      "#ddf4ef",
      "#fff4cf",
      "#e8edff",
      "#f5e6f0",
      "#fbe5e2",
      ">=13.5px",
      "wiki-illustrations",
    ]) {
      expect(kept).toContain(token);
    }

    const f = wikiFixture();
    fixtures.push(f);
    f.write("wiki/HANDBOOK.md", handbookFixture());
    const batch = await acceptBatch(f.root, {
      key: "prompt-contract-check",
      items: [{ name: "note.md", text: "验证 Drop 协议中的色板、纯矢量与目录分组规则。\n" }],
    });

    let discoverSystem = "";
    let generateSystem = "";
    let diagramContractText = "";
    let sawCalcRuleDoc = false;

    const done = await (
      await startDrop(
        f.root,
        batch.id,
        {},
        {
          validate: () => [],
          runAgent: async (req) => {
            const p = JSON.parse(req.stdin);
            const sys = req.args[req.args.indexOf("--system-prompt") + 1] ?? "";
            if (p.mode === "drop-extract") {
              return {
                id: req.id,
                ok: true,
                exitCode: 0,
                stderrTail: "",
                costUsd: 0,
                output: JSON.stringify({
                  summary: "纯矢量图规则检查",
                  quotes: ["验证 Drop 协议中的色板、纯矢量与目录分组规则。"],
                  conditions: [],
                  topics: [{ name: "svg", query: "svg" }],
                }),
              };
            }
            if (p.mode === "drop-discover") {
              discoverSystem = sys;
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
                      path: "concepts/svg-guard.md",
                      reason: "新概念页",
                      toc: { part: "disaggregation", section: "测试" },
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
              generateSystem = sys;
              sawCalcRuleDoc = Boolean(p.ruleDocuments?.calc);
              const dcId: string = p.diagramContract?.material;
              if (!diagramContractText && dcId) {
                const mat = (p.materials as { id: string; text: string }[]).find((m) => m.id === dcId);
                if (!mat) {
                  return {
                    id: req.id,
                    ok: true,
                    exitCode: 0,
                    stderrTail: "",
                    costUsd: 0,
                    output: JSON.stringify({ request: { materials: [{ id: dcId }] } }),
                  };
                }
                diagramContractText = mat.text;
              }
              return {
                id: req.id,
                ok: true,
                exitCode: 0,
                stderrTail: "",
                costUsd: 0,
                output: JSON.stringify({
                  text: `---\nid: svg-guard\ntitle: SVG 护栏\ntype: concept\nsummary: 测试\nchapters: ['11']\ntoc:\n  part: disaggregation\n  section: 测试\norigin: drop\nevidence: I\nsources:\n  - ${p.notes[0].ref}\nupdated: '2026-11-19'\n---\n## 机制\n\n纯矢量图测试说明。\n\n## 对照源码\n\n见归档材料 [I]。\n`,
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

    expect(done.state, done.error).toBe("review");
    expect(discoverSystem).toContain("disaggregation");
    expect(discoverSystem).toContain("cases");
    expect(discoverSystem).not.toContain("/serving/");
    expect(sawCalcRuleDoc).toBe(false);
    expect(generateSystem).toContain("#087f73");
    expect(generateSystem).toContain("wiki-illustrations");
    expect(diagramContractText).toContain("SVG Forbidden Syntax Checklist");
    for (const forbidden of [
      "<style>",
      "<linearGradient>",
      "<clipPath>",
      "<filter>",
      'style="',
      "rgba(",
      "dx",
      "dy",
    ]) {
      expect(diagramContractText).toContain(forbidden);
    }
  });
});

describe("Deliverable 3: Stage-2 HANDBOOK & section-integration universal prose-marks", () => {
  it("real wiki/HANDBOOK.md reflects Stage-2 Edition-A rules and lint entries", () => {
    const handbook = readFileSync(new URL("../../wiki/HANDBOOK.md", import.meta.url), "utf8");
    for (const needle of [
      "vllm-ascend@c09d3e20",
      "Qwen3-8B",
      "Qwen3-30B-A3B",
      "native-svg",
      "stage2-no-calc",
      "stage2-no-ascii-diagram",
      "missing-diagram-illustration",
      "legacy-anchor",
      "invalid-wiki-tool",
      "0 角标",
    ]) {
      expect(handbook).toContain(needle);
    }
  });

  it("section-integration enforces zero prose marks on concepts/ even without a pre-existing ## 对照源码 and auto-creates it", async () => {
    const f = wikiFixture();
    fixtures.push(f);
    const header =
      "---\nid: no-source-sec\ntitle: 无源码区旧概念\ntype: concept\nsummary: 测试\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: S\nupdated: '2026-11-19'\n---\n";
    const previous = `${header}## 核心原理\n\n旧版概念正文没有对照源码节。\n`;
    const draft = `${header}## 核心原理\n\n新版补充了动态分块条件。\n`;

    let calls = 0;
    const sectionInput = {
      path: "concepts/no-source-sec.md",
      previous,
      draft,
      rules: "零正文角标",
      policy: { accountingOnly: true as const },
    };
    const mockAgent = async (req: { id: string; stdin: string }) => {
      const data = JSON.parse(req.stdin);
      if (data.mode === "supplement-redundancy-check") {
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          output: JSON.stringify({ editId: data.editId, redundant: false, quotes: [], reason: "keep" }),
        };
      }
      calls++;
      if (calls === 1) {
        // First attempt leaks an inline prose mark -> must be rejected by prose-marks!
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          output: JSON.stringify({
            edits: [
              {
                before: "旧版概念正文没有对照源码节。",
                after: "旧版概念正文没有对照源码节。\n新版补充了动态分块条件 [S1]。",
                kind: "supplement",
                reason: "补充",
                quote: "新版补充了动态分块条件。",
              },
            ],
          }),
        };
      }
      return {
        id: req.id,
        ok: true,
        exitCode: 0,
        stderrTail: "",
        output: JSON.stringify({
          edits: [
            {
              before: "旧版概念正文没有对照源码节。",
              after: "旧版概念正文没有对照源码节。\n新版补充了动态分块条件。",
              sourceNote: "动态分块条件见上游文档 [S1]。",
              kind: "supplement",
              reason: "补充",
              quote: "新版补充了动态分块条件。",
            },
          ],
        }),
      };
    };

    await expect(integrateSections(f.root, sectionInput, { runAgent: mockAgent })).rejects.toThrow(
      /prose-marks/,
    );
    const result = await integrateSections(f.root, sectionInput, { runAgent: mockAgent, retry: true });

    expect(calls).toBe(2);
    expect(result!.text).toContain("## 对照源码\n\n动态分块条件见上游文档 [S1]。");
    const aboveSource = result!.text.split("## 对照源码")[0]!;
    expect(aboveSource).not.toContain("[S1]");
  });
});

describe("Deliverable 4: open-source missing tools/repos/* guard", () => {
  it("createBlobReader returns invalid-commit instead of throwing GitError on missing repo paths", () => {
    const readBlob = createBlobReader();
    const res = readBlob(join(tmpdir(), "definitely-uncloned-repo-xyz-999"), "c09d3e20", "vllm_ascend/a.py");
    expect(res).toEqual({ kind: "invalid-commit" });
  });

  it("degrades uncloned configured repos on unchanged pages to warnings while strictly blocking raw & newly-added uncloned refs", () => {
    const f = wikiFixture();
    fixtures.push(f);
    f.write("wiki/HANDBOOK.md", handbookFixture());
    const raw = saveRawSnapshot(join(f.root, "wiki"), "本地归档依据。\n");
    f.write(
      "wiki/concepts/existing-upstream.md",
      [
        "---",
        "id: existing-upstream",
        "title: 既有上游页",
        "type: concept",
        "summary: 引用未克隆仓库的既有页面。",
        "chapters: ['11']",
        "sources:",
        "  - vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1-L10",
        "relations:",
        "  - to: touched-raw",
        "    kind: builds-on",
        "    note: 关联归档材料",
        "evidence: C",
        "updated: '2026-11-19'",
        "---",
        "## 原理",
        "",
        "已有说明。",
        "",
        "## 对照源码",
        "",
        "见上游实现 [C1]。",
        "",
      ].join("\n"),
    );
    f.write(
      "wiki/sources/touched-raw.md",
      `---\nid: touched-raw\ntitle: 新投喂来源\ntype: source\nsummary: 仅引用 raw\nsources: ["raw:${raw.slice(4)}#L1"]\nevidence: I\nrawSources: ["${raw}"]\nupdated: '2026-11-19'\n---\n新投喂正文。\n`,
    );

    const missingRepos = { "vllm-ascend": join(f.root, "tools/repos/vllm-ascend") };

    // When touchedPages only includes touched-raw.md, existing-upstream's uncloned repo degrades to warning!
    const ok = validateIntegrationDetailed(f.root, missingRepos, {
      touchedPages: ["wiki/sources/touched-raw.md"],
      touchedDiagrams: [],
    });
    expect(ok.errors).toEqual([]);
    expect(ok.warnings.some((w) => w.includes("[uncloned-repo]"))).toBe(true);

    // If a touched page introduces a NEW uncloned repo ref not in preservedRefs, it MUST still error!
    f.write(
      "wiki/sources/touched-raw.md",
      `---\nid: touched-raw\ntitle: 新投喂来源\ntype: source\nsummary: 编造未克隆仓引用\nsources: ["vllm-ascend@c09d3e20:vllm_ascend/fake.py#L1"]\nevidence: C\nupdated: '2026-11-19'\n---\n新投喂正文。\n`,
    );
    const blocked = validateIntegrationDetailed(f.root, missingRepos, {
      touchedPages: ["wiki/sources/touched-raw.md"],
      touchedDiagrams: [],
      preservedRefs: new Map([["wiki/sources/touched-raw.md", new Set()]]),
    });
    expect(blocked.errors.length).toBeGreaterThan(0);
  });
});

describe("Deliverable 5: Windows .cmd shim, claude/codex harness options, and status secret safety", () => {
  it("unwraps Windows npm claude.cmd / ccr.cmd shims to process.execPath + JS script with shell: false", () => {
    const dir = mkdtempSync(join(tmpdir(), "wiki-cmd-shim-"));
    tempDirs.push(dir);
    mkdirSync(join(dir, "node_modules/@anthropic-ai/claude-code"), { recursive: true });
    const jsEntry = join(dir, "node_modules/@anthropic-ai/claude-code/cli.js");
    writeFileSync(jsEntry, "console.log('ok');\n");
    const cmdPath = join(dir, "claude.cmd");
    writeFileSync(
      cmdPath,
      '@ECHO off\r\n"%dp0%\\node.exe"  "%dp0%\\node_modules\\@anthropic-ai\\claude-code\\cli.js" %*\r\n',
    );

    const unwrapped = resolveWindowsCmdShim(cmdPath);
    expect(unwrapped).toEqual({
      command: process.execPath,
      argsPrefix: [resolve(jsEntry)],
      shell: false,
    });

    const viaResolve = resolveClaudeCommand({}, undefined, "win32", { claudeCli: cmdPath });
    expect(viaResolve).toEqual(unwrapped);

    const argsWithSettings = restrictedArgs("rules", 1, "openrouter,qwen/qwen3", "user,local");
    expect(argsWithSettings[argsWithSettings.indexOf("--tools") + 1]).toBe("");
    expect(argsWithSettings[argsWithSettings.indexOf("--setting-sources") + 1]).toBe("user,local");
  });

  it("codexAllowUserConfig omits --ignore-user-config & forced ChatGPT flags while retaining read-only sandbox", () => {
    const req = buildChatRequest(
      { message: "hi" },
      { reading: "", citable: "", query: "" },
      {
        wikiRoot: ".",
        provider: "codex",
        model: "deepseek-chat",
        codexAllowUserConfig: true,
        timeoutMs: 1000,
      },
    );
    expect(req.args).not.toContain("--ignore-user-config");
    expect(req.args).not.toContain('forced_login_method="chatgpt"');
    expect(req.args).not.toContain('model_provider="openai"');
    expect(req.args).toContain("read-only");
    expect(req.args).toContain("features.shell_tool=false");
  });

  it("GET /api/wiki/status never exposes raw API keys or claudeEnv secrets, and saveChatModel validates all 5 providers", async () => {
    const f = wikiFixture();
    fixtures.push(f);
    const fakeSecret = "sk-TOP-SECRET-NEVER-LEAK-777777";
    const fakeClaudeSecret = "sk-CLAUDE-ENV-SECRET-888888";
    vi.stubEnv("DEEPSEEK_API_KEY", fakeSecret);

    f.write(
      "wiki/sync.config.local.json",
      JSON.stringify({
        chatProvider: "openai-compatible",
        chatModel: "deepseek-chat",
        apiBaseUrl: "https://api.deepseek.com/v1",
        apiKeyEnv: "DEEPSEEK_API_KEY",
        claudeSettingSources: "user,local",
        claudeEnv: { ANTHROPIC_AUTH_TOKEN: fakeClaudeSecret },
      }),
    );

    const status = readStatus(f.root);
    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain(fakeSecret);
    expect(serialized).not.toContain(fakeClaudeSecret);
    expect(status.models).toMatchObject({
      chatProvider: "openai-compatible",
      chatModel: "deepseek-chat",
      apiBaseUrl: "https://api.deepseek.com/v1",
      apiKeyEnv: "DEEPSEEK_API_KEY",
      hasApiKey: true,
      claudeSettingSources: "user,local",
    });

    // saveChatModel accepts anthropic-compatible & harness and rejects raw apiKey field
    await saveChatModel(f.root, {
      chatProvider: "anthropic-compatible",
      chatModel: "deepseek-chat",
      apiBaseUrl: "https://api.deepseek.com/anthropic",
      apiKeyEnv: "DEEPSEEK_API_KEY",
    });
    expect(readStatus(f.root).models).toMatchObject({
      chatProvider: "anthropic-compatible",
      apiBaseUrl: "https://api.deepseek.com/anthropic",
      apiKeyEnv: "DEEPSEEK_API_KEY",
      hasApiKey: true,
    });
    await expect(
      saveChatModel(f.root, {
        chatProvider: "openai-compatible",
        chatModel: "deepseek-chat",
        apiKey: "sk-must-reject",
      }),
    ).rejects.toThrow();
  });
});

describe("Deliverable 6: bounded safe nightly sync.config.json", () => {
  it("defaults omitted production quotas to null while honoring explicit bounded quotas and real wiki/sync.config.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "wiki-prod-sync-"));
    tempDirs.push(dir);
    writeFileSync(join(dir, "sync.config.json"), JSON.stringify({ mode: "production" }));
    expect(readSyncConfig(join(dir, "sync.config.json"))).toMatchObject({
      mode: "production",
      maxNewParamPages: null,
      maxTasks: null,
      reconcileBatches: null,
      driftSample: null,
    });

    writeFileSync(
      join(dir, "sync.config.json"),
      JSON.stringify({
        mode: "production",
        maxNewParamPages: 5,
        maxTasks: 3,
        reconcileBatches: 2,
        driftSample: 5,
      }),
    );
    expect(readSyncConfig(join(dir, "sync.config.json"))).toMatchObject({
      mode: "production",
      maxNewParamPages: 5,
      maxTasks: 3,
      reconcileBatches: 2,
      driftSample: 5,
    });

    // Real committed wiki/sync.config.json must parse cleanly with safe bounded nightly quotas
    const realConfig = readSyncConfig(join(process.cwd(), "wiki/sync.config.json"));
    expect(realConfig).toMatchObject({
      mode: "production",
      maxNewParamPages: 5,
      maxTasks: 3,
      reconcileBatches: 2,
      driftSample: 5,
    });
  });
});
