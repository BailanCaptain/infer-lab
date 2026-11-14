import { describe, expect, it } from "vitest";
import {
  REQUEST_EDGES,
  REQUEST_JOURNEY_SECONDS,
  REQUEST_JOURNEY_STARTS,
  REQUEST_STRUCTURE,
  requestBinding,
  requestHandoff,
  requestJourneyPosition,
  requestState,
  requestStatus,
  requestStreamState,
} from "../src/app/wiki/scene-request-data";

describe("R1 request data, shared by the scene and its readout", () => {
  it("stops describing a finished response as computing", () => {
    expect(requestStatus(requestState(3, 1))).toBe("回答已返回，流程结束");
    expect(requestStatus(requestState(1, 0.249))).toBe("本步已完成");
    expect(requestStatus(requestState(1, 0.1))).toBe("正在计算");
  });
  it("hands the previous B guide to the next A on the same clock as the data", () => {
    const at = (local: number) => requestState(1, (1 + local) / 4);
    expect(requestBinding(at(0.04))).toMatchObject({ from: "embed", to: "layers", mix: 0, output: 0 });
    const moving = at(0.12);
    expect(requestBinding(moving).mix).toBe(moving.handoff.motion);
    expect(requestBinding(moving).output).toBe(0);
    expect(requestBinding(at(0.21))).toMatchObject({ mix: 1 });
    expect(requestBinding(at(0.255))).toMatchObject({ mix: 1, output: 1 });
  });
  it("reconstructs the outgoing owner on seek, including the skipped return beat", () => {
    expect(requestBinding(requestState(3, 0.25))).toMatchObject({ from: "engine", to: "layers", mix: 0 });
    expect(requestBinding(requestState(0, 0))).toMatchObject({ from: "api", to: "api", mix: 1 });
  });
  it("also fades ownership inside a decode beat instead of jumping between workers and API", () => {
    const at = (work: number) => requestState(3, (1 + 0.255 + work * 0.62) / 4);
    for (const [start, from, to] of [
      [0.22, "layers", "sample"],
      [0.62, "sample", "api"],
      [0.92, "api", "engine"],
    ] as const) {
      expect(requestBinding(at(start + 0.0001))).toMatchObject({ from, to });
      expect(requestBinding(at(start + 0.0001)).mix).toBeLessThan(0.001);
      expect(requestBinding(at(start + 0.04)).mix).toBeCloseTo(0.5);
      expect(requestBinding(at(start + 0.08)).mix).toBeCloseTo(1);
    }
  });
  it("returns focus to the engine when the displayed batch becomes the next decode plan", () => {
    for (const [time, owner] of [
      [89, "api"],
      [90, "engine"],
      [91, "layers"],
    ] as const) {
      const { step, progress } = requestJourneyPosition(time);
      expect(requestState(step, progress).origin).toBe(owner);
    }
  });
  it("previews the receiving slot, lands, then holds still before computing", () => {
    expect(requestHandoff(0.04)).toEqual({ phase: "preview", motion: 0, work: 0 });
    expect(requestHandoff(0.12).phase).toBe("moving");
    expect(requestHandoff(0.12).motion).toBeGreaterThan(0);
    expect(requestHandoff(0.12).motion).toBeLessThan(1);
    expect(requestHandoff(0.21)).toEqual({ phase: "settled", motion: 1, work: 0 });
    expect(requestHandoff(0.25)).toEqual({ phase: "settled", motion: 1, work: 0 });
    expect(requestHandoff(0.27).work).toBeGreaterThan(0);
    expect(requestHandoff(0.88).work).toBe(1);
  });
  it("does no downstream work while the received input is settling", () => {
    for (let section = 0; section < 4; section++) {
      for (let phase = 0; phase < 4; phase++) {
        const waiting = requestState(section, (phase + 0.24) / 4);
        expect(waiting.work).toBe(0);
        if (waiting.stream?.generation) {
          expect(waiting.stream.generation.layers).toBe(0);
          expect(waiting.stream.generation.checked).toBe(0);
        }
      }
    }
  });
  it("keeps completed data expanded across every operation boundary", () => {
    for (let section = 0; section < 4; section++) {
      for (let phase = 0; phase < 4; phase++) {
        expect(requestState(section, (phase + 0.999) / 4).expansion).toBe(1);
        if (section || phase) expect(requestState(section, phase / 4).expansion).toBe(1);
      }
    }
  });
  it("runs the next decode input through verification before confirming or returning a new batch", () => {
    const before = requestStreamState(0.34);
    expect(before.confirmed).toEqual(["y₀"]);
    expect(before.clientText).toBe("先");
    expect(before.generation?.input).toEqual(["y₀", "d₁?", "d₂?", "d₃?"]);
    const checked = requestStreamState(0.4);
    expect(checked.generation?.computed).toBe(6);
    expect(checked.confirmed).toEqual(["y₀", "y₁", "y₂"]);
    expect(checked.clientText).toBe("先");
    expect(requestStreamState(0.54).generation?.input).toEqual(["y₂", "d₁′?", "d₂′?", "d₃′?"]);
  });
  it("plays all four sections on one timeline without replaying the first returned batch", () => {
    expect(REQUEST_JOURNEY_STARTS).toEqual([0, 28, 56, 84]);
    expect(REQUEST_JOURNEY_SECONDS).toBe(105);
    expect(requestJourneyPosition(28)).toEqual({ time: 28, step: 1, progress: 0 });
    expect(requestJourneyPosition(56)).toEqual({ time: 56, step: 2, progress: 0 });
    expect(requestJourneyPosition(84)).toEqual({ time: 84, step: 3, progress: 0.25 });
    expect(requestJourneyPosition(999)).toEqual({ time: 105, step: 3, progress: 1 });
    expect(requestJourneyPosition(-1).time).toBe(0);
    expect(requestJourneyPosition(Number.NaN).time).toBe(0);
  });
  it("never removes received text while playing forward, and resets on replay", () => {
    let previous = "";
    for (let seconds = 0; seconds <= REQUEST_JOURNEY_SECONDS; seconds += 0.25) {
      const { step, progress } = requestJourneyPosition(seconds);
      const s = requestState(step, progress);
      const received = s.stream?.clientText ?? (s.returned.length ? "先" : "");
      expect(received.startsWith(previous)).toBe(true);
      previous = received;
    }
    expect(previous).toContain("减少重复计算。");
    const end = requestJourneyPosition(REQUEST_JOURNEY_SECONDS);
    expect(requestState(end.step, end.progress).stream?.done).toBe(true);
    const restart = requestJourneyPosition(0);
    expect(requestState(restart.step, restart.progress).returned).toEqual([]);
  });
  it("returns through the engine instead of sending worker results straight to the client", () => {
    expect(REQUEST_EDGES.filter(([, to]) => to === "client")).toEqual([["api", "client"]]);
    expect(REQUEST_EDGES).toContainEqual(["client", "api"]);
    expect(REQUEST_EDGES).toContainEqual(["engine", "api"]);
    expect(REQUEST_EDGES).toContainEqual(["sample", "engine"]);
  });
  it("keeps each operation attached to the complete request structure", () => {
    for (let section = 0; section < 4; section++)
      for (let phase = 0; phase < 4; phase++)
        expect(REQUEST_STRUCTURE.some((n) => n.id === requestState(section, (phase + 0.5) / 4).origin)).toBe(
          true,
        );
  });
  it("streams each confirmed batch before the next batch, never speculative candidates", () => {
    expect(requestStreamState(0).sse).not.toContain('"role"');
    expect(requestStreamState(0.13).sse).toContain('"role":"assistant"');
    expect(requestStreamState(0.12).clientText).toBe("");
    const first = requestStreamState(0.23);
    expect(first.confirmed).toEqual(["y₀"]);
    expect(first.clientText).toBe("先");
    const second = requestStreamState(0.48);
    expect(second.confirmed).toEqual(["y₀", "y₁", "y₂"]);
    expect(second.clientText).toBe("先解释缓存作用。");
    const third = requestStreamState(0.73);
    expect(third.confirmed).toHaveLength(7);
    expect(third.clientText).toContain("</think>KV cache");
    expect(third.sse).toContain('"content"');
    expect(third.confirmed.every((id) => !id.includes("?"))).toBe(true);
  });
  it("frees request cache at engine stop, before the HTTP done marker", () => {
    const stopped = requestStreamState(0.88);
    expect(stopped.cacheReleased).toBe(true);
    expect(stopped.done).toBe(false);
    expect(requestStreamState(1).done).toBe(true);
    expect(requestStreamState(1).sse).toBe("data: [DONE]\n\n");
    expect(requestStreamState(0).clientText).toBe("");
    expect(requestStreamState(0).cacheReleased).toBe(false);
  });
  it("allocates cache capacity without claiming that it already contains computed data", () => {
    const s = requestState(0, 0.72);
    expect(s.allocatedBlocks).toBe(15);
    expect(s.cachedPositions).toBe(0);
    expect(s.confirmed).toEqual(["p₀", "p₁", "p₂", "p₃"]);
  });
  it("keeps input identity while four positions acquire four residual streams", () => {
    expect(requestState(1, 0.31).layersDone).toBe(0);
    const s = requestState(1, 0.47);
    expect(s.input).toEqual(["p₀", "p₁", "p₂", "p₃"]);
    expect(s.streams).toBe(4);
    expect(s.layersDone).toBe(45);
    expect(s.selectedPosition).toBeNull();
    expect(requestState(1, 0.72).selectedPosition).toBe(3);
    expect(requestState(1, 1).sampled).toBe(false);
  });
  it("never returns drafts or counts the sampled token as already computed", () => {
    const draft = requestState(2, 0.47);
    expect(draft.drafts).toEqual(["d₁?", "d₂?", "d₃?"]);
    expect(draft.returned).toEqual([]);
    const done = requestState(2, 1);
    expect(done.confirmed).toEqual(["p₀", "p₁", "p₂", "p₃", "y₀"]);
    expect(done.returned).toEqual(["y₀"]);
    expect(done.computed).toBe(4);
    expect(done.nextInput).toEqual(["y₀", "d₁?", "d₂?", "d₃?"]);
    expect(done.nextPositions).toEqual([4, 5, 6, 7]);
  });
  it("feeds the previous draft and MTP hidden into the following draft pass", () => {
    expect(requestState(2, 0.31).draftInput).toBe("y₀");
    const second = requestState(2, 0.37);
    expect(second.drafts).toEqual(["d₁?"]);
    expect(second.draftInput).toBe("d₁?");
    expect(second.draftHidden).toBe("hᴹ₁");
    expect(requestState(2, 0.44).draftInput).toBe("d₂?");
  });
  it("scrubbing back resets the state rather than retaining future output", () => {
    requestState(2, 1);
    expect(requestState(2, 0).returned).toEqual([]);
    expect(requestState(0, 0).allocatedBlocks).toBe(0);
    expect(requestState(1, 0).layersDone).toBe(0);
  });
});
