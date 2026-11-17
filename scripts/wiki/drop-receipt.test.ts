import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dropReceiptSchema, dropReviewSchema } from "../../src/content/wiki/drop";
import { assertDropProtocol } from "./drop-receipt";
import { wikiFixture } from "./test-fixture";

const sha = (c: string) => c.repeat(64);

const baseV3Receipt = () => ({
  protocol: 3 as const,
  baseline: sha("a"),
  budget: { contextWindowTokens: 128000, outputReserveTokens: 16384, algorithm: 1 as const },
  resources: [],
  requiredReads: [],
  inputs: [],
  queries: [],
  decisions: [],
  plans: [],
  requiredChecks: [],
  checks: [],
});

describe("drop protocol 3 | 4 discriminated union and downgrade guard", () => {
  it("validates both protocol 3 (byte-identical legacy) and protocol 4 (with factDispositions)", () => {
    const v3 = dropReceiptSchema.parse(baseV3Receipt());
    expect(v3.protocol).toBe(3);

    const v4 = dropReceiptSchema.parse({
      ...baseV3Receipt(),
      protocol: 4,
      factDispositions: [
        {
          pageId: "chunked-prefill",
          baseHash: sha("b"),
          candidateHash: sha("c"),
          fact: "`enable_chunked_prefill` 在 v0.26.0rc 默认预算 2048",
          outlet: "retained",
          verification: "semantic-check",
          targetQuote: "在 v0.26.0rc 下默认分块预算为 2048",
          reason: "独立复核确认版本与数值条件等价保留",
          checkId: "fact-disposition:chunked-prefill",
        },
      ],
    });
    expect(v4.protocol).toBe(4);

    // Mismatched outer protocol vs receipt.protocol must be rejected by dropReviewSchema!
    expect(() =>
      dropReviewSchema.parse({
        id: "11111111-1111-4111-8111-111111111111",
        generation: 0,
        report: "report",
        protocol: 3,
        receipt: v4,
      }),
    ).toThrow();
  });

  it("blocks protocol downgrade from v4 to v3 or legacy on both batch and attempt records", () => {
    const fx = wikiFixture();
    try {
      const id = "22222222-2222-4222-8222-222222222222";
      const batchesDir = join(fx.root, "wiki/_jobs/drops/batches");
      const runDir = join(fx.root, `wiki/_jobs/drops/runs/${id}/1`);
      mkdirSync(batchesDir, { recursive: true });
      mkdirSync(runDir, { recursive: true });
      writeFileSync(join(batchesDir, `${id}.json`), JSON.stringify({ id, generation: 1, protocol: 4 }));
      writeFileSync(join(runDir, "attempt.json"), JSON.stringify({ protocol: 4 }));

      expect(() =>
        assertDropProtocol(fx.root, {
          id,
          generation: 1,
          report: "downgraded",
          protocol: 3,
          receipt: baseV3Receipt(),
        }),
      ).toThrow(/降级|协议/);

      expect(() =>
        assertDropProtocol(fx.root, {
          id,
          generation: 1,
          report: "stripped",
        }),
      ).toThrow(/降级|协议/);
    } finally {
      fx.cleanup();
    }
  });
});
