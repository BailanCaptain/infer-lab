import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { gapKey, listGaps, recordGapObservation, selfContained, splitGapAlias } from "./gap-ledger";
import { listTasks, readTask, runTask } from "./queue";
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
const observation = (question = "chunk_config main 默认开启吗？") => ({
  eventId: randomUUID(),
  question,
  contextQuestions: [],
  revision: "a".repeat(64),
  candidates: [{ id: "a", score: 1, how: "keyword" as const }],
  signals: [{ kind: "agent-uncovered" as const, reason: "模型自述未收录，尚未独立判定" }],
});

it("records three independent observations once and exposes one assessment item after restart", async () => {
  const f = setup();
  const events = [observation(), observation(), observation()];
  await Promise.all(events.map((e) => recordGapObservation(f.root, e)));
  const bytes = readFileSync(join(f.root, "wiki/_gaps.json"), "utf8");
  const third = await recordGapObservation(f.root, events[2]!);
  expect(third).toMatchObject({ count: 3, threshold: 3, state: "awaiting-assessment" });
  expect(readFileSync(join(f.root, "wiki/_gaps.json"), "utf8")).toBe(bytes);
  expect(listGaps(f.root)).toHaveLength(1);
  expect(listGaps(f.root)[0]!.occurrences).toHaveLength(3);
  expect(listGaps(f.root)[0]!.assessment).toBe("unassessed");
});
it("preserves versions, identifiers, negation and conversation context", () => {
  const question = "X main 默认开启吗？";
  expect(gapKey(question, [])).toBe(gapKey(`  ${question}  `, []));
  for (const other of ["X release 默认开启吗？", "x main 默认开启吗？", "X main 默认不开启吗？"])
    expect(gapKey(other, [])).not.toBe(gapKey(question, []));
  expect(gapKey("现在呢？", ["参数 A"])).not.toBe(gapKey("现在呢？", ["参数 B"]));
  expect(gapKey(question, [question, question])).toBe(gapKey(question, []));
});
it("rejects an event id reused for different evidence without overwriting history", async () => {
  const f = setup();
  const e = observation();
  await recordGapObservation(f.root, e);
  await expect(recordGapObservation(f.root, { ...e, revision: "b".repeat(64) })).rejects.toThrow(/事件/);
  expect(listGaps(f.root)[0]!.count).toBe(1);
});
it("stores web attempts as unassessed signals, never as proof of missing knowledge", async () => {
  const f = setup();
  await recordGapObservation(f.root, {
    ...observation(),
    signals: [
      { kind: "web-attempt", reason: "尝试核对官方文档", tool: "WebFetch", target: "https://docs.vllm.ai/" },
    ],
  });
  expect(listGaps(f.root)[0]).toMatchObject({ state: "collecting", assessment: "unassessed" });
  expect(existsSync(join(f.root, "wiki/_drafts"))).toBe(false);
});
it("keeps a configured threshold on disk and refuses to silently change it", async () => {
  const f = setup();
  await recordGapObservation(f.root, observation(), { threshold: 2 });
  expect(await recordGapObservation(f.root, observation())).toMatchObject({
    threshold: 2,
    state: "awaiting-assessment",
  });
  await expect(recordGapObservation(f.root, observation(), { threshold: 3 })).rejects.toThrow(/阈值/);
});
it("read-only inspection creates nothing and a damaged ledger is not reset", async () => {
  const f = setup();
  expect(listGaps(f.root)).toEqual([]);
  expect(existsSync(join(f.root, "wiki/_gaps.json"))).toBe(false);
  f.write("wiki/_gaps.json", "damaged");
  await expect(recordGapObservation(f.root, observation())).rejects.toThrow();
  expect(readFileSync(join(f.root, "wiki/_gaps.json"), "utf8")).toBe("damaged");
});

it("reopens a closed gap only after three new observations while retaining its old acceptance", async () => {
  const f = setup();
  for (let i = 0; i < 3; i++) await recordGapObservation(f.root, observation());
  const old = listTasks(f.root)[0]!;
  await runTask(f.root, old.id, async () => ({ state: "closed", result: { closureObservationCount: 3 } }));
  expect(listGaps(f.root)[0]).toMatchObject({ state: "closed", count: 3, pendingCount: 0 });
  for (let i = 0; i < 2; i++) await recordGapObservation(f.root, observation());
  expect(listGaps(f.root)[0]).toMatchObject({ state: "collecting", count: 5, pendingCount: 2 });
  expect(listTasks(f.root)).toHaveLength(1);
  const event = observation();
  await recordGapObservation(f.root, event);
  await recordGapObservation(f.root, event);
  expect(listGaps(f.root)[0]).toMatchObject({ state: "awaiting-assessment", count: 6, pendingCount: 3 });
  expect(listTasks(f.root)).toHaveLength(2);
  expect(listTasks(f.root).find((t) => t.state === "queued")?.input).toMatchObject({ kind: "gap", cycle: 1 });
});

