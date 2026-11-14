import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, expect, it, vi } from "vitest";
import type { RunAgent } from "./batch";
import { detectDrift } from "./drift";
import { enqueueTask, listTasks, runTask } from "./queue";
import { reconcileCycle } from "./reconcile";
import { selectedAgent } from "./selected-agent";
import { syncWiki } from "./sync";
import { wikiFixture } from "./test-fixture";
import { workOne } from "./worker";

vi.mock("./reconcile", () => ({ reconcileCycle: vi.fn(async () => ({ processed: 12 })) }));
vi.mock("./drift", () => ({ detectDrift: vi.fn(async () => []) }));
vi.mock("./worker", () => ({
  workerDue: () => true,
  workOne: vi.fn(async () => ({ state: "needs-review" })),
}));
const connection = vi.hoisted(() => vi.fn<RunAgent>());
vi.mock("./selected-agent", () => ({ selectedAgent: vi.fn(() => connection) }));
beforeEach(() => {
  vi.clearAllMocks();
  connection
    .mockReset()
    .mockResolvedValue({ id: "preflight", ok: true, exitCode: 0, stderrTail: "", output: '{"ready":true}' });
});

it("does not automatically restart failed content-drift rewrites on the next night", async () => {
  const f = wikiFixture();
  try {
    f.write("seeds.yaml", "repos: {}\nfeatures: []\n");
    const task = await enqueueTask(f.root, {
      kind: "rewrite",
      pageId: "a",
      revision: "a".repeat(64),
      source: "same evidence",
      reason: "content-drift",
    });
    await expect(
      runTask(f.root, task.id, async () => {
        throw new Error("failed earlier");
      }),
    ).rejects.toThrow("failed earlier");
    const result = await syncWiki(f.root, { mode: "production", seeds: "seeds.yaml", parameters: false });
    expect(result.tasks).toEqual([]);
    expect(workOne).not.toHaveBeenCalled();
    expect(listTasks(f.root)[0]?.state).toBe("failed");
    expect(detectDrift).toHaveBeenCalledWith(
      f.root,
      { sample: null, policy: { accountingOnly: true } },
      { retry: false },
    );
  } finally {
    f.cleanup();
  }
});

it("checks the connection once and leaves queued tasks untouched when the model is unavailable", async () => {
  const f = wikiFixture();
  try {
    f.write("seeds.yaml", "repos: {}\nfeatures: []\n");
    const task = await enqueueTask(f.root, {
      kind: "rewrite",
      pageId: "page-a",
      revision: "a".repeat(64),
      source: "source",
      reason: "changed",
    });
    connection.mockResolvedValueOnce({
      id: "preflight",
      ok: false,
      exitCode: 1,
      stderrTail: "",
      reason: "model not supported",
    });
    const result = await syncWiki(f.root, { mode: "production", seeds: "seeds.yaml", parameters: false });
    expect(result.failures).toEqual([
      { stage: "model-preflight", error: expect.stringContaining("model not supported") },
    ]);
    expect(selectedAgent).toHaveBeenCalledWith(f.root, "nightly-model-preflight");
    expect(connection).toHaveBeenCalledTimes(1);
    expect(reconcileCycle).not.toHaveBeenCalled();
    expect(detectDrift).not.toHaveBeenCalled();
    expect(workOne).not.toHaveBeenCalled();
    expect(result.tasks).toEqual([]);
    expect(listTasks(f.root).find((t) => t.id === task.id)?.state).toBe("queued");
    expect(JSON.parse(readFileSync(join(f.root, "wiki/_jobs/sync/last-run.json"), "utf8"))).toMatchObject({
      status: "failed",
      phase: "model-preflight",
      finishedAt: expect.any(String),
    });
    expect(JSON.parse(readFileSync(join(f.root, "wiki/_jobs/sync/daily-lease.json"), "utf8")).active).toBe(
      false,
    );
  } finally {
    f.cleanup();
  }
});

it("a production night runs all current tasks and a complete maintenance pass without test quotas", async () => {
  const f = wikiFixture();
  try {
    f.write("seeds.yaml", "repos: {}\nfeatures: []\n");
    for (let index = 0; index < 12; index++)
      await enqueueTask(f.root, {
        kind: "rewrite",
        pageId: `page-${index}`,
        revision: "a".repeat(64),
        source: "source",
        reason: "changed",
      });
    const result = await syncWiki(f.root, {
      mode: "production",
      seeds: "seeds.yaml",
      parameters: false,
    });
    expect(result.modelCallsAllowed).toBe(true);
    expect(result.tasks).toHaveLength(12);
    expect(workOne).toHaveBeenCalledTimes(12);
    expect(reconcileCycle).toHaveBeenCalledWith(f.root, null, { accountingOnly: true }, { retry: true });
    expect(detectDrift).toHaveBeenCalledWith(
      f.root,
      { sample: null, policy: { accountingOnly: true } },
      { retry: false },
    );
  } finally {
    f.cleanup();
  }
});

it("persists a failed model phase instead of reporting a successful production night", async () => {
  const f = wikiFixture();
  try {
    f.write("seeds.yaml", "repos: {}\nfeatures: []\n");
    vi.mocked(detectDrift).mockRejectedValueOnce(new Error("model unavailable"));
    await syncWiki(f.root, { mode: "production", seeds: "seeds.yaml", parameters: false });
    expect(JSON.parse(readFileSync(join(f.root, "wiki/_jobs/sync/last-run.json"), "utf8"))).toMatchObject({
      status: "failed",
      failures: [{ stage: "drift", error: "Error: model unavailable" }],
    });
  } finally {
    f.cleanup();
  }
});

it("a failed source fetch is reported while independent model phases still run", async () => {
  const f = wikiFixture();
  try {
    f.write(
      "seeds.yaml",
      'repos:\n  absent:\n    url: https://example.test\n    path: missing-repo\n    refs: {main: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}\nfeatures: []\n',
    );
    const result = await syncWiki(f.root, { mode: "production", seeds: "seeds.yaml", fetch: true });
    expect(result.reconciliation?.ok).toBe(true);
    expect(result.drift?.ok).toBe(true);
    expect(result.failures.some((f) => f.stage === "fetch:absent")).toBe(true);
    expect(JSON.parse(readFileSync(join(f.root, "wiki/_jobs/sync/last-run.json"), "utf8")).status).toBe(
      "failed",
    );
  } finally {
    f.cleanup();
  }
});
