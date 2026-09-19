import { randomUUID } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { wikiFixture } from "../scripts/wiki/test-fixture";
import { beginChat, finishChat } from "./chat-session";

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
