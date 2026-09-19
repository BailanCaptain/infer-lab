import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { gapKey, listGaps, recordGapObservation } from "./gap-ledger";
import { listTasks, runTask } from "./queue";
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
  for (let i = 0; i < 2; i++) await recordGapObservation(f.root, observation());
  expect(listTasks(f.root)).toHaveLength(1);
  const event = observation();
  await recordGapObservation(f.root, event);
  await recordGapObservation(f.root, event);
  expect(listTasks(f.root)).toHaveLength(2);
  expect(listTasks(f.root).find((t) => t.state === "queued")?.input).toMatchObject({ kind: "gap", cycle: 1 });
});
