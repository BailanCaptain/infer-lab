import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { HandbookSlices } from "./handbook";
import {
  type AgentResult,
  applyIntegration,
  diffSnapshot,
  extractRequest,
  integrateRequest,
  localDate,
  parseSeeds,
  parseStreamJsonLine,
  type RunAgent,
  runExtractPhase,
  runPool,
  snapshotDir,
  strayPaths,
} from "./ingest";

const seedsYaml = `
repos:
  vllm-ascend:
    url: https://github.com/vllm-project/vllm-ascend
    commit: 28bf3a2e
    path: tools/repos/vllm-ascend
features:
  - id: paged-attention
    title: PagedAttention
    type: feature
    chapters: ["11"]
    repo: vllm-ascend
    entry: [vllm_ascend/attention/attention_v1.py]
    ask: 块级 KV 布局与 block table 如何进入 attention 算子
`;
const hb: HandbookSlices = {
  pageFormat: "PF",
  extract: "EX",
  integrate: "IN",
  query: "Q",
  lint: "L",
  human: "H",
};
const ctx = {
  handbook: hb,
  wikiRoot: "C:/w/wiki",
  repoRoots: {
    "vllm-ascend@main": "C:/w/tools/repos/vllm-ascend",
    "vllm-ascend@releases/v0.23.0": "C:/w/tools/repos/vllm-ascend@releases-v0.23.0",
  },
  today: "2026-09-07",
  timeoutMs: 1000,
  batchIds: ["paged-attention", "block-table"],
};

const multiRefYaml = `
repos:
  vllm-ascend:
    url: https://github.com/vllm-project/vllm-ascend
    path: tools/repos/vllm-ascend
    refs:
      main: 28bf3a2e
      "releases/v0.23.0": 9b4b1e2a
features:
  - id: layer-sharding
    title: Layer Sharding
    type: feature
    chapters: ["13"]
    repo: vllm-ascend
    ref: "releases/v0.23.0"
    entry: [vllm_ascend/ops/layer_shard_linear.py]
    ask: 这个参数干嘛的
  - id: paged-attention
    title: PagedAttention
    type: feature
    chapters: ["11"]
    repo: vllm-ascend
    entry: [vllm_ascend/attention/attention_v1.py]
    ask: 块级 KV 布局
`;

describe("parseSeeds", () => {
  it("解析并校验；feature.repo 必须在 repos 里；priority 默认 2", () => {
    const s = parseSeeds(seedsYaml);
    expect(s.features[0]?.priority).toBe(2);
    expect(() => parseSeeds(seedsYaml.replace("repo: vllm-ascend", "repo: nope"))).toThrow(/nope/);
  });

  it("repo 可以钉一组 ref，feature 可以指定适用 ref，未指定则默认 main", () => {
    const s = parseSeeds(multiRefYaml);
    expect(Object.keys(s.repos["vllm-ascend"]!.refs)).toEqual(["main", "releases/v0.23.0"]);
    expect(s.features[0]?.ref).toBe("releases/v0.23.0");
    expect(s.features[1]?.ref).toBe("main");
  });

  it("旧格式的单个 commit 归一化成 refs.main，现有 seeds 不用改", () => {
    const s = parseSeeds(seedsYaml);
    expect(s.repos["vllm-ascend"]!.refs).toEqual({ main: "28bf3a2e" });
    expect(s.features[0]?.ref).toBe("main");
  });

  it("feature 指向未声明的 ref 时报错并指名", () => {
    expect(() => parseSeeds(multiRefYaml.replace('ref: "releases/v0.23.0"', "ref: nope"))).toThrow(
      /ref「nope」不在/,
    );
  });

  it("repo 既没有 refs 也没有 commit 时报错", () => {
    const bad = multiRefYaml
      .replace("    refs:", "    other:")
      .replace("      main: 28bf3a2e", "")
      .replace('      "releases/v0.23.0": 9b4b1e2a', "");
    expect(() => parseSeeds(bad)).toThrow(/refs/);
  });
});

