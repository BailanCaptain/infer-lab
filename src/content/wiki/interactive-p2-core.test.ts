import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AscendFaTilingInteractive, computeAscendFaState } from "./AscendFaTilingInteractive";
import {
  ContinuousBatchingTraceInteractive,
  computeContinuousBatchTrace,
} from "./ContinuousBatchingTraceInteractive";
import { computeEplbState, EplbCycleInteractive } from "./EplbCycleInteractive";
import { computeMooncakeTransferState, MooncakeConnectorInteractive } from "./MooncakeConnectorInteractive";
import { computePrefixPoolState, PrefixCachingInteractive } from "./PrefixCachingInteractive";
import { computeSpecDecodeState, SpeculativeDecodingInteractive } from "./SpeculativeDecodingInteractive";

const ALLOWED_WARM_MINERAL_HEX = new Set([
  "#fbfaf6",
  "#ece9df",
  "#d8d8cf",
  "#17211f",
  "#66716d",
  "#e85b32",
  "#087f73",
  "#ddf4ef",
  "#c78300",
  "#fff4cf",
  "#4c65b6",
  "#e8edff",
  "#9a4b86",
  "#f7e7f2",
  "#b54237",
  "#fff0e9",
  "#ffffff",
]);

function baseProps(id: string) {
  const raw = readFileSync(resolve(process.cwd(), "wiki", "diagrams", `${id}.svg`), "utf8");
  return {
    id,
    safeSvg: raw,
    caption: id,
    scrollRef: () => {},
    scrollable: false,
    onScroll: () => {},
  };
}

function assertRichSvgInvariants(label: string, html: string) {
  const svgMatches = [...html.matchAll(/<svg\b[^>]*>/g)];
  expect(svgMatches, `${label} has exactly 1 inline SVG`).toHaveLength(1);
  const widthVal = Number(/\bwidth="(\d+)"/.exec(svgMatches[0]![0])?.[1]);
  expect(widthVal, `${label} width <= 900`).toBeLessThanOrEqual(900);
  expect(widthVal, `${label} width >= 800`).toBeGreaterThanOrEqual(800);

  for (const fm of html.matchAll(/\bfont-size="([0-9.]+)"/g)) {
    expect(Number(fm[1]), `${label} font-size >= 12`).toBeGreaterThanOrEqual(12);
  }
  for (const hm of html.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
    expect(ALLOWED_WARM_MINERAL_HEX.has(hm[0].toLowerCase()), `${label} hex ${hm[0]}`).toBe(true);
  }
  const texts = [...html.matchAll(/<text\b([^>]*)>([^<]+)<\/text>/g)].map((tm) => {
    const attrs = tm[1]!;
    const content = tm[2]!;
    const x = Number(/\bx="([0-9.]+)"/.exec(attrs)?.[1]);
    const y = Number(/\by="([0-9.]+)"/.exec(attrs)?.[1]);
    const anchor = /\btext-anchor="([^"]+)"/.exec(attrs)?.[1] ?? "start";
    const estW = content.length * 8;
    const x0 = anchor === "end" ? x - estW : anchor === "middle" ? x - estW / 2 : x;
    return { content, x0, x1: x0 + estW, y0: y - 11, y1: y + 2 };
  });
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i]!;
      const b = texts[j]!;
      const overlap = a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
      expect(overlap, `${label} SVG text overlap: "${a.content}" vs "${b.content}"`).toBe(false);
    }
  }
}

