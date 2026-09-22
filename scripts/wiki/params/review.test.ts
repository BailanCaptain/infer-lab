import { expect, it } from "vitest";
import { wikiFixture } from "../test-fixture";
import { reviewParam } from "./review";
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