describe("extractRequest · 多 ref", () => {
  it("add-dir 指向该 feature 声明的 ref 的工作树，sources 前缀用该 ref 的 commit", () => {
    const s = parseSeeds(multiRefYaml);
    const req = extractRequest(s.features[0]!, s, ctx);
    expect(req.args[req.args.indexOf("--add-dir") + 1]).toBe("C:/w/tools/repos/vllm-ascend@releases-v0.23.0");
    expect(req.stdin).toContain("vllm-ascend@9b4b1e2a");
    expect(req.stdin).toContain("releases/v0.23.0");
    expect(req.stdin).not.toContain("28bf3a2e");
  });

  it("未声明 ref 的 feature 走 main", () => {
    const s = parseSeeds(multiRefYaml);
    const req = extractRequest(s.features[1]!, s, ctx);
    expect(req.args[req.args.indexOf("--add-dir") + 1]).toBe("C:/w/tools/repos/vllm-ascend");
    expect(req.stdin).toContain("vllm-ascend@28bf3a2e");
  });

  it("缺该 ref 的本地工作树时报错并指名", () => {
    const s = parseSeeds(multiRefYaml);
    const bad = { ...ctx, repoRoots: { "vllm-ascend@main": "C:/w/x" } };
    expect(() => extractRequest(s.features[0]!, s, bad)).toThrow(/releases\/v0\.23\.0/);
  });
});

describe("extractRequest", () => {
  it("argv：stream-json、系统提示=页面格式+提取、add-dir、白名单只含两个 Write 路径、黑名单含 Bash", () => {
    const s = parseSeeds(seedsYaml);
    const req = extractRequest(s.features[0]!, s, ctx);
    expect(req.cwd).toBe("C:/w/wiki");
    expect(req.args.slice(0, 4)).toEqual(["-p", "--output-format", "stream-json", "--verbose"]);
    expect(req.args[req.args.indexOf("--append-system-prompt") + 1]).toBe("PF\n\nEX");
    expect(req.args[req.args.indexOf("--add-dir") + 1]).toBe("C:/w/tools/repos/vllm-ascend");
    const allowed = req.args.slice(
      req.args.indexOf("--allowedTools") + 1,
      req.args.indexOf("--disallowedTools"),
    );
    // Spike W1：Edit(路径) 规则同时管 Write；Write(路径) 不被识别；黑名单不能含 Edit
    expect(allowed).toEqual([
      "Read",
      "Grep",
      "Glob",
      "Edit(_drafts/paged-attention.md)",
      "Edit(raw/paged-attention.md)",
    ]);
    const disallowed = req.args.slice(req.args.indexOf("--disallowedTools") + 1);
    expect(disallowed).toContain("Bash");
    expect(disallowed).not.toContain("Edit");
    expect(req.allowedWrites).toEqual(["_drafts/paged-attention.md", "raw/paged-attention.md"]);
  });
  it("stdin 含 id、commit、入口、ask、今天日期、本批 id、两个允许路径", () => {
    const s = parseSeeds(seedsYaml);
    const { stdin } = extractRequest(s.features[0]!, s, ctx);
    for (const t of [
      "paged-attention",
      "28bf3a2e",
      "vllm_ascend/attention/attention_v1.py",
      "block table",
      "2026-09-07",
      "block-table",
      "_drafts/paged-attention.md",
      "raw/paged-attention.md",
    ]) {
      expect(stdin).toContain(t);
    }
    expect(stdin).not.toContain("PF");
  });
});

describe("integrateRequest", () => {
  it("白名单：concepts/** 写与编辑、决策文件；stdin 列草稿 id", () => {
    const req = integrateRequest(["a", "b"], ctx);
    const allowed = req.args.slice(
      req.args.indexOf("--allowedTools") + 1,
      req.args.indexOf("--disallowedTools"),
    );
    expect(allowed).toEqual(["Read", "Grep", "Glob", "Edit(concepts/**)", "Edit(_drafts/_integration.json)"]);
    expect(req.args[req.args.indexOf("--append-system-prompt") + 1]).toBe("PF\n\nIN");
    expect(req.stdin).toContain("_drafts/a.md");
    expect(req.allowedWrites).toEqual(["concepts/**", "_drafts/_integration.json"]);
  });
});

