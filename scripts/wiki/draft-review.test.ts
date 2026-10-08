import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { prepareDraftReview } from "./draft-review";
import { CATALOG_MAX } from "./navigation";
import { approveReview, readReview } from "./review";
import { wikiFixture } from "./test-fixture";

const policy = { maxAttempts: 1, maxCostUsd: 1, reserveUsd: 1 };
it.each([false, true])(
  "merges into an existing page with full validation; invented source rejected: %s",
  async (invented) => {
    const f = wikiFixture();
    try {
      f.write("wiki/HANDBOOK.md", readFileSync(new URL("../../wiki/HANDBOOK.md", import.meta.url), "utf8"));
      const original =
        "---\nid: a\ntitle: 缓存\ntype: source\nsummary: 缓存结构\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: S\nupdated: '2026-09-16'\n---\n## 一句话\n缓存结构说明。[S1]\n";
      f.write("wiki/sources/a.md", original);
      f.write(
        "wiki/_drafts/b.md",
        original.replace("id: a", "id: b").replace("缓存结构说明。", "补充缓存说明。"),
      );
      let calls = 0;
      const deps = {
        runAgent: async (req: import("./batch").AgentRequest) => {
          calls++;
          // 整合要把整页正文写回来：写死 60 秒时唯一一次真实整合超时（2026-09-16）
          expect(req.timeoutMs).toBeGreaterThanOrEqual(180_000);
          const data = JSON.parse(req.stdin);
          expect(data.pages.some((p: { id: string }) => p.id === "a")).toBe(true);
          const text = `${original}\n补充缓存说明。[S1]\n`.replace(
            "https://docs.vllm.ai/en/latest/",
            invented ? "https://docs.vllm.ai/en/stable/" : "https://docs.vllm.ai/en/latest/",
          );
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              pages: [{ path: "sources/a.md", text }],
              decision: {
                promoted: [],
                merged: [{ from: "b", into: "a" }],
                rejected: [],
                revisions: [{ id: "a", kind: "supplement", reason: "补入已有主题" }],
              },
            }),
          };
        },
      };
      if (invented) {
        await expect(prepareDraftReview(f.root, "b", policy, deps)).rejects.toThrow("未提供的来源");
        expect(readFileSync(join(f.root, "wiki/sources/a.md"), "utf8")).toBe(original);
        return;
      }
      const review = await prepareDraftReview(f.root, "b", policy, deps);
      expect(readFileSync(join(f.root, "wiki/sources/a.md"), "utf8")).toBe(original);
      expect((await prepareDraftReview(f.root, "b", policy, deps)).reviewId).toBe(review.reviewId);
      expect(calls).toBe(1);
      expect(readReview(f.root, review.reviewId).payload.decision.merged).toEqual([{ from: "b", into: "a" }]);
      await approveReview(f.root, review.reviewId);
      expect(readFileSync(join(f.root, "wiki/sources/a.md"), "utf8")).toContain("补充缓存说明");
      expect(existsSync(join(f.root, "wiki/sources/b.md"))).toBe(false);
      expect(existsSync(join(f.root, "wiki/_drafts/b.md"))).toBe(false);
    } finally {
      f.cleanup();
    }
  },
);

it("整合只带相关页的目录：库再大，目录也不超过上限", async () => {
  // 2026-09-23：原先带全库 id 与摘要，104 页就占 13,838 字符，库到约 300 页单这一项就撑满输入上限
  const f = wikiFixture();
  try {
    f.write("wiki/HANDBOOK.md", readFileSync(new URL("../../wiki/HANDBOOK.md", import.meta.url), "utf8"));
    const pageText = (id: string, title: string, summary: string) =>
      `---\nid: ${id}\ntitle: ${title}\ntype: source\nsummary: ${summary}\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: S\nupdated: '2026-09-16'\n---\n## 一句话\n${summary}。[S1]\n`;
    f.write("wiki/sources/a.md", pageText("a", "缓存", "缓存结构"));
    for (let i = 0; i < 200; i++)
      f.write(
        `wiki/sources/filler-${i}.md`,
        pageText(`filler-${i}`, `无关主题 ${i}`, `无关主题 ${i} 的说明`),
      );
    f.write("wiki/_drafts/b.md", pageText("b", "缓存补充", "缓存结构的补充"));
    let data: { inventory?: unknown; catalog: { id: string }[]; catalogOmitted: number } | undefined;
    await expect(
      prepareDraftReview(f.root, "b", policy, {
        runAgent: async (req) => {
          data = JSON.parse(req.stdin);
          return { id: req.id, ok: false, exitCode: 1, stderrTail: "测试到此为止", costUsd: 0 };
        },
      }),
    ).rejects.toThrow();
    expect(data?.inventory).toBeUndefined();
    expect(data!.catalog.length).toBeLessThanOrEqual(CATALOG_MAX);
    expect(data!.catalog.map((p) => p.id)).toContain("a");
    expect(data!.catalogOmitted).toBe(201 - data!.catalog.length);
  } finally {
    f.cleanup();
  }
});
