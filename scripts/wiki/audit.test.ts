import { describe, expect, it } from "vitest";
import { type AuditDeps, auditPage, summarize } from "./audit";
import type { WikiPage } from "./pages";

const page = (sources: string[]): WikiPage => ({
  file: "concepts/x.md",
  body: "",
  fm: {
    id: "x",
    title: "X",
    type: "feature",
    summary: "s",
    aliases: [],
    chapters: ["11"],
    sources,
    evidence: "C",
    related: [],
    contradicts: [],
    updated: "2026-09-07",
  },
});

const deps: AuditDeps = {
  repoRoots: { "vllm-ascend": "/repo" },
  countLines: (_root, path) => (path === "a.py" ? 100 : null),
  readRaw: () => "## a.py#L1-L10\n代码",
};

describe("auditPage", () => {
  it("行号在范围内判 ok，并识别 raw 里有对应片段", () => {
    const [a] = auditPage(page(["vllm-ascend@28bf3a2e:a.py#L1-L10"]), deps);
    expect(a).toMatchObject({ verdict: "ok", totalLines: 100, inRaw: true });
  });
  it("行号超出文件长度判 out-of-range", () => {
    expect(auditPage(page(["vllm-ascend@28bf3a2e:a.py#L90-L200"]), deps)[0]?.verdict).toBe("out-of-range");
    expect(auditPage(page(["vllm-ascend@28bf3a2e:a.py#L20-L10"]), deps)[0]?.verdict).toBe("out-of-range");
  });
  it("文件不存在判 missing-file，未知 repo 判 unknown-repo，URL 判 url", () => {
    expect(auditPage(page(["vllm-ascend@28bf3a2e:nope.py#L1"]), deps)[0]?.verdict).toBe("missing-file");
    expect(auditPage(page(["other@28bf3a2e:a.py#L1"]), deps)[0]?.verdict).toBe("unknown-repo");
    expect(auditPage(page(["https://docs.example/x"]), deps)[0]?.verdict).toBe("url");
  });
  it("raw 里没有该源文件时 inRaw 为 false", () => {
    expect(auditPage(page(["vllm-ascend@28bf3a2e:a.py#L1"]), { ...deps, readRaw: () => "" })[0]?.inRaw).toBe(
      false,
    );
  });
  it("无行号的引用按第 1 行算，仍需文件存在", () => {
    expect(auditPage(page(["vllm-ascend@28bf3a2e:a.py"]), deps)[0]?.verdict).toBe("ok");
  });
});

describe("summarize", () => {
  it("按判定分类计数，并单独统计 raw 缺片段", () => {
    const s = summarize(
      auditPage(page(["vllm-ascend@28bf3a2e:a.py#L1", "vllm-ascend@28bf3a2e:nope.py#L1"]), deps),
    );
    expect(s.ok).toBe(1);
    expect(s["missing-file"]).toBe(1);
    expect(s.notInRaw).toBe(1);
  });
});
