import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { enqueueTask, readTask, runTask } from "./queue";
import { isEmptyReview, type Review, readReview, retireReview } from "./review";
import { wikiFixture } from "./test-fixture";
import { workerDue, workOne } from "./worker";
import { digest } from "./workflow";

it("does not retire log-only or contradiction-only reviews as empty", () => {
  const review = { payload: { writes: [], decision: { contradictions: [] } } } as unknown as Review;
  expect(isEmptyReview(review)).toBe(true);
  expect(isEmptyReview({ ...review, payload: { ...review.payload, log: "important result" } })).toBe(false);
  expect(
    isEmptyReview({
      ...review,
      payload: {
        ...review.payload,
        decision: {
          ...review.payload.decision,
          contradictions: [{ a: "a", b: "b", note: "different behavior" }],
        },
      },
    }),
  ).toBe(false);
});

it("closes a legacy empty rejected rewrite without another model call", async () => {
  const f = wikiFixture();
  try {
    const payload = {
      base: {},
      writes: [],
      decision: { promoted: [], merged: [], rejected: [], contradictions: [] },
      repoRoots: {},
    };
    const id = digest(JSON.stringify(payload));
    f.write(`wiki/_jobs/reviews/${id}.json`, JSON.stringify({ id, state: "rejected", payload }));
    const task = await enqueueTask(f.root, {
      kind: "rewrite",
      pageId: "a",
      revision: "a".repeat(64),
      source: "raw:unchanged",
      reason: "content-drift",
    });
    await runTask(f.root, task.id, async () => ({ state: "needs-review", result: { reviewId: id } }));
    const closed = await workOne(
      f.root,
      task.id,
      { accountingOnly: true },
      { retry: true },
      {
        runAgent: async () => {
          throw new Error("must not invoke the model");
        },
      },
    );
    expect(closed.state).toBe("closed");
    expect(closed.result).toMatchObject({ reviewId: id, closureBasis: "no-publishable-change" });
  } finally {
    f.cleanup();
  }
});

it("retires a no-op review and closes its rewrite without changing payload or formal content", async () => {
  const f = wikiFixture();
  try {
    f.write("wiki/sources/a.md", "newer formal content");
    const payload = {
      base: {},
      writes: [],
      decision: { promoted: [], merged: [], rejected: [], contradictions: [] },
      repoRoots: {},
    };
    const id = digest(JSON.stringify(payload));
    f.write(`wiki/_jobs/reviews/${id}.json`, JSON.stringify({ id, state: "pending", payload }));
    const task = await enqueueTask(f.root, {
      kind: "rewrite",
      pageId: "a",
      revision: "a".repeat(64),
      source: "raw:unchanged",
      reason: "content-drift",
    });
    await runTask(f.root, task.id, async () => ({
      state: "needs-review",
      result: { reviewId: id, keep: "audit" },
    }));
    await retireReview(f.root, id, "无写入建议，保留历史");
    const closed = readTask(f.root, task.id);
    expect(closed.state).toBe("closed");
    expect(closed.result).toMatchObject({ reviewId: id, keep: "audit", closureBasis: "review-retired" });
    expect(workerDue(f.root, closed)).toBe(false);
    expect(readReview(f.root, id)).toMatchObject({ state: "rejected", payload });
    expect(readFileSync(join(f.root, "wiki/sources/a.md"), "utf8")).toBe("newer formal content");
    await retireReview(f.root, id, "无写入建议，保留历史");
    expect(readTask(f.root, task.id)).toEqual(closed);
  } finally {
    f.cleanup();
  }
});
