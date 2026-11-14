import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { prepareDraftReview } from "./draft-review";
import { loadHandbook } from "./handbook";
import { localDate } from "./ingest";
import { CATALOG_MAX } from "./navigation";
import { parsePage } from "./pages";
import { saveRawSnapshot, withRawSources } from "./raw";
import { approveReview, createReview, readReview, rejectReview } from "./review";
import { wikiFixture } from "./test-fixture";

const policy = { maxAttempts: 1, maxCostUsd: 1, reserveUsd: 1 };
it("archives a proven empty integration without keeping an empty pending review", async () => {
  const f = wikiFixture();
  try {
    f.write("wiki/HANDBOOK.md", readFileSync(new URL("../../wiki/HANDBOOK.md", import.meta.url), "utf8"));
    const original =
      "---\nid: a\ntitle: A\ntype: source\nsummary: A\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: S\nupdated: '2026-09-16'\n---\nAlready covered.[S1]\n";
    f.write("wiki/sources/a.md", original);
    f.write("wiki/_drafts/a.md", original);
    const result = await prepareDraftReview(
      f.root,
      "a",
      { accountingOnly: true },
      {
        runAgent: async (req) => ({
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          output: '{"edits":[]}',
        }),
      },
    );
    expect(result.state).toBe("rejected");
    expect(readReview(f.root, result.reviewId).payload.writes).toEqual([]);
    expect(readFileSync(join(f.root, "wiki/sources/a.md"), "utf8")).toBe(original);
    expect(readFileSync(join(f.root, "wiki/_drafts/a.md"), "utf8")).toBe(original);
  } finally {
    f.cleanup();
  }
});
it("reuses the pending correction instead of a rejected proposal for the same draft", async () => {
  const f = wikiFixture();
  try {
    const path = "wiki/_drafts/a.md";
    const draft = "archived draft text";
    f.write(path, draft);
    const before = new Map([[path, draft]]);
    const reviews = await Promise.all(
      ["first", "second"].map((reason) =>
        createReview(f.root, before, new Map(), {
          promoted: [],
          merged: [],
          rejected: [{ id: "a", reason }],
          contradictions: [],
        }),
      ),
    );
    reviews.sort((a, b) => a.id.localeCompare(b.id));
    await rejectReview(f.root, reviews[0]!.id, "invalid proposal; corrected by the other pending revision");
    const result = await prepareDraftReview(f.root, "a", policy, {
      runAgent: async () => {
        throw new Error("Must reuse the existing pending correction without a model call");
      },
    });
    expect(result).toEqual({ reviewId: reviews[1]!.id, state: "pending" });
  } finally {
    f.cleanup();
  }
});
it("retries a supplement that deleted old text instead of reusing the invalid cached decision", async () => {
  const f = wikiFixture();
  try {
    f.write("wiki/HANDBOOK.md", readFileSync(new URL("../../wiki/HANDBOOK.md", import.meta.url), "utf8"));
    const original =
      "---\nid: a\ntitle: 缓存\ntype: source\nsummary: 缓存\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: S\nupdated: '2026-09-16'\n---\n## 一句话\n旧文不能删掉。[S1]\n";
    f.write("wiki/sources/a.md", original);
    f.write("wiki/_drafts/b.md", original.replace("id: a", "id: b").replace("旧文不能删掉。", "新证据。"));
    let calls = 0;
    const runAgent: import("./batch").RunAgent = async (req) => ({
      id: req.id,
      ok: true,
      exitCode: 0,
      stderrTail: "",
      output: JSON.stringify({
        pages: [
          {
            path: "sources/a.md",
            text:
              ++calls === 1 ? original.replace("旧文不能删掉。", "新证据。") : `${original}\n新证据。[S1]\n`,
          },
        ],
        decision: {
          promoted: [],
          merged: [{ from: "b", into: "a" }],
          rejected: [],
          contradictions: [],
          revisions: [{ id: "a", kind: "supplement", reason: "补充新证据" }],
        },
      }),
    });
    const paid = { accountingOnly: true as const };
    await expect(prepareDraftReview(f.root, "b", paid, { runAgent })).rejects.toThrow(/不能删改/);
    const result = await prepareDraftReview(f.root, "b", paid, { runAgent, retry: true });
    expect(readReview(f.root, result.reviewId).state).toBe("pending");
    expect(calls).toBe(2);
    expect(readFileSync(join(f.root, "wiki/sources/a.md"), "utf8")).toBe(original);
  } finally {
    f.cleanup();
  }
});
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