describe("parseStreamJsonLine", () => {
  it("取 tool_use 名称与目标、result 的 session/cost/is_error；其它返回 null", () => {
    expect(
      parseStreamJsonLine(
        JSON.stringify({
          type: "assistant",
          message: { content: [{ type: "tool_use", name: "Read", input: { file_path: "a.py" } }] },
        }),
      ),
    ).toEqual({ kind: "tool", name: "Read", target: "a.py" });
    expect(
      parseStreamJsonLine(
        JSON.stringify({
          type: "result",
          subtype: "success",
          is_error: false,
          session_id: "s1",
          total_cost_usd: 0.5,
        }),
      ),
    ).toEqual({ kind: "result", isError: false, sessionId: "s1", costUsd: 0.5 });
    expect(parseStreamJsonLine("not json")).toBeNull();
    expect(parseStreamJsonLine(JSON.stringify({ type: "user" }))).toBeNull();
  });
});

describe("snapshot / stray", () => {
  it("差集只含新增或改动的文件；允许 glob 与精确路径", () => {
    const root = mkdtempSync(join(tmpdir(), "snap-"));
    mkdirSync(join(root, "_drafts"));
    writeFileSync(join(root, "index.md"), "old");
    const before = snapshotDir(root);
    writeFileSync(join(root, "_drafts/a.md"), "x");
    writeFileSync(join(root, "index.md"), "changed!");
    const changed = diffSnapshot(before, snapshotDir(root)).sort();
    expect(changed).toEqual(["_drafts/a.md", "index.md"]);
    expect(strayPaths(changed, ["_drafts/a.md", "raw/a.md"])).toEqual(["index.md"]);
    expect(
      strayPaths(
        ["concepts/x.md", "_drafts/_integration.json"],
        ["concepts/**", "_drafts/_integration.json"],
      ),
    ).toEqual([]);
  });
});

describe("runPool", () => {
  it("并发不超过上限，结果按输入顺序", async () => {
    let active = 0;
    let peak = 0;
    const r = await runPool([1, 2, 3, 4, 5], 2, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((res) => setTimeout(res, 5));
      active--;
      return n * 10;
    });
    expect(r).toEqual([10, 20, 30, 40, 50]);
    expect(peak).toBe(2);
  });
});

