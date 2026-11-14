import { describe, expect, it, vi } from "vitest";
import { type AgentRequest, runBatch, runPool } from "./batch";

const request = (id: string): AgentRequest => ({
  id,
  cwd: "/wiki",
  args: [],
  stdin: id,
  timeoutMs: 100,
  allowedWrites: [],
});
const success = (id: string) => ({ id, ok: true, exitCode: 0, stderrTail: "", costUsd: 0.2 });

describe("shared agent batch", () => {
  it("services ready I/O while a batch reuses immediately resolved cache entries", async () => {
    let completed = 0;
    let completedBeforeIo = 0;
    const io = new Promise<void>((resolve) =>
      setImmediate(() => {
        completedBeforeIo = completed;
        resolve();
      }),
    );
    await runPool(
      Array.from({ length: 40 }, (_, i) => i),
      2,
      async () => ++completed,
    );
    await io;
    expect(completed).toBe(40);
    expect(completedBeforeIo).toBeLessThan(40);
  });

  it("bounds concurrency and preserves input order across out-of-order completion", async () => {
    let active = 0;
    let peak = 0;
    const result = await runBatch([request("slow"), request("fast"), request("last")], {
      concurrency: 2,
      runAgent: async (req) => {
        peak = Math.max(peak, ++active);
        await new Promise((resolve) => setTimeout(resolve, req.id === "slow" ? 20 : 1));
        active--;
        return success(req.id);
      },
    });
    expect(peak).toBe(2);
    expect(result.results.map((r) => r.id)).toEqual(["slow", "fast", "last"]);
    expect(result.costUsd).toBeCloseTo(0.6);
    expect(result.unknownCostIds).toEqual([]);
  });

  it("isolates throws, wrong IDs and inconsistent exit status without losing reported cost", async () => {
    const result = await runBatch(["throws", "wrong", "exit", "good"].map(request), {
      concurrency: 2,
      runAgent: async (req) => {
        if (req.id === "throws") throw new Error("spawn failed");
        if (req.id === "wrong") return success("another-task");
        return { ...success(req.id), exitCode: req.id === "exit" ? 2 : 0 };
      },
    });
    expect(result.results.map((r) => r.ok)).toEqual([false, false, false, true]);
    expect(result.results.map((r) => r.id)).toEqual(["throws", "wrong", "exit", "good"]);
    expect(result.results[0]?.reason).toContain("spawn failed");
    expect(result.results[1]?.reason).toContain("another-task");
    expect(result.costUsd).toBeCloseTo(0.6);
    expect(result.unknownCostIds).toEqual(["throws"]);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects concurrency %s before invoking an agent",
    async (concurrency) => {
      const runAgent = vi.fn(async (req: AgentRequest) => success(req.id));
      await expect(runBatch([request("a")], { concurrency, runAgent })).rejects.toThrow(/concurrency/);
      expect(runAgent).not.toHaveBeenCalled();
    },
  );

  it("rejects duplicate IDs and invalid timeout before invoking any agent", async () => {
    const runAgent = vi.fn(async (req: AgentRequest) => success(req.id));
    for (const requests of [
      [request("a"), request("a")],
      [request("a"), { ...request("b"), timeoutMs: 0 }],
    ]) {
      await expect(runBatch(requests, { concurrency: 2, runAgent })).rejects.toThrow();
    }
    expect(runAgent).not.toHaveBeenCalled();
  });

  it("tracks missing and invalid costs as unknown rather than declaring them free", async () => {
    const result = await runBatch(["missing", "negative", "nan"].map(request), {
      concurrency: 1,
      runAgent: async (req) => ({
        ...success(req.id),
        costUsd: req.id === "missing" ? undefined : req.id === "negative" ? -1 : Number.NaN,
      }),
    });
    expect(result.costUsd).toBe(0);
    expect(result.unknownCostIds).toEqual(["missing", "negative", "nan"]);
    expect(result.results.map((r) => r.ok)).toEqual([true, false, false]);
  });

  it("routes events with their request identity", async () => {
    const events: string[] = [];
    await runBatch([request("a")], {
      concurrency: 1,
      onEvent: (id, event) => events.push(`${id}:${event.kind}`),
      runAgent: async (req, onEvent) => {
        onEvent?.({ kind: "tool", name: "Read", target: "a.md" });
        return success(req.id);
      },
    });
    expect(events).toEqual(["a:tool"]);
  });
});