// 2026-09-23：HCCL 那一问因为先聊过 Block Table、后来又直接问，被记成了两条缺口。
// 自含问题不带会话上下文；拿不准就照旧带上——判错只会退回现状，不会把不同话题的省略追问并成一条。
// 现有会话里没有一条真实追问，下面都是自拟例子。
it("自含问题的缺口不带会话上下文；有指代、省略追问或没有具体对象的照旧带上", () => {
  const hccl =
    "vllm-ascend 里 HCCL 通信缓冲区的大小（HCCL_BUFFSIZE / hccl_buffer_size）是怎么定的？哪些通信组用默认值、哪些自己算，MC2 通信组为什么不能单独配？";
  for (const q of [
    hccl,
    "什么是 KV Cache？",
    "prefill 和 decode 有什么区别？",
    "为什么推理的时候显存占用会越来越高",
  ]) {
    expect(selfContained(q), q).toBe(true);
    expect(gapKey(q, ["Block Table 里的块是什么时候分配、什么时候回收的？"])).toBe(gapKey(q, []));
  }
  for (const q of [
    "那 v0.23 呢？",
    "v0.26 呢？",
    "它的默认值是多少？",
    "这个参数在哪里用到？",
    "上面说的块是什么时候回收的？",
    "刚才那个开关要重启才生效吗？",
    "该参数默认值应该是多少？",
    "为什么？",
    "默认值是多少？",
    "What about this one?",
  ]) {
    expect(selfContained(q), q).toBe(false);
    expect(gapKey(q, ["参数 A"])).not.toBe(gapKey(q, ["参数 B"]));
  }
});

it("判为同一题的不同说法记成那条缺口的别名；之后同样的说法直接归进去，账本自检照样通过", async () => {
  const f = setup();
  for (let i = 0; i < 2; i++)
    await recordGapObservation(f.root, observation("chunk_config 在 main 上默认开启吗？"));
  const target = listGaps(f.root)[0]!;
  const paraphrase = "main 分支里 chunk_config 是不是默认就打开的？";
  const merged = await recordGapObservation(f.root, observation(paraphrase), undefined, {
    entryKey: target.key,
    decision: "d".repeat(64),
  });
  expect(merged).toMatchObject({ key: target.key, count: 3, state: "awaiting-assessment" });
  expect(listGaps(f.root)).toHaveLength(1);
  expect(listGaps(f.root)[0]!.aliases).toEqual([{ key: gapKey(paraphrase, []), decision: "d".repeat(64) }]);
  expect(await recordGapObservation(f.root, observation(paraphrase))).toMatchObject({
    key: target.key,
    count: 4,
  });
  // 判定指向的缺口不存在（比如被拆开了）就照旧新建一条，不丢记录
  const other = await recordGapObservation(
    f.root,
    observation("另一个问题 KV_CACHE_DTYPE 怎么设？"),
    undefined,
    {
      entryKey: "e".repeat(64),
      decision: "d".repeat(64),
    },
  );
  expect(other.count).toBe(1);
  expect(listGaps(f.root)).toHaveLength(2);
});

it("判错了人可以拆开：别名那几次提问拆回自己的缺口，已关闭任务的关闭计数同步减掉", async () => {
  const f = setup();
  const original = "chunk_config 在 main 上默认开启吗？";
  const paraphrase = "main 分支里 chunk_config 是不是默认就打开的？";
  await recordGapObservation(f.root, observation(original));
  const key = listGaps(f.root)[0]!.key;
  const sameAs = { entryKey: key, decision: "d".repeat(64) };
  await recordGapObservation(f.root, observation(paraphrase), undefined, sameAs);
  await recordGapObservation(f.root, observation(original));
  const task = listTasks(f.root)[0]!;
  await runTask(f.root, task.id, async () => ({ state: "closed", result: { closureObservationCount: 3 } }));
  await recordGapObservation(f.root, observation(paraphrase));

  await splitGapAlias(f.root, gapKey(paraphrase, []));
  const gaps = listGaps(f.root);
  expect(gaps.map((g) => [g.question, g.count])).toEqual([
    [original, 2],
    [paraphrase, 2],
  ]);
  expect(gaps[0]!.aliases ?? []).toEqual([]);
  // 关闭时数到的 3 次里有 1 次是被拆走的说法；关闭后才来的那次不在 3 次之内，不多减
  expect(readTask(f.root, task.id).result?.closureObservationCount).toBe(2);
  await expect(splitGapAlias(f.root, "f".repeat(64))).rejects.toThrow(/别名/);
});
