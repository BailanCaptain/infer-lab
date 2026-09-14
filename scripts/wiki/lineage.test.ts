import { describe, expect, it } from "vitest";
import { buildLineage, type Commit, type FileStat, type LineageDeps, prOf, renderLineage } from "./lineage";

describe("prOf", () => {
  it("从提交标题末尾取 PR 号", () => {
    expect(prOf("[Refactor] remove layer sharding (#11953)")).toBe(11953);
    expect(prOf("  fix something (#1)  ")).toBe(1);
  });

  it("标题中间的 (#n) 不算——只认末尾那个", () => {
    expect(prOf("revert (#123) because of regression")).toBeUndefined();
    expect(prOf("no pr here")).toBeUndefined();
  });
});

/** 复刻 layer_sharding 的真实形状：v0.23.0 有、之后都没有 */
const REFS = ["releases/v0.23.0", "releases/v0.24.0rc", "main"];
const PATHS = ["vllm_ascend/"];
const commits: Commit[] = [
  { sha: "8960121", date: "2026-07-15", subject: "[Refactor] remove layer sharding (#11953)" },
  {
    sha: "aa0143e",
    date: "2026-05-02",
    subject: "refactor: add a check before layer_sharding logging (#7186)",
  },
  { sha: "ecd4232", date: "2026-02-11", subject: "[Feat] flashcomm2+oshard Generalized (#4723)" },
];
const stats: FileStat[] = [
  { path: "vllm_ascend/ops/layer_shard_linear.py", added: 0, removed: 296 },
  { path: "vllm_ascend/ops/flashcomm2_oshard_manager.py", added: 0, removed: 103 },
  { path: "vllm_ascend/distributed/parallel_state.py", added: 0, removed: 52 },
];
/** main 上它已被删，历史只能追到那次重构；v0.23.0 的历史才留着真正的引入点 */
const olderOnAlive: Commit[] = [
  ...commits,
  {
    sha: "f7db812",
    date: "2026-01-08",
    subject: "[refactor] Refactor the interface for shard weight (#5181)",
  },
];
const deps: LineageDeps = {
  countIn: (ref) => (ref === "releases/v0.23.0" ? 8 : 0),
  historyOf: (ref) => (ref === "main" ? commits : olderOnAlive),
  statOf: () => stats,
};

describe("buildLineage", () => {
  it("逐分支给出存亡，并把最新分支上最近一次改动判为移除点", () => {
    const l = buildLineage("layer_sharding", REFS, PATHS, deps);
    expect(l.presence).toEqual([
      { ref: "releases/v0.23.0", files: 8 },
      { ref: "releases/v0.24.0rc", files: 0 },
      { ref: "main", files: 0 },
    ]);
    expect(l.removed?.pr).toBe(11953);
    expect(l.removed?.date).toBe("2026-07-15");
  });

  it("引入点走最后一个还有它的分支，不走已经删掉它的最新分支", () => {
    // main 上它已被删，那条历史能追到的最早提交未必是它的诞生点；
    // 要走最后一个还留着它的分支（这里是 v0.23.0），历史才完整。
    const l = buildLineage("layer_sharding", REFS, PATHS, deps);
    expect(l.introduced?.pr).toBe(5181);
    expect(l.introduced?.date).toBe("2026-01-08");
  });

  it("影响面按删除行数排序，最伤筋动骨的排前面", () => {
    const l = buildLineage("layer_sharding", REFS, PATHS, deps);
    expect(l.removed?.topFiles[0]?.path).toBe("vllm_ascend/ops/layer_shard_linear.py");
    expect(l.removed?.topFiles[0]?.removed).toBe(296);
  });

  it("最新分支上仍存在时不报移除", () => {
    const alive: LineageDeps = { ...deps, countIn: () => 5 };
    const l = buildLineage("kv_cache_dtype", REFS, PATHS, alive);
    expect(l.removed).toBeUndefined();
    expect(l.presence.every((p) => p.files === 5)).toBe(true);
  });

  it("没有历史时既不报引入也不报移除", () => {
    const none: LineageDeps = { countIn: () => 0, historyOf: () => [], statOf: () => [] };
    const l = buildLineage("nope", REFS, PATHS, none);
    expect(l.removed).toBeUndefined();
    expect(l.introduced).toBeUndefined();
  });
});

describe("renderLineage", () => {
  it("渲染成带 PR 链接的表格，并标明勿手改", () => {
    const md = renderLineage(buildLineage("layer_sharding", REFS, PATHS, deps));
    expect(md).toContain("## 版本谱系");
    // 不能是 HTML 注释——正文不走 rehype-raw，注释会原样显示在页面上
    expect(md).not.toContain("<!--");
    expect(md).toContain("从 git 历史算出");
    expect(md).toContain("| releases/v0.23.0 | 有（8 个文件） |");
    expect(md).toContain("| main | 无 |");
    expect(md).toContain("https://github.com/vllm-project/vllm-ascend/pull/11953");
    expect(md).toContain("`vllm_ascend/ops/layer_shard_linear.py` −296");
  });
});
