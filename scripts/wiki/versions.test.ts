import { describe, expect, it } from "vitest";
import type { WikiPage } from "./pages";
import { compareRange, crossCheck, withVerified } from "./versions";

const lines = (s: string) => s.split("\n");

describe("compareRange", () => {
  const from = lines("a\nb\ndef f():\n    return 128\nz");

  it("同一位置逐行相同 → same", () => {
    expect(compareRange(from, 3, 4, lines("x\ny\ndef f():\n    return 128\nw"))).toEqual({ verdict: "same" });
  });

  it("内容没变、行号挪了 → moved，并给出新起始行", () => {
    expect(compareRange(from, 3, 4, lines("x\ny\nnew\nnew2\ndef f():\n    return 128"))).toEqual({
      verdict: "moved",
      at: 5,
    });
  });

  it("行尾空白与 CRLF 不算改动", () => {
    expect(compareRange(from, 3, 4, lines("x\ny\ndef f():  \r\n    return 128\r"))).toEqual({
      verdict: "same",
    });
  });

  it("所引的那几行在目标版本里找不到 → changed", () => {
    expect(compareRange(from, 3, 4, lines("x\ny\ndef f():\n    return 64"))).toEqual({ verdict: "changed" });
  });

  it("目标版本没有这个文件 → gone", () => {
    expect(compareRange(from, 3, 4, null)).toEqual({ verdict: "gone" });
  });

  it("所引范围全是空行时不拿去全文搜（到处都能匹配上）", () => {
    expect(compareRange(lines("a\n\n\nb"), 2, 3, lines("q\nr\ns\n\n\nt"))).toEqual({ verdict: "changed" });
  });
});

function page(id: string, sources: string[], verified?: string[]): WikiPage {
  return { file: `concepts/${id}.md`, body: "", fm: { id, sources, verified } } as unknown as WikiPage;
}

describe("crossCheck", () => {
  const files: Record<string, string> = {
    "ascend@aaaaaaa1:f.py": "one\ntwo\nthree",
    "ascend@bbbbbbb2:f.py": "zero\none\ntwo\nthree",
    "ascend@aaaaaaa1:g.py": "keep\nme",
    "ascend@bbbbbbb2:g.py": "keep\nchanged",
  };
  const read = (repo: string, commit: string, path: string) =>
    files[`${repo}@${commit}:${path}`]?.split("\n") ?? null;
  const pairs = [{ repo: "ascend", from: "aaaaaaa1", to: "bbbbbbb2", toRef: "releases/v2" }];

  it("只比钉在 from 提交上的来源；main 的来源、URL 不参与", () => {
    const [r] = crossCheck(
      [page("p", ["ascend@aaaaaaa1:f.py#L1-L2", "ascend@ccccccc3:f.py#L1-L2", "https://example.com/doc"])],
      pairs,
      read,
    );
    expect(r?.items).toEqual([{ source: "ascend@aaaaaaa1:f.py#L1-L2", verdict: "moved", at: 2 }]);
    expect(r?.holds).toBe(true);
  });

  it("有一条 changed 或 gone，这页就不算在目标版本上成立", () => {
    const [r] = crossCheck(
      [page("p", ["ascend@aaaaaaa1:f.py#L1-L2", "ascend@aaaaaaa1:g.py#L1-L2"])],
      pairs,
      read,
    );
    expect(r?.items.map((i) => i.verdict)).toEqual(["moved", "changed"]);
    expect(r?.holds).toBe(false);
  });

  it("一条 from 来源都没有的页不出现在结果里", () => {
    expect(crossCheck([page("p", ["ascend@ccccccc3:f.py#L1"])], pairs, read)).toEqual([]);
  });
});

describe("withVerified", () => {
  const text = '---\nid: p\nsources:\n  - a@b:c#L1\nevidence: "C"\nupdated: "2026-09-21"\n---\n\n正文\n';

  it("没有 verified 时加在 evidence 前面", () => {
    expect(withVerified(text, ["main", "releases/v2"])).toContain(
      'verified: ["main", "releases/v2"]\nevidence: "C"',
    );
  });

  it("已有 verified 时合并去重，保持原有顺序", () => {
    const once = withVerified(text, ["main"]);
    expect(withVerified(once, ["releases/v2", "main"])).toContain('verified: ["main", "releases/v2"]\n');
    expect(withVerified(once, ["main"])).toBe(once);
  });

  it("保留 CRLF", () => {
    const crlf = text.replace(/\n/g, "\r\n");
    expect(withVerified(crlf, ["main"])).toContain('verified: ["main"]\r\nevidence');
  });
});