describe("runExtractPhase", () => {
  const setup = () => {
    const root = mkdtempSync(join(tmpdir(), "wiki-"));
    for (const d of ["_drafts", "raw", "concepts"]) mkdirSync(join(root, d));
    return root;
  };
  const feat = (id: string) => ({
    id,
    title: id,
    type: "feature" as const,
    chapters: ["11"],
    priority: 2,
    repo: "r",
    ref: "main",
    entry: ["a.py"],
    ask: "?",
  });
  const seeds = {
    repos: { r: { url: "https://x", refs: { main: "28bf3a2e" }, path: "tools/repos/r" } },
    features: [feat("a"), feat("b"), feat("c")],
  };
  const mkCtx = (root: string) => ({
    handbook: hb,
    wikiRoot: root,
    repoRoots: { "r@main": "/r" },
    today: "2026-09-07",
    timeoutMs: 100,
    batchIds: ["a", "b", "c"],
  });
  const good = (id: string) =>
    `---\nid: ${id}\ntitle: ${id}\ntype: feature\nsummary: s\nchapters: ["11"]\nsources: [r@28bf3a2e:a.py#L1-L2]\nevidence: "C"\nupdated: "2026-09-07"\n---\n## 是什么\nx\n`;

  it("成功的写草稿；越界写判失败并删除；草稿 frontmatter 不合法判失败；记 _failures.json", async () => {
    const root = setup();
    const calls: string[] = [];
    const runAgent: RunAgent = async (req) => {
      calls.push(req.id);
      if (req.id === "a") writeFileSync(join(root, "_drafts/a.md"), good("a"));
      if (req.id === "b") {
        writeFileSync(join(root, "_drafts/b.md"), good("b"));
        writeFileSync(join(root, "concepts/evil.md"), "越界");
      }
      if (req.id === "c") writeFileSync(join(root, "_drafts/c.md"), "---\nid: c\n---\n");
      const r: AgentResult = {
        id: req.id,
        ok: true,
        exitCode: 0,
        sessionId: `s-${req.id}`,
        costUsd: 0.1,
        stderrTail: "",
      };
      return r;
    };
    const out = await runExtractPhase(seeds.features, seeds, mkCtx(root), {
      runAgent,
      concurrency: 2,
      log: () => {},
    });
    expect(calls.sort()).toEqual(["a", "b", "c"]);
    // 越界是批级判定：本批所有 agent 都被标失败（分不清谁写的）
    expect(out.succeeded).toEqual([]);
    expect(Object.keys(out.failures).sort()).toEqual(["a", "b", "c"]);
    expect(out.failures.a?.reason).toContain("concepts/evil.md");
    expect(existsSync(join(root, "concepts/evil.md"))).toBe(false);
    expect(out.costUsd).toBeCloseTo(0.3);
    const saved = JSON.parse(readFileSync(join(root, "_drafts/_failures.json"), "utf8"));
    expect(saved.b.sessionId).toBe("s-b");
  });
  it("无越界时：合法草稿成功，不合法草稿与 ok=false 的记失败，互不阻塞", async () => {
    const root = setup();
    const runAgent: RunAgent = async (req) => {
      if (req.id === "a") writeFileSync(join(root, "_drafts/a.md"), good("a"));
      if (req.id === "c") writeFileSync(join(root, "_drafts/c.md"), "---\nid: c\n---\n");
      return {
        id: req.id,
        ok: req.id !== "b",
        exitCode: req.id === "b" ? 1 : 0,
        reason: req.id === "b" ? "timeout" : undefined,
        stderrTail: "",
      } as AgentResult;
    };
    const out = await runExtractPhase(seeds.features, seeds, mkCtx(root), {
      runAgent,
      concurrency: 3,
      log: () => {},
    });
    expect(out.succeeded).toEqual(["a"]);
    expect(out.failures.b?.reason).toBe("timeout");
    expect(out.failures.c?.reason).toContain("schema");
  });
});

describe("applyIntegration", () => {
  it("promoted 且 concepts 存在 → 删草稿、写 log；merged 删草稿；rejected 保留；promoted 但 concepts 缺 → problem", () => {
    const root = mkdtempSync(join(tmpdir(), "wiki-"));
    for (const d of ["_drafts", "concepts"]) mkdirSync(join(root, d));
    for (const id of ["a", "b", "c", "d"])
      writeFileSync(join(root, `_drafts/${id}.md`), `---\nid: ${id}\ntitle: T${id}\n---\n`);
    writeFileSync(join(root, "concepts/a.md"), "---\nid: a\ntitle: Ta\n---\n");
    const r = applyIntegration(
      root,
      {
        promoted: ["a", "d"],
        merged: [{ from: "b", into: "a" }],
        rejected: [{ id: "c", reason: "空" }],
        contradictions: [],
      },
      "2026-09-07",
    );
    expect(existsSync(join(root, "_drafts/a.md"))).toBe(false);
    expect(existsSync(join(root, "_drafts/b.md"))).toBe(false);
    expect(existsSync(join(root, "_drafts/c.md"))).toBe(true);
    expect(existsSync(join(root, "_drafts/d.md"))).toBe(true);
    expect(r.problems[0]).toContain("d");
    const log = readFileSync(join(root, "log.md"), "utf8");
    expect(log).toContain("## [2026-09-07] ingest | Ta");
    expect(log).toContain("merged b → a");
  });
});

describe("localDate", () => {
  it("取本地日期而不是 UTC 日期", () => {
    // 东八区 2026-09-07 01:50 对应 UTC 2026-09-06 17:50
    const d = new Date(2026, 8, 7, 1, 50, 0);
    expect(localDate(d)).toBe("2026-09-07");
    expect(localDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
