import { expect, it } from "vitest";
import { enqueueTask, runTask } from "./queue";
import { wikiFixture } from "./test-fixture";

it("clears the old failure reason after a successful explicit retry", async () => {
  const f = wikiFixture();
  try {
    const task = await enqueueTask(f.root, {
      kind: "pr",
      repo: "vllm-project/vllm-ascend",
      number: 1,
      sourceHash: "a".repeat(64),
    });
    await expect(
      runTask(f.root, task.id, async () => {
        throw new Error("provider quota exhausted");
      }),
    ).rejects.toThrow("quota");
    const result = await runTask(
      f.root,
      task.id,
      async () => ({ state: "needs-review", result: { reviewId: "ready" } }),
      true,
    );
    expect(result.state).toBe("needs-review");
    expect(result.reason).toBeUndefined();
    expect(result.attempts).toBe(2);
  } finally {
    f.cleanup();
  }
});
