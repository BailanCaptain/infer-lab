import { randomUUID } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { wikiFixture } from "../scripts/wiki/test-fixture";
import { beginChat, finishChat, MAX_SESSION_TURNS } from "./chat-session";

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
    await finishChat(f.root, lease, `第 ${turn} 问`, { ok: true, sessionId: randomUUID() });
    lease = await beginChat(f.root, revision, lease.id);
    if (turn < MAX_SESSION_TURNS) expect(lease.agentSessionId).toBeDefined();
  }
  expect(lease.agentSessionId).toBeUndefined();
  expect(lease.resetReason).toBe("turn-limit");
  expect(lease.previousQuestions).toEqual(["第 1 问", "第 2 问", "第 3 问"]);
  // 新会话从零计数：再答一轮仍能续上
  await finishChat(f.root, lease, "第 4 问", { ok: true, sessionId: randomUUID() });
  const next = await beginChat(f.root, revision, lease.id);
  expect(next.agentSessionId).toBeDefined();
  expect(next.resetReason).toBeUndefined();
});
