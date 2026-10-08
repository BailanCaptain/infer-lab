import { randomUUID } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import type { RunAgent } from "./batch";
import { judgeGapIdentity } from "./gap-identity";
import { listGaps, recordGapObservation } from "./gap-ledger";
import { wikiFixture } from "./test-fixture";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});
const setup = () => {
  const f = wikiFixture();
  fixtures.push(f);
  return f;
};
const observation = (question: string) => ({
  eventId: randomUUID(),
  question,
  contextQuestions: [],
  revision: "a".repeat(64),
  candidates: [{ id: "a", score: 1, how: "keyword" as const }],
  signals: [{ kind: "agent-uncovered" as const, reason: "模型自述未收录，尚未独立判定" }],
});
const agent = (verdict: unknown) => {
  const calls: string[] = [];
  const runAgent: RunAgent = async (req) => {
    calls.push(req.stdin);
    return {
      id: req.id,
      ok: true,
      exitCode: 0,
      stderrTail: "",
      costUsd: 0.01,
      output: JSON.stringify(verdict),
    };
  };
  return { calls, runAgent };
};
const recorded = "chunk_config 在 main 上默认开启吗？";
const paraphrase = "main 分支里 chunk_config 是不是默认就打开的？";

// 用户 09-23 定「说法不同、问的是同一件事也算同一题」。只在缺口信号要新建一条、库里又有别的缺口时才判，不是每次问答都判
it("库里没有缺口、或这个问法已经记过时不调模型", async () => {
  const f = setup();
  const { calls, runAgent } = agent({ same: "g1", reason: "同一件事" });
  expect(
    await judgeGapIdentity(f.root, { question: recorded, contextQuestions: [] }, { runAgent }),
  ).toBeUndefined();
  await recordGapObservation(f.root, observation(recorded));
  expect(
    await judgeGapIdentity(f.root, { question: recorded, contextQuestions: [] }, { runAgent }),
  ).toBeUndefined();
  expect(calls).toHaveLength(0);
});

it("判为同一题就交回那条缺口和判定回执；模型看到的是短编号和问题原文，不是哈希", async () => {
  const f = setup();
  await recordGapObservation(f.root, observation(recorded));
  const { calls, runAgent } = agent({ same: "g1", reason: "同一参数、同一分支，只是换了说法" });
  const verdict = await judgeGapIdentity(
    f.root,
    { question: paraphrase, contextQuestions: [] },
    { runAgent },
  );
  expect(verdict).toEqual({
    entryKey: listGaps(f.root)[0]!.key,
    decision: expect.stringMatching(/^[a-f0-9]{64}$/),
  });
  expect(calls).toHaveLength(1);
  expect(calls[0]).toContain(recorded);
  expect(calls[0]).toContain(paraphrase);
  expect(calls[0]).not.toContain(listGaps(f.root)[0]!.key);
});

it("判为不同题不归并；回了候选以外的编号直接报错，由调用方照旧新建一条", async () => {
  const f = setup();
  await recordGapObservation(f.root, observation(recorded));
  const different = agent({ same: null, reason: "问的是 v0.23，版本不同" });
  expect(
    await judgeGapIdentity(
      f.root,
      { question: "chunk_config 在 v0.23 上默认开启吗？", contextQuestions: [] },
      different,
    ),
  ).toBeUndefined();
  const invented = agent({ same: "g9", reason: "编了一个" });
  await expect(
    judgeGapIdentity(f.root, { question: "chunk_config 默认值是多少？", contextQuestions: [] }, invented),
  ).rejects.toThrow();
});