it.each([1, 10000])(
  "integrates an existing page (%i repetitions) through exact edits without deleting old paragraphs",
  async (repetitions) => {
    const f = wikiFixture();
    try {
      f.write("wiki/HANDBOOK.md", readFileSync(new URL("../../wiki/HANDBOOK.md", import.meta.url), "utf8"));
      const header =
        "---\nid: a\ntitle: 缓存\ntype: source\norigin: direct\nsummary: 缓存结构\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: S\nupdated: '2026-09-16'\n---\n";
      const original = `${header}## 一句话\n唯一旧句。[S1]\n${"保留完整教学段落。\n".repeat(repetitions)}`;
      f.write("wiki/sources/a.md", original);
      const raw = saveRawSnapshot(join(f.root, "wiki"), "新的证据限定条件。");
      f.write(
        "wiki/_drafts/a.md",
        withRawSources(`${header}## 一句话\n新的证据限定条件。[S1]\n`, [raw], "gap"),
      );
      const seen: string[] = [];
      const review = await prepareDraftReview(
        f.root,
        "a",
        { accountingOnly: true },
        {
          runAgent: async (req) => {
            const data = JSON.parse(req.stdin);
            if (data.mode === "supplement-redundancy-check") {
              expect(data.sourceContext.previousSources).toEqual(["https://docs.vllm.ai/en/latest/"]);
              expect(data.sourceContext.sources).toEqual(["https://docs.vllm.ai/en/latest/"]);
              expect(data.sourceContext.previousRawSources).toEqual([]);
              expect(data.sourceContext.draftRawSources).toEqual([raw]);
              return {
                id: req.id,
                ok: true,
                exitCode: 0,
                stderrTail: "",
                output: JSON.stringify({
                  editId: data.editId,
                  redundant: false,
                  quotes: [],
                  reason: "The new condition is absent from the unchanged text.",
                }),
              };
            }
            seen.push(data.section.text);
            // Section editing must receive the same evidence definitions and writing rules as whole-page editing.
            expect(req.args.join("\n")).toContain(
              loadHandbook(join(f.root, "wiki"), original, true).pageFormat.trim(),
            );
            expect(Buffer.byteLength(req.stdin, "utf8")).toBeLessThan(100_000);
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              output: JSON.stringify({
                edits: data.section.text.includes("唯一旧句。")
                  ? [
                      {
                        before: "唯一旧句。[S1]",
                        after: "唯一旧句。[S1]\n新的证据限定条件。[S1]",
                        kind: "supplement",
                        reason: "补充适用条件",
                        quote: "新的证据限定条件。",
                      },
                    ]
                  : [],
              }),
            };
          },
        },
      );
      expect(seen.join("")).toContain("保留完整教学段落。\n".repeat(repetitions));
      expect(readFileSync(join(f.root, "wiki/sources/a.md"), "utf8")).toBe(original);
      await approveReview(f.root, review.reviewId);
      const published = readFileSync(join(f.root, "wiki/sources/a.md"), "utf8");
      expect(published).toContain("唯一旧句。[S1]\n新的证据限定条件。[S1]");
      expect(published).toContain("保留完整教学段落。\n".repeat(repetitions));
      expect(published).toContain("origin: gap");
      expect(published).toContain(raw);
      expect(parsePage("sources/a.md", published).page!.fm.updated).toBe(localDate());
    } finally {
      f.cleanup();
    }
  },
);

it("reviews a long new draft through bounded evidence while retaining its complete body", async () => {
  const f = wikiFixture();
  try {
    f.write("wiki/HANDBOOK.md", readFileSync(new URL("../../wiki/HANDBOOK.md", import.meta.url), "utf8"));
    const draft =
      "---\nid: long-new\ntitle: 新主题\ntype: source\nsummary: 新主题说明\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: S\nupdated: '2026-09-16'\n---\n## 一句话\n新的证据。[S1]\n" +
      "保留完整新主题说明。[S1]\n".repeat(5000);
    f.write("wiki/_drafts/long-new.md", draft);
    const review = await prepareDraftReview(
      f.root,
      "long-new",
      { accountingOnly: true },
      {
        runAgent: async (req) => {
          expect(Buffer.byteLength(req.stdin)).toBeLessThan(100_000);
          const data = JSON.parse(req.stdin);
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            output: JSON.stringify(
              data.mode === "long-draft-assessment"
                ? { action: "promote", reason: "新的独立主题" }
                : { evidence: [{ quote: "保留完整新主题说明。[S1]", note: "主题说明" }], caveats: [] },
            ),
          };
        },
      },
    );
    expect(existsSync(join(f.root, "wiki/sources/long-new.md"))).toBe(false);
    await approveReview(f.root, review.reviewId);
    expect(readFileSync(join(f.root, "wiki/sources/long-new.md"), "utf8")).toContain(
      "保留完整新主题说明。[S1]\n".repeat(5000),
    );
    expect(
      parsePage("sources/long-new.md", readFileSync(join(f.root, "wiki/sources/long-new.md"), "utf8")).page!
        .fm.updated,
    ).toBe(localDate());
  } finally {
    f.cleanup();
  }
});
