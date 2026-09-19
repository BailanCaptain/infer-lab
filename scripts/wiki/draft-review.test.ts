import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { prepareDraftReview } from "./draft-review";
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
