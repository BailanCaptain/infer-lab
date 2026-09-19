import { describe, expect, it } from "vitest";
import type { WikiPage } from "./pages";
import { citedPaths, findStale, refOfCommit, staleIds } from "./stale";

const mk = (id: string, sources: string[]): WikiPage => ({
  file: `concepts/${id}.md`,
  body: "",
  fm: {
    origin: "seed",
    id,
    title: id,
    type: "feature",
    summary: "s",
    aliases: [],
    order: 500,
    chapters: ["11"],
    prerequisites: [],
    sources,
    evidence: "C",
    relations: [],
    related: [],
    contradicts: [],
    updated: "2026-09-12",
  },
});

const refOf = (_repo: string, commit: string) => (commit === "28bf3a2e" ? "main" : undefined);

describe("citedPaths", () => {
  it("按 repo@commit 归组，收集这一组引用到的全部路径", () => {
    const p = mk("a", [
      "vllm-ascend@28bf3a2e:a.py#L1-L2",
      "vllm-ascend@28bf3a2e:b.py#L3",
      "vllm-ascend@2c59ff10:a.py#L1",
      "https://docs.vllm.ai/x.html",
    ]);
    const got = citedPaths(p);
    expect([...got.keys()].sort()).toEqual(["vllm-ascend@28bf3a2e", "vllm-ascend@2c59ff10"]);
    expect([...(got.get("vllm-ascend@28bf3a2e")?.paths ?? [])].sort()).toEqual(["a.py", "b.py"]);
    // URL 不是仓库引用，不参与过期判断
    expect(got.size).toBe(2);
  });
});

describe("findStale", () => {
  const deps = {
    tipOf: () => "84d6dc83",
    changedFiles: (_r: string, _f: string, _t: string, paths: string[]) =>
      paths.filter((p) => p.endsWith(".py")),
  };

  it("只报「这页引用的文件变了」的页，不报仓库有新提交就算数", () => {
    const pages = [
      mk("changed", ["vllm-ascend@28bf3a2e:a.py#L1"]),
      mk("untouched", ["vllm-ascend@28bf3a2e:readme.md#L1"]),
    ];
    const stale = findStale(pages, refOf, deps);
    expect(stale.map((s) => s.id)).toEqual(["changed"]);
    expect(stale[0]?.drift[0]).toMatchObject({ ref: "main", pinned: "28bf3a2e", tip: "84d6dc83" });
  });

  it("钉的就是当前 tip 时不算过期", () => {
    const same = { ...deps, tipOf: () => "28bf3a2e" };
    expect(findStale([mk("a", ["vllm-ascend@28bf3a2e:a.py#L1"])], refOf, same)).toEqual([]);
  });

  it("seeds 里没钉过的 commit 不归这里管", () => {
    const unknown = mk("a", ["other-repo@deadbee:a.py#L1"]);
    expect(findStale([unknown], refOf, deps)).toEqual([]);
  });

  it("按变动文件数降序，最该先重跑的排前面", () => {
    const pages = [
      mk("few", ["vllm-ascend@28bf3a2e:a.py#L1"]),
      mk("many", [
        "vllm-ascend@28bf3a2e:a.py#L1",
        "vllm-ascend@28bf3a2e:b.py#L1",
        "vllm-ascend@28bf3a2e:c.py#L1",
      ]),
    ];
    expect(findStale(pages, refOf, deps).map((s) => s.id)).toEqual(["many", "few"]);
  });

  it("staleIds 直接拼成 --only 能吃的形式", () => {
    const pages = [mk("a", ["vllm-ascend@28bf3a2e:a.py#L1"]), mk("b", ["vllm-ascend@28bf3a2e:b.py#L1"])];
    expect(staleIds(findStale(pages, refOf, deps))).toBe("a,b");
  });
});

describe("refOfCommit", () => {
  const refs = { main: "28bf3a2e", "releases/v0.23.0": "2c59ff10" };
  // 祖先关系：b255ab59 是 main 上比钉点更新的提交；0ld 是两条分支分叉前的老提交
  const isAncestor = (commit: string, ref: string) =>
    (commit === "b255ab59" && ref === "main") || commit === "0ld0ld0l";

  it("seeds 里钉的 commit 直接认", () => {
    expect(refOfCommit(refs, "2c59ff10", isAncestor)).toBe("releases/v0.23.0");
    expect(refOfCommit(refs, "28bf3a2e1234", isAncestor)).toBe("main");
  });

  it("页面重钉到比 seeds 更新的提交，仍然认得出它在哪条分支上——否则这页永远不会被查过期", () => {
    expect(refOfCommit(refs, "b255ab59", isAncestor)).toBe("main");
  });

  it("两条分支都包含的老提交按 seeds 里的先后取第一条；哪条都不在就是 undefined", () => {
    expect(refOfCommit(refs, "0ld0ld0l", isAncestor)).toBe("main");
    expect(refOfCommit(refs, "deadbeef", isAncestor)).toBeUndefined();
  });
});
