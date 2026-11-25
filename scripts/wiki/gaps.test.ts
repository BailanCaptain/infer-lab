import { describe, expect, it } from "vitest";
import { danglingRelations, findGaps, toId } from "./gaps";
import type { WikiPage } from "./pages";

const mk = (id: string, body: string, over: Partial<WikiPage["fm"]> = {}): WikiPage => ({
  file: `concepts/${id}.md`,
  body,
  fm: {
    origin: "seed",
    id,
    title: id,
    type: "concept",
    summary: "s",
    aliases: [],
    order: 500,
    chapters: ["11"],
    prerequisites: [],
    sources: ["https://x"],
    evidence: "C",
    relations: [],
    related: [],
    contradicts: [],
    verified: [],
    updated: "2026-09-11",
    ...over,
  },
});

/** 让某个词在一页里出现 n 次 */
const rep = (term: string, n: number) => `${term} `.repeat(n);

describe("toId", () => {
  it("驼峰、下划线、点都归一成 kebab", () => {
    expect(toId("BlockTable")).toBe("block-table");
    expect(toId("kv_cache_spec")).toBe("kv-cache-spec");
    expect(toId("torch_npu.npu_scatter")).toBe("torch-npu-npu-scatter");
    expect(toId("MLA")).toBe("mla");
  });
});

