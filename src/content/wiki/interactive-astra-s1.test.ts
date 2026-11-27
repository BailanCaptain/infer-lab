import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { sanitizeDiagram } from "./diagram-sanitize";
import {
  computePrefixPoolState,
  PREFIX_EVICT_STAGES,
  PREFIX_HIT_PRESETS,
  PrefixCachingInteractive,
} from "./PrefixCachingInteractive";
import {
  applyRforkGateToggle,
  computeRforkFlowState,
  RFORK_SCENARIO_SPECS,
  RforkFallbackInteractive,
} from "./RforkFallbackInteractive";

function baseProps(id: string) {
  const raw = readFileSync(resolve(process.cwd(), "wiki", "diagrams", `${id}.svg`), "utf8");
  return {
    id,
    safeSvg: sanitizeDiagram(raw, `${id}::test`) ?? "",
    caption: id,
    scrollRef: () => {},
    scrollable: false,
    onScroll: () => {},
  };
}

describe("Astra Sign-Off S1 Regressions · PrefixCaching (P1-4) & RforkFallback (P1-8, P2-1)", () => {
  it("P1-4: PrefixCaching 6-block pool (B0..B5) never exceeds 4 cells per block across all steps, presets & evict stages", () => {
    for (const step of [1, 2, 3, 4, 5] as const) {
      for (const hp of PREFIX_HIT_PRESETS) {
        for (const ev of PREFIX_EVICT_STAGES) {
          const st = computePrefixPoolState(step, hp, ev);
          expect(st.blocks.map((b) => b.id)).toEqual(["B0", "B1", "B2", "B3", "B4", "B5"]);
          for (const blk of st.blocks) {
            expect(blk.cells).toHaveLength(4);
          }
        }
      }
    }

    const half7 = computePrefixPoolState(2, "half-7", "none");
    expect(half7.reusedCells).toBe(4);
    expect(half7.recomputeCells).toBe(6);
    expect(half7.blocks.find((b) => b.id === "B3")?.fillText).toBe("4/4");
    expect(half7.blocks.find((b) => b.id === "B4")?.fillText).toBe("2/4");
    expect(half7.freeLruQueue).toEqual(["B5"]);
    expect(half7.reqB.slots.map((s) => s.target)).toEqual(["B0", "B3", "B4"]);

    const diffSalt = computePrefixPoolState(2, "diff-salt", "none");
    expect(diffSalt.reusedCells).toBe(0);
    expect(diffSalt.recomputeCells).toBe(10);
    expect(diffSalt.blocks.find((b) => b.id === "B3")?.fillText).toBe("4/4");
    expect(diffSalt.blocks.find((b) => b.id === "B4")?.fillText).toBe("4/4");
    expect(diffSalt.blocks.find((b) => b.id === "B5")?.fillText).toBe("2/4");
    expect(diffSalt.freeLruQueue).toEqual([]);
    expect(diffSalt.reqB.slots.map((s) => s.target)).toEqual(["B3", "B4", "B5"]);
  });

  it("P1-8 & P2-1: RforkFallback separates 400 REJECTED from TTL 404 RELEASED and never fabricates batches on planner-miss gate toggle", () => {
    const spec400 = RFORK_SCENARIO_SPECS["lease-reject-400"];
    expect(spec400.faultBadge).toBe("归还 400 REJECTED");
    expect(spec400.detail).toContain("200/404 统一映射为 RELEASED");
    expect(spec400.detail).toContain("HTTP 400 REJECTED");

    // P2-1: Toggling safety gates while on planner-miss preserves scenario="planner-miss" and writtenBatches=0
    const missInit = computeRforkFlowState("planner-miss", 7, true, true);
    expect(missInit.writtenBatches).toBe(0);

    const afterMemFail = applyRforkGateToggle(
      { scenario: "planner-miss", dropBatch: 7, serviceStopped: true, memoryReset: true },
      "memory",
    );
    expect(afterMemFail.scenario).toBe("planner-miss");
    expect(afterMemFail.writtenBatches).toBe(0);
    expect(afterMemFail.unknownBatch).toBeNull();
    expect(afterMemFail.activeExit).toBe("safety-abort");

    const afterMemRestore = applyRforkGateToggle(
      { scenario: "planner-miss", dropBatch: 7, serviceStopped: true, memoryReset: false },
      "memory",
    );
    expect(afterMemRestore.scenario).toBe("planner-miss");
    expect(afterMemRestore.writtenBatches).toBe(0);
    expect(afterMemRestore.activeExit).toBe("disk-online");

    const missAbortHtml = renderToStaticMarkup(
      createElement(RforkFallbackInteractive, {
        ...baseProps("rfork-fig-route-and-fallback"),
        initialScenario: "planner-miss",
        initialMemoryReset: false,
      }),
    );
    expect(missAbortHtml).toContain("0 批已写 · 1–12 批未读");
    expect(missAbortHtml).not.toContain("1–6 已写");

    const half7Html = renderToStaticMarkup(
      createElement(PrefixCachingInteractive, {
        ...baseProps("prefix-caching"),
        initialHitPreset: "half-7",
      }),
    );
    expect(half7Html).toContain("B3 · 4/4");
    expect(half7Html).toContain("B4 · 2/4");
    expect(half7Html).not.toContain("B3 · 自算 6 格");
  });
});