describe("Phase 2 Core 6 富交互 2D 沙盘深度演算与全景 SVG 验收", () => {
  it("1. SpeculativeDecoding：K=3/5、三分支提交词数(1/3/4/6)、覆写回滚位与拒绝采样期望(2.734375 / 1.328125)", () => {
    const sFirst = computeSpecDecodeState(3, "first-wrong", "greedy", 0.75);
    const sMid = computeSpecDecodeState(3, "mismatch-3", "greedy", 0.75);
    const sAll = computeSpecDecodeState(3, "all-hit", "greedy", 0.75);
    const sK5All = computeSpecDecodeState(5, "all-hit", "rejection", 0.75);
    const sLowAlpha = computeSpecDecodeState(3, "mismatch-3", "rejection", 0.25);

    expect([sFirst.committedCount, sMid.committedCount, sAll.committedCount, sK5All.committedCount]).toEqual([
      1, 3, 4, 6,
    ]);
    expect([sFirst.nextOverwritePos, sMid.nextOverwritePos, sAll.nextOverwritePos]).toEqual([6, 8, 9]);
    expect(sMid.committedWords).toEqual(["坐", "在", "垫子"]);
    expect(sLowAlpha.committedWords).toEqual(["坐", "在", "地毯"]);
    expect(sMid.expectedTokens).toBe(2.734375);
    expect(sLowAlpha.expectedTokens).toBe(1.328125);
    expect(sMid.acceptThreshold).toBe(0.125);
    expect(sMid.residualProbs).toEqual([0.5, 0.5, 0]);

    for (const k of [3, 5] as const) {
      for (const br of ["first-wrong", "mismatch-3", "all-hit"] as const) {
        for (const vm of ["greedy", "rejection"] as const) {
          const html = renderToStaticMarkup(
            createElement(SpeculativeDecodingInteractive, {
              ...baseProps("speculative-decoding"),
              initialStep: 4,
              initialK: k,
              initialBranch: br,
              initialVerifyMode: vm,
            }),
          );
          assertRichSvgInvariants(`spec-k${k}-${br}-${vm}`, html);
        }
      }
    }
  });

  it("2. PrefixCaching：全命中8格 / 半块7格仅复4格 / 异盐0命中 / CoW拷1块 / 叶块B1早于根块B0驱逐", () => {
    const full8 = computePrefixPoolState(2, "full-8", "none");
    const half7 = computePrefixPoolState(2, "half-7", "none");
    const diffSalt = computePrefixPoolState(2, "diff-salt", "none");
    const cow = computePrefixPoolState(5, "cow-fork", "none");
    const released = computePrefixPoolState(4, "full-8", "ab-released");
    const evicted = computePrefixPoolState(4, "full-8", "alloc-evict");

    expect([full8.reusedCells, full8.recomputeCells, full8.copiedBlocks]).toEqual([8, 2, 0]);
    expect([half7.reusedCells, half7.recomputeCells, half7.copiedBlocks]).toEqual([4, 6, 0]);
    expect([diffSalt.reusedCells, diffSalt.recomputeCells, diffSalt.copiedBlocks]).toEqual([0, 10, 0]);
    expect(cow.copiedBlocks).toBe(1);
    expect(released.freeLruQueue.indexOf("B1")).toBeLessThan(released.freeLruQueue.indexOf("B0"));
    expect(evicted.evictedBlocks).toEqual(["B1"]);
    expect(evicted.h0Registered).toBe(true);
    expect(evicted.h1Registered).toBe(false);

    for (const hp of ["full-8", "half-7", "diff-salt", "cow-fork"] as const) {
      const html = renderToStaticMarkup(
        createElement(PrefixCachingInteractive, {
          ...baseProps("prefix-caching"),
          initialHitPreset: hp,
        }),
      );
      assertRichSvgInvariants(`prefix-${hp}`, html);
      expect(html).toContain("logits");
    }
    const evHtml = renderToStaticMarkup(
      createElement(PrefixCachingInteractive, {
        ...baseProps("prefix-caching"),
        initialEvictStage: "alloc-evict",
      }),
    );
    assertRichSvgInvariants("prefix-alloc-evict", evHtml);
  });

  it("3–6. Mooncake / AscendFaTiling / ContinuousBatchingTrace / EplbCycle 精确算例与全景 SVG 零重叠", () => {
    const mcSym05 = computeMooncakeTransferState("sym-tp2", 0.5);
    const mcAsym15 = computeMooncakeTransferState("asym-tp4-tp2", 1.5);
    expect([mcSym05.segmentCount, mcSym05.segmentKiB, mcSym05.pullTotal, mcSym05.pushTotal]).toEqual([
      6, 64, 4.5, 3.5,
    ]);
    expect([mcAsym15.segmentCount, mcAsym15.segmentKiB, mcAsym15.pullTotal, mcAsym15.pushTotal]).toEqual([
      12, 32, 7.5, 5.5,
    ]);
    expect(mcAsym15.pBlock7AddrKiB).toBe(5224);
    expect(mcAsym15.dBlock3AddrKiB).toBe(1192);
    for (const tp of ["sym-tp2", "asym-tp4-tp2"] as const) {
      for (const xu of [0.5, 1.5] as const) {
        const html = renderToStaticMarkup(
          createElement(MooncakeConnectorInteractive, {
            ...baseProps("mooncake-connector"),
            initialStep: 4,
            initialTpMode: tp,
            initialXferUnit: xu,
          }),
        );
        assertRichSvgInvariants(`mooncake-${tp}-${xu}`, html);
      }
    }

    const faPeak32k = computeAscendFaState(32768, "peak-refresh");
    const faKeep4k = computeAscendFaState(4096, "keep-peak");
    expect([faPeak32k.naiveScoreGiB, faPeak32k.l2, faPeak32k.oTilde2, faPeak32k.finalOut]).toEqual([
      64, 1.234909, 35.196059, 28.500924,
    ]);
    expect([faKeep4k.naiveScoreGiB, faKeep4k.rescaleAlpha, faKeep4k.finalOut]).toEqual([1, 1, 18.068243]);
    for (const sl of [4096, 32768] as const) {
      for (const sp of ["peak-refresh", "keep-peak"] as const) {
        const html = renderToStaticMarkup(
          createElement(AscendFaTilingInteractive, {
            ...baseProps("ascend-fa-hbm-vs-tiling"),
            initialStep: 3,
            initialSeqLen: sl,
            initialScorePreset: sp,
          }),
        );
        assertRichSvgInvariants(`fa-${sl}-${sp}`, html);
      }
    }

    const cb8t2 = computeContinuousBatchTrace(2, 8);
    const cb5t2 = computeContinuousBatchTrace(2, 5);
    const cb5t4 = computeContinuousBatchTrace(4, 5);
    expect([cb8t2.batchSlices.map((b) => b.tokens), cb8t2.queryStartLoc]).toEqual([
      [1, 1, 4],
      "[0, 1, 2, 6]",
    ]);
    expect([cb5t2.batchSlices.map((b) => b.tokens), cb5t2.queryStartLoc]).toEqual([[1, 1], "[0, 1, 2]"]);
    expect([cb5t4.batchSlices.map((b) => b.tokens), cb5t4.queryStartLoc]).toEqual([[1, 4], "[0, 1, 5]"]);
    for (const bg of [8, 5] as const) {
      for (const st of [1, 2, 3, 4] as const) {
        const html = renderToStaticMarkup(
          createElement(ContinuousBatchingTraceInteractive, {
            ...baseProps("continuous-batching-two-queues-trace"),
            initialStep: st,
            initialBudget: bg,
          }),
        );
        assertRichSvgInvariants(`cb-${bg}-${st}`, html);
      }
    }

    const ep0 = computeEplbState(5, 0, "skew-8-4");
    const ep2Skew = computeEplbState(5, 2, "skew-8-4");
    const ep2Even = computeEplbState(5, 2, "even-6-6");
    expect([ep0.actualPairs, ep0.actualImbalance]).toEqual([[14, 6], "1.4"]);
    expect([
      ep2Skew.plannedPairs,
      ep2Skew.plannedImbalance,
      ep2Skew.actualPairs,
      ep2Skew.actualImbalance,
    ]).toEqual([[10, 10], "1.0", [12, 8], "1.2"]);
    expect([ep2Even.actualPairs, ep2Even.actualImbalance]).toEqual([[10, 10], "1.0"]);
    for (const rs of [0, 2] as const) {
      for (const sk of ["skew-8-4", "even-6-6"] as const) {
        const html = renderToStaticMarkup(
          createElement(EplbCycleInteractive, {
            ...baseProps("eplb-cycle"),
            initialStep: 5,
            initialRedundantSlots: rs,
            initialSourceSkew: sk,
          }),
        );
        assertRichSvgInvariants(`eplb-${rs}-${sk}`, html);
      }
    }
  });
});
