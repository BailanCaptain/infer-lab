import { describe, expect, it } from "vitest";
import type { WikiPage } from "./pages";
import { checkUrls, collectUrls, urlFindings, verdictOf } from "./urls";

const page = (id: string, sources: string[], body = ""): WikiPage =>
  ({ file: `concepts/${id}.md`, body, fm: { id, sources } }) as unknown as WikiPage;

describe("collectUrls", () => {
  it("收 sources 里的 URL 和正文里的站外链接，去掉锚点后按 URL 归并到引用它的页", () => {
    const urls = collectUrls([
      page(
        "a",
        ["https://docs.example.com/x.html#sec", "repo@1234567:a.py#L1"],
        "见 [官方](https://docs.example.com/x.html) 与 [本页](b.md)",
      ),
      page("b", ["https://docs.example.com/x.html"]),
    ]);
    expect([...urls.entries()]).toEqual([
      ["https://docs.example.com/x.html", ["concepts/a.md", "concepts/b.md"]],
    ]);
  });

  it("本机与站内的接口地址不算站外链接", () => {
    expect(
      collectUrls([page("a", ["https://x.org/p"], "[raw](http://localhost:8790/api/wiki/raw?ref=1)")]).size,
    ).toBe(1);
  });
});

describe("verdictOf", () => {
  it("404 / 410 才算死链；其余非 2xx、超时、断网都只是「这次没验证到」", () => {
    expect(verdictOf({ status: 200 })).toBe("ok");
    expect(verdictOf({ status: 404 })).toBe("dead");
    expect(verdictOf({ status: 410 })).toBe("dead");
    expect(verdictOf({ status: 403 })).toBe("unknown");
    expect(verdictOf({ status: 503 })).toBe("unknown");
    expect(verdictOf({ error: "timeout" })).toBe("unknown");
  });
});

describe("checkUrls", () => {
  it.each([
    [200, "ok"],
    [404, "dead"],
    [410, "dead"],
    [503, "unknown"],
  ] as const)("HEAD 404 用 GET 确认：GET %i 判为 %s", async (status, verdict) => {
    const calls: string[] = [];
    const url = "https://models.example.com/repo/files?Revision=fixed";
    const results = await checkUrls(new Map([[url, ["sources/model.md"]]]), async (_url, method) => {
      calls.push(method);
      return { status: method === "HEAD" ? 404 : status };
    });
    expect(calls).toEqual(["HEAD", "GET"]);
    expect(results).toEqual([{ url, files: ["sources/model.md"], verdict, detail: `HTTP ${status}` }]);
  });

  it("HEAD 不被允许时退回 GET；并发受限；结果带上引用页", async () => {
    const calls: string[] = [];
    let live = 0;
    let peak = 0;
    const fetcher = async (url: string, method: "HEAD" | "GET") => {
      calls.push(`${method} ${url}`);
      live++;
      peak = Math.max(peak, live);
      await new Promise((r) => setTimeout(r, 5));
      live--;
      if (url.endsWith("/head-blocked") && method === "HEAD") return { status: 405 };
      if (url.endsWith("/gone")) return { status: 404 };
      return { status: 200 };
    };
    const urls = new Map([
      ["https://x.org/ok", ["concepts/a.md"]],
      ["https://x.org/head-blocked", ["concepts/a.md"]],
      ["https://x.org/gone", ["concepts/b.md"]],
      ["https://x.org/ok2", ["concepts/b.md"]],
    ]);
    const results = await checkUrls(urls, fetcher, { concurrency: 2 });
    expect(peak).toBeLessThanOrEqual(2);
    expect(calls).toContain("GET https://x.org/head-blocked");
    expect(results.filter((r) => r.verdict === "dead")).toEqual([
      { url: "https://x.org/gone", files: ["concepts/b.md"], verdict: "dead", detail: "HTTP 404" },
    ]);
    expect(results.find((r) => r.url.endsWith("/head-blocked"))?.verdict).toBe("ok");
  });
});

describe("urlFindings", () => {
  it("只有死链进巡检清单，每个引用它的页各一条；没验证到的不进", () => {
    expect(
      urlFindings([
        {
          url: "https://x.org/gone",
          files: ["concepts/a.md", "concepts/b.md"],
          verdict: "dead",
          detail: "HTTP 404",
        },
        { url: "https://x.org/slow", files: ["concepts/a.md"], verdict: "unknown", detail: "TimeoutError" },
      ]),
    ).toEqual([
      { file: "concepts/a.md", rule: "dead-url", message: "https://x.org/gone 已失效（HTTP 404）" },
      { file: "concepts/b.md", rule: "dead-url", message: "https://x.org/gone 已失效（HTTP 404）" },
    ]);
  });
});
