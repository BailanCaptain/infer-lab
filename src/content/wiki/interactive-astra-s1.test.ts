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
    expect(spec400.detail).toContain("HTTP 400");
    expect(spec400.detail).toContain("REJECTED");

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

    // Round-2: ab-released tail-append order & alloc-evict consistent ledger (0 reused, 20 recomputed, B0 ref=0 retained)
    const abRel = computePrefixPoolState(4, "full-8", "ab-released");
    expect(abRel.freeLruQueue).toEqual(["B4", "B5", "B2", "B3", "B1", "B0"]);
    expect(abRel.freeLruQueue.indexOf("B1")).toBeLessThan(abRel.freeLruQueue.indexOf("B0"));

    const evictSt = computePrefixPoolState(4, "full-8", "alloc-evict");
    expect(evictSt.reusedCells).toBe(0);
    expect(evictSt.recomputeCells).toBe(20);
    expect(evictSt.blocks.find((b) => b.id === "B0")?.refCnt).toBe(0);
    expect(evictSt.freeLruQueue).toEqual(["B0"]);

    // Round-2: hit-seed & lease-reject-400 never jump to seed-transfer-drop on gate toggle
    const hitAfterToggle = applyRforkGateToggle(
      { scenario: "hit-seed", dropBatch: 7, serviceStopped: true, memoryReset: true },
      "memory",
    );
    expect(hitAfterToggle.scenario).toBe("hit-seed");
    expect(hitAfterToggle.writtenBatches).toBe(12);

    expect(missAbortHtml).toContain("安全门异常拦停");
    expect(missAbortHtml).not.toContain("自动改读本地硬盘上线");

    // Round-3: Step 4 free queue continuous tail-append ["B4", "B5", "B2"], and evictStage overrides prior hitPreset in SVG
    expect(computePrefixPoolState(4, "full-8", "none").freeLruQueue).toEqual(["B4", "B5", "B2"]);
    const evictFromHalf7Html = renderToStaticMarkup(
      createElement(PrefixCachingInteractive, {
        ...baseProps("prefix-caching"),
        initialHitPreset: "half-7",
        initialEvictStage: "alloc-evict",
      }),
    );
    expect(evictFromHalf7Html).toContain("连借5块汰叶B1");
    expect(evictFromHalf7Html).not.toContain("首块B0+自算B3,B4");

    // Round-3: Scenario 3 (seed-transfer-drop) with failed gate updates takeaway & expanded detail to safety-abort
    const dropGateFailHtml = renderToStaticMarkup(
      createElement(RforkFallbackInteractive, {
        ...baseProps("rfork-fig-route-and-fallback"),
        initialScenario: "seed-transfer-drop",
        initialMemoryReset: false,
      }),
    );
    expect(dropGateFailHtml).toContain("安全门直接拉闸报错");
    expect(dropGateFailHtml).not.toContain("服务照样稳稳上线");
    expect(dropGateFailHtml).not.toContain("零崩溃退回本地 Safetensors 重载");
    expect(spec400.detail).toContain("8d6180e2");
    expect(spec400.detail).toContain("后台慢试");

    // Round-4: Step 4 -> Step 5 pops head B4 from ["B4", "B5", "B2"], leaving ["B5", "B2"]
    const step4State = computePrefixPoolState(4, "full-8", "none");
    const step5State = computePrefixPoolState(5, "full-8", "none");
    expect(step4State.freeLruQueue[0]).toBe("B4");
    expect(step5State.cowCopyFromTo).toEqual(["B3", "B4"]);
    expect(step5State.freeLruQueue).toEqual(["B5", "B2"]);

    // Round-4: cow-fork -> ab-released / alloc-evict never leaves stale "原读尾 → B3" in SVG
    for (const es of ["ab-released", "alloc-evict"] as const) {
      const cowThenEvictHtml = renderToStaticMarkup(
        createElement(PrefixCachingInteractive, {
          ...baseProps("prefix-caching"),
          initialStep: 5,
          initialHitPreset: "cow-fork",
          initialEvictStage: es,
        }),
      );
      expect(cowThenEvictHtml).not.toContain("原读尾 → B3");
      expect(cowThenEvictHtml).not.toContain("CoW改写");
    }

    // Round-4: Exhaustive 3 fallback scenarios × 4 gate combinations have zero contradictory labels
    for (const sc of ["planner-miss", "seed-transfer-drop", "cleanup-abort"] as const) {
      for (const svc of [true, false]) {
        for (const mem of [true, false]) {
          const html = renderToStaticMarkup(
            createElement(RforkFallbackInteractive, {
              ...baseProps("rfork-fig-route-and-fallback"),
              initialScenario: sc,
              initialServiceStopped: svc,
              initialMemoryReset: mem,
            }),
          );
          // Strip static scenario toolbar button labels before checking dynamic status/readout copy
          const dynamicHtml = html.replace(/<button\b[^>]*>[\s\S]*?<\/button>/g, "");
          if (svc && mem) {
            expect(dynamicHtml).toContain('data-exit="disk-online"');
            expect(dynamicHtml).not.toContain("抛明确 RuntimeError");
            expect(dynamicHtml).not.toContain("脏缓冲清理失败");
          } else {
            expect(dynamicHtml).toContain('data-exit="safety-abort"');
            expect(dynamicHtml).not.toContain("零中断退回本地 Safetensors");
            expect(dynamicHtml).not.toContain("零崩溃退回本地 Safetensors 重载");
            if (!svc && mem) {
              expect(dynamicHtml).toContain("门1");
              expect(dynamicHtml).not.toContain("脏显存清不掉");
              expect(dynamicHtml).not.toContain("脏缓冲清理失败");
            }
            if (sc === "planner-miss" && !mem) {
              expect(dynamicHtml).toContain("预登记显存注销失败");
              expect(dynamicHtml).not.toContain("残留脏块");
            }
          }
        }
      }
    }

    // Round-5: half-7 has 7 shared cells [0..6], so first divergence is 8th cell (0-based index 7)
    expect(half7Html).toContain("第8格异");
    expect(half7Html).toContain("第 8 格（索引 7）");
    expect(half7Html).not.toContain("第7格");
    expect(half7Html).not.toContain("第 7 格");
  });
});
