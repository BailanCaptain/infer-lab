import { expect, it } from "vitest";
import { wikiFixture } from "../test-fixture";
import { reviewParam, reviewParams } from "./review";
import { scanSources } from "./scan";

it.each(["not-param", "undetermined"] as const)(
  "retains %s with its reason and durable decision",
  async (verdict) => {
    const f = wikiFixture();
    try {
      // 需要一条「疑似」的字符串取值：函数转发的 kwargs 已不算候选（见 scan.test），这里用配置字典
      const source = 'value = extra_config.get("internal_cache", None)';
      const row = scanSources({ "state.py": source })[0]!;
      const result = await reviewParam(
        f.root,
        row,
        source,
        { maxAttempts: 1, maxCostUsd: 1, reserveUsd: 1 },
        async (req) => ({
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            verdict,
            reason: "内部状态或资料不足",
            quote: verdict === "undetermined" ? "" : source,
          }),
        }),
      );
      expect(result.review).toEqual({ verdict, reason: "内部状态或资料不足" });
      expect(result.name).toBe("internal_cache");
    } finally {
      f.cleanup();
    }
  },
);

it("batch review requires exactly one grounded verdict for every suspect identity", async () => {
  const f = wikiFixture();
  try {
    const source = 'first = extra_config.get("alpha", None)\nsecond = extra_config.get("beta", None)';
    const entries = scanSources({ "state.py": source });
    const policy = { maxAttempts: 2, maxCostUsd: 2, reserveUsd: 1 };
    const runner = (items: unknown[]) => async (req: { id: string }) => ({
      id: req.id,
      ok: true,
      exitCode: 0,
      stderrTail: "",
      costUsd: 0,
      output: JSON.stringify({ items }),
    });
    await expect(
      reviewParams(
        f.root,
        entries,
        source,
        policy,
        runner([{ index: 0, verdict: "param", reason: "one", quote: source }]),
      ),
    ).rejects.toThrow();
    const result = await reviewParams(
      f.root,
      entries,
      source,
      policy,
      runner(
        entries.map((_, index) => ({
          index,
          verdict: "undetermined",
          reason: "调用处不足以证明用户入口",
          quote: "",
        })),
      ),
      true,
    );
    expect(result.map((entry) => entry.review?.verdict)).toEqual(["undetermined", "undetermined"]);
  } finally {
    f.cleanup();
  }
});

it("numbered excerpts accept original multiline quotes but reject text not supplied to the model", async () => {
  const f = wikiFixture();
  try {
    const source =
      "# filler\n".repeat(2200) +
      'value = extra_config.get(\n    "alpha", None)\n' +
      "# padding\n".repeat(1000) +
      'hidden = "not supplied"\n';
    const row = scanSources({ "long.py": source }).find((entry) => entry.name === "alpha")!;
    const policy = { maxAttempts: 2, maxCostUsd: 2, reserveUsd: 1 };
    const run = (quote: string) => async (req: { id: string }) => ({
      id: req.id,
      ok: true,
      exitCode: 0,
      stderrTail: "",
      costUsd: 0,
      output: JSON.stringify({ items: [{ index: 0, verdict: "param", reason: "quoted", quote }] }),
    });
    await expect(
      reviewParams(f.root, [row], source, policy, run('hidden = "not supplied"')),
    ).rejects.toThrow();
    const result = await reviewParams(
      f.root,
      [row],
      source,
      policy,
      run('value = extra_config.get(\n    "alpha", None)'),
      true,
    );
    expect(result[0]!.review.verdict).toBe("param");
  } finally {
    f.cleanup();
  }
});
