import { afterEach, expect, it, vi } from "vitest";
import { textBatch } from "./text-batch";

afterEach(() => vi.useRealTimers());

it("batches chunks in order, displays partial output, and flushes the tail exactly once on stop", () => {
  vi.useFakeTimers();
  const append = vi.fn();
  const batch = textBatch(append);
  batch.push("第一");
  batch.push("句话");
  expect(append).not.toHaveBeenCalled();
  vi.advanceTimersByTime(50);
  expect(append.mock.calls).toEqual([["第一句话"]]);
  batch.push("，还有尾巴");
  batch.flush();
  batch.flush();
  vi.runAllTimers();
  expect(append.mock.calls).toEqual([["第一句话"], ["，还有尾巴"]]);
});