describe("findGaps", () => {
  const opts = { minHits: 4, minPages: 2 };

  it("跨多页反复出现又没有页的概念会被报出来", () => {
    const pages = [
      mk("a", `讲 A，用到 \`MLA\` ${rep("`MLA`", 3)}`),
      mk("b", `讲 B，也用到 ${rep("`MLA`", 3)}`),
    ];
    const gaps = findGaps(pages, opts);
    expect(gaps.map((g) => g.term)).toContain("MLA");
    expect(gaps.find((g) => g.term === "MLA")?.pages).toEqual(["a", "b"]);
  });

  it("只在一页里刷屏的词不算漏洞——那是那页的局部话题", () => {
    const pages = [mk("a", rep("`LocalThing`", 20)), mk("b", "无关")];
    expect(findGaps(pages, opts).map((g) => g.term)).not.toContain("LocalThing");
  });

  it("已经有页的概念不算漏洞（id、title、alias 都算覆盖）", () => {
    const pages = [
      mk("a", `${rep("`BlockTable`", 4)} ${rep("`KVPool`", 4)}`),
      mk("b", `${rep("`BlockTable`", 4)} ${rep("`KVPool`", 4)}`),
      mk("block-table", "我是块表"),
      mk("pool", "我是池", { aliases: ["KV Pool"], title: "KV Pool" }),
    ];
    const terms = findGaps(pages, opts).map((g) => g.term);
    expect(terms).not.toContain("BlockTable");
    expect(terms).not.toContain("KVPool");
  });

  it("语言关键字与通用缩写不当概念", () => {
    const pages = [
      mk("a", `${rep("`int`", 9)} ${rep("CPU", 9)}`),
      mk("b", `${rep("`int`", 9)} ${rep("CPU", 9)}`),
    ];
    expect(findGaps(pages, opts)).toEqual([]);
  });

  it("字面量、异常类名、泛称和 mermaid 方向词不当概念（2026-09 实际出现过的噪声）", () => {
    const noise = "`false` `enabled` `ValueError` `RuntimeError` AI LLM TD LR ";
    const pages = ["a", "b", "c"].map((id) => mk(id, rep(noise, 6) + rep("MLA", 6)));
    expect(findGaps(pages).map((g) => g.term)).toEqual(["MLA"]);
  });

  it("commit 短号不是概念：全库重钉之后 `b255ab59` 会在几十页里出现", () => {
    const pages = ["a", "b", "c"].map((id) => mk(id, rep("`b255ab59` `2c59ff10` ", 6) + rep("MLA", 6)));
    expect(findGaps(pages).map((g) => g.term)).toEqual(["MLA"]);
  });

  it("ignore 里的词被跳过", () => {
    const pages = [mk("a", rep("`Triton`", 5)), mk("b", rep("`Triton`", 5))];
    expect(findGaps(pages, { ...opts, ignore: ["Triton"] })).toEqual([]);
  });

  it("按出现次数降序，输出稳定", () => {
    const many = `${rep("`Alpha`", 6)} ${rep("`Beta`", 3)}`;
    const gaps = findGaps([mk("a", many), mk("b", many)], opts);
    expect(gaps.map((g) => g.term)).toEqual(["Alpha", "Beta"]);
  });

  it("版本串、分支名、源码文件名、双下划线/私有方法与类方法片段不当概念", () => {
    const codeNoise = [
      "`v0.30.0` `v0.26.0rc` `v0.23.0` `v0.26` `v0.23` `main`",
      "`model_runner_v1.py` `ascend_config.py` `worker.py` `kernel.cc` `ops.h` `sampler.rs` `README.md` `config.json`",
      "`__init__` `_dummy_run` `Scheduler.schedule` `NPUWorker.__init__` `PassConfig.enable_sp`",
    ].join(" ");
    const pages = ["a", "b", "c"].map((id) => mk(id, `${rep(codeNoise, 5)} ${rep("EAGLE", 4)}`));
    expect(findGaps(pages).map((g) => g.term)).toEqual(["EAGLE"]);
  });

  it("通用 HTTP/OS/日志/状态枚举与泛化英文词不当概念", () => {
    const genericNoise = [
      "HTTP HTTPS CLI SDK INFO DEBUG WARN FULL NONE FLOAT `STANDARD` MAX SUM POST GET",
      "OS PID IP TCP UTF FAQ README PDF SSD DRAM CUDA NVIDIA ARM HF EOS BPE TTL LRU FCFS LPT IPC GPT LM",
      "`RETRYABLE` `REJECTED` `REGISTERED` `RELEASED` `PREEMPTED` `COMPATIBILITY`",
      "`sources` `auto` `unknown` `apply` `break` `down` `free` `all` `full` `length` `model` `weights` `linear` `align`",
      "`vllm_omni` `Qwen3` `o_proj` `oproj` `process_weights_after_loading`",
    ].join(" ");
    const pages = ["a", "b", "c"].map((id) => mk(id, `${rep(genericNoise, 5)} ${rep("HCCS", 4)}`));
    expect(findGaps(pages).map((g) => g.term)).toEqual(["HCCS"]);
  });

  it("剥离折叠的「## 对照源码」（及自动生成参数区）与 wiki-diagram / wiki-scene / wiki-tool 围栏后再扫教学正文", () => {
    const bodyWithVerificationAndFences = [
      "## 核心机制",
      `教学正文反复引用 \`RealConcept\`、\`RealConcept\` 与 ${rep("`HCCS / RoCE`", 3)}。`,
      "",
      "```wiki-diagram",
      "file: `DiagOnlySymbol`",
      "caption: DIAGID DIAGID DIAGID DIAGID",
      "```",
      "",
      "```wiki-scene",
      "scene: `SceneOnlySymbol`",
      "anchor: SCENEA SCENEA SCENEA SCENEA",
      "```",
      "",
      "```wiki-tool",
      "tool: `ToolOnlySymbol`",
      "preset: TOOLID TOOLID TOOLID TOOLID",
      "```",
      "",
      "## 对照源码",
      rep("`SourcePinOnlySymbol`", 6),
      rep("PINID", 6),
      "```python",
      rep("OTHER", 4),
      "```",
      "",
      "## 版本谱系",
      rep("`LineageOnlySymbol`", 6),
      "",
      "## 参数定义（自动生成）",
      rep("`ParamAutoOnlySymbol`", 6),
    ].join("\n");
    const pages = ["a", "b", "c"].map((id) =>
      mk(id, `    \`\`\`wiki-diagram\n${rep("`CANN.Profiler`", 5)}\n${bodyWithVerificationAndFences}`),
    );
    expect(findGaps(pages, { minHits: 5, minPages: 3 }).map((g) => g.term)).toEqual(["HCCS", "RealConcept"]);
  });
});

describe("danglingRelations", () => {
  it("指向不存在页的边是最确定的漏洞——有人已经说要连过去了", () => {
    const pages = [
      mk("a", "x", { relations: [{ to: "mla", kind: "builds-on", note: "MLA 的 KV 布局不同" }] }),
      mk("b", "x", { relations: [{ to: "a", kind: "builds-on", note: "n" }] }),
    ];
    expect(danglingRelations(pages)).toEqual([{ from: "a", to: "mla", note: "MLA 的 KV 布局不同" }]);
  });

  it("全都指向存在的页时为空", () => {
    const pages = [mk("a", "x", { relations: [{ to: "b", kind: "builds-on", note: "n" }] }), mk("b", "x")];
    expect(danglingRelations(pages)).toEqual([]);
  });
});
