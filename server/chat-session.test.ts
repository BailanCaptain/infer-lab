import { randomUUID } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { wikiFixture } from "../scripts/wiki/test-fixture";
import { beginChat, CHAT_HISTORY_BYTES, finishChat, MAX_SESSION_TURNS } from "./chat-session";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});
it("resumes only its own successful same-revision session and fences concurrent turns", async () => {
  const f = wikiFixture();
  fixtures.push(f);
  const revision = "a".repeat(64);
  const lease = await beginChat(f.root, revision, randomUUID());
  expect(lease.agentSessionId).toBeUndefined();
  expect(lease.resetReason).toBe("session-unavailable");
  await expect(beginChat(f.root, revision, lease.id)).rejects.toThrow(/正在回答/);
  const native = randomUUID();
  await finishChat(f.root, lease, "A 的默认值？", { ok: true, sessionId: native });
  const next = await beginChat(f.root, revision, lease.id);
  expect(next.agentSessionId).toBe(native);
  await expect(finishChat(f.root, lease, "过期", { ok: true })).rejects.toThrow(/过期/);
  await finishChat(f.root, next, "失败的问题", { ok: false });
  const changed = await beginChat(f.root, "b".repeat(64), lease.id);
  expect(changed.agentSessionId).toBeUndefined();
  expect(changed.resetReason).toBe("knowledge-updated");
  expect(changed.previousQuestions).toEqual(["A 的默认值？"]);
  await finishChat(f.root, changed, "现在呢？", { ok: true, sessionId: randomUUID() });
  expect((await beginChat(f.root, "b".repeat(64), lease.id)).resetReason).toBeUndefined();
});

it("starts a fresh agent session after MAX_SESSION_TURNS answered turns", async () => {
  // 2026-09-23 实测：同一会话续问四轮，费用 $0.66 → $1.15 → $1.60 → $2.01，第四轮超过 $2 单次预留，
  // 共享预算熔断。历史越长每轮越贵，所以答满三轮就换新会话，旧问题只留作指代上下文。
  const f = wikiFixture();
  fixtures.push(f);
  const revision = "a".repeat(64);
  let lease = await beginChat(f.root, revision);
  for (let turn = 1; turn <= MAX_SESSION_TURNS; turn++) {
    await finishChat(f.root, lease, `第 ${turn} 问`, {
      ok: true,
      sessionId: randomUUID(),
      answer: `第 ${turn} 答`,
    });
    lease = await beginChat(f.root, revision, lease.id);
    if (turn < MAX_SESSION_TURNS) expect(lease.agentSessionId).toBeDefined();
  }
  expect(lease.agentSessionId).toBeUndefined();
  expect(lease.resetReason).toBe("turn-limit");
  expect(lease.previousQuestions).toEqual(["第 1 问", "第 2 问", "第 3 问"]);
  expect(lease.contextTurns).toEqual(
    [1, 2, 3].map((i) => ({ question: `第 ${i} 问`, answer: `第 ${i} 答` })),
  );
  // 新会话从零计数：再答一轮仍能续上
  await finishChat(f.root, lease, "第 4 问", { ok: true, sessionId: randomUUID() });
  const next = await beginChat(f.root, revision, lease.id);
  expect(next.agentSessionId).toBeDefined();
  expect(next.resetReason).toBeUndefined();
});

it("retains complete successful turns for stateless follow-ups, but never failed turns or old-version answers", async () => {
  const f = wikiFixture();
  fixtures.push(f);
  const revision = "a".repeat(64);
  let lease = await beginChat(f.root, revision, undefined, "codex:test");
  expect(lease.contextTurns).toEqual([]);
  for (let i = 1; i <= 4; i++) {
    await finishChat(f.root, lease, `问题${i}`, { ok: true, answer: `答复${i}` });
    lease = await beginChat(f.root, revision, lease.id, "codex:test");
  }
  expect(lease.contextTurns).toEqual([2, 3, 4].map((i) => ({ question: `问题${i}`, answer: `答复${i}` })));
  expect(lease.historyOmitted).toBe(true);
  await finishChat(f.root, lease, "失败问题", { ok: false, answer: "未完成答复" });
  const changed = await beginChat(f.root, "b".repeat(64), lease.id, "codex:test");
  expect(changed.contextTurns).toEqual([]);
  expect(changed.contextQuestions).toHaveLength(4);
  await finishChat(f.root, changed, "新版问题", { ok: true, answer: "新版答复" });
  const switched = await beginChat(f.root, "b".repeat(64), lease.id, "claude:test");
  expect(switched.contextTurns).toEqual([]);
  expect(switched.resetReason).toBe("model-changed");
});

it("bounds history by UTF-8 bytes without retaining half a turn or skipping an oversized newest turn", async () => {
  const f = wikiFixture();
  fixtures.push(f);
  const revision = "a".repeat(64);
  let lease = await beginChat(f.root, revision);
  await finishChat(f.root, lease, "短问题", { ok: true, answer: "短答复" });
  lease = await beginChat(f.root, revision, lease.id);
  await finishChat(f.root, lease, "长问题", { ok: true, answer: "汉".repeat(CHAT_HISTORY_BYTES / 2) });
  lease = await beginChat(f.root, revision, lease.id);
  expect(lease.contextTurns).toEqual([]);
  expect(lease.historyOmitted).toBe(true);
  await finishChat(f.root, lease, "后续", { ok: true, answer: "短答复" });
  lease = await beginChat(f.root, revision, lease.id);
  expect(lease.contextTurns).toEqual([{ question: "后续", answer: "短答复" }]);
  expect(Buffer.byteLength(JSON.stringify(lease.contextTurns))).toBeLessThanOrEqual(CHAT_HISTORY_BYTES);
});

it("recovers a stuck same-PID active lease once its bounded TTL has expired", async () => {
  const f = wikiFixture();
  fixtures.push(f);
  const revision = "a".repeat(64);
  const start = 1_700_000_000_000;
  const first = await beginChat(f.root, revision, undefined, "claude", start);

  await expect(beginChat(f.root, revision, first.id, "claude", start + 60_000)).rejects.toThrow(/正在回答/);

  const recovered = await beginChat(f.root, revision, first.id, "claude", start + 11 * 60_000);
  expect(recovered.id).toBe(first.id);
  expect(recovered.token).not.toBe(first.token);
});
