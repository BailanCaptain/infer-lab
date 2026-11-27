import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AscendFaTilingInteractive, computeAscendFaState } from "./AscendFaTilingInteractive";
import {
  computeSpecDecodeState,
  evaluateRejectionStep,
  SPEC_SLOT_PROB_TABLES,
  SpeculativeDecodingInteractive,
  sampleCategorical,
} from "./SpeculativeDecodingInteractive";

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

function assertSvgClean(label: string, html: string) {
  const svgMatches = [...html.matchAll(/<svg\b[^>]*>/g)];
  expect(svgMatches, `${label} has 1 inline SVG`).toHaveLength(1);
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

describe("Astra S2 回归：P1-5 SpeculativeDecoding 真实拒绝采样与 P1-6 AscendFaTiling 动态缩放一致性", () => {
  it("P1-5a：SpeculativeDecoding 在 mismatch-3 / first-wrong / all-hit 下 greedy 与 rejection 按真实 p/q 门限与残差分布分化", () => {
    const greedyMid = computeSpecDecodeState(3, "mismatch-3", "greedy", 0.75);
    const rejectMid = computeSpecDecodeState(3, "mismatch-3", "rejection", 0.75);

    expect(greedyMid.committedWords).toEqual(["坐", "在", "垫子"]);
    expect(rejectMid.committedWords).toEqual(["坐", "在", "地毯"]);
    expect(rejectMid.acceptThreshold).toBe(0.125);
    expect(rejectMid.residualProbs).toEqual([0.5, 0.5, 0]);
    expect(rejectMid.slots[0]?.acceptProb).toBe(0.9);
    expect(rejectMid.slots[0]?.verdict).toBe("hit");
    expect(rejectMid.slots[1]?.acceptProb).toBe(1);
    expect(rejectMid.slots[1]?.verdict).toBe("hit");
    expect(rejectMid.slots[2]?.acceptProb).toBe(0.125);
    expect(rejectMid.slots[2]?.uAccept).toBe(0.5);
    expect(rejectMid.slots[2]?.verdict).toBe("mismatch");
    expect(rejectMid.slots[2]?.mainPred).toBe("地毯");

    // 精确边际分布恒等式：q(x)*min(1,p(x)/q(x)) + (1 - sum min(p,q))*p_res(x) === p(x)
    const slot2Table = SPEC_SLOT_PROB_TABLES["mismatch-3"][2]!;
    const totalAcceptMass = slot2Table.p.reduce((acc, pv, i) => acc + Math.min(pv, slot2Table.q[i]!), 0);
    for (let i = 0; i < 3; i++) {
      const pi = slot2Table.p[i]!;
      const qi = slot2Table.q[i]!;
      const marginal = qi * Math.min(1, pi / qi) + (1 - totalAcceptMass) * rejectMid.residualProbs[i]!;
      expect(marginal).toBeCloseTo(pi, 9);
    }

    const greedyFirst = computeSpecDecodeState(3, "first-wrong", "greedy", 0.75);
    const rejectFirst = computeSpecDecodeState(3, "first-wrong", "rejection", 0.75);
    expect(greedyFirst.committedWords).toEqual(["坐"]);
    expect(rejectFirst.committedWords).toEqual(["趴"]);
    expect(rejectFirst.acceptThreshold).toBe(0.2);
    expect(rejectFirst.residualProbs).toEqual([0.3, 0.7, 0]);

    const greedyAll = computeSpecDecodeState(3, "all-hit", "greedy", 0.75);
    const rejectAll = computeSpecDecodeState(3, "all-hit", "rejection", 0.75);
    expect(greedyAll.committedWords).toEqual(["坐", "在", "垫子", "上"]);
    expect(rejectAll.committedWords).toEqual(["坐", "在", "垫子", "里"]);
  });

  it("P1-5b：evaluateRejectionStep 支持非 argmax 词因 p>=q 合法留存、门限边界及 SVG/面板零矛盾渲染", () => {
    const nonArgmaxAccepted = evaluateRejectionStep(
      {
        vocab: ["垫子", "地毯", "床"],
        p: [0.55, 0.35, 0.1],
        q: [0.6, 0.25, 0.15],
        uAccept: 0.92,
        uResidual: 0.5,
      },
      "地毯",
    );
    expect(nonArgmaxAccepted.acceptedInGreedy).toBe(false);
    expect(nonArgmaxAccepted.acceptProb).toBe(1);
    expect(nonArgmaxAccepted.acceptedInRejection).toBe(true);
    expect(sampleCategorical(["垫子", "地毯", "床"], [0.5, 0.5, 0], 0.5)).toBe("垫子");
    expect(sampleCategorical(["垫子", "地毯", "床"], [0.5, 0.5, 0], 0.51)).toBe("地毯");

    const greedyHtml = renderToStaticMarkup(
      createElement(SpeculativeDecodingInteractive, {
        ...baseProps("speculative-decoding"),
        initialStep: 4,
        initialK: 3,
        initialBranch: "mismatch-3",
        initialVerifyMode: "greedy",
      }),
    );
    const rejectHtml = renderToStaticMarkup(
      createElement(SpeculativeDecodingInteractive, {
        ...baseProps("speculative-decoding"),
        initialStep: 4,
        initialK: 3,
        initialBranch: "mismatch-3",
        initialVerifyMode: "rejection",
      }),
    );
    assertSvgClean("spec-greedy-s4", greedyHtml);
    assertSvgClean("spec-reject-s4", rejectHtml);
    expect(greedyHtml).toContain("改8:垫子");
    expect(greedyHtml).toContain("净收[坐、在、垫子]");
    expect(rejectHtml).toContain("拒→补8:地毯");
    expect(rejectHtml).toContain("留6:坐(≤0.9)");
    expect(rejectHtml).toContain("净收[坐、在、地毯]");
    expect(rejectHtml).toContain("[0.5, 0.5, 0] · u_res=0.75 → 抽「地毯」");
    expect(rejectHtml).not.toContain("净收[坐、在、垫子]");

    for (const step of [1, 2, 3, 4] as const) {
      for (const vm of ["greedy", "rejection"] as const) {
        const html = renderToStaticMarkup(
          createElement(SpeculativeDecodingInteractive, {
            ...baseProps("speculative-decoding"),
            initialStep: step,
            initialK: 5,
            initialBranch: "mismatch-3",
            initialVerifyMode: vm,
          }),
        );
        assertSvgClean(`spec-s${step}-k5-${vm}`, html);
      }
    }
  });

  it("P1-6：AscendFaTiling 在 keep-peak 与 peak-refresh 下全屏统一缩放因子 exp(m_prev - m_new)，消除 0.1353 残留矛盾", () => {
    const keepState = computeAscendFaState(4096, "keep-peak");
    const refreshState = computeAscendFaState(4096, "peak-refresh");
    expect([keepState.m1, keepState.m2, keepState.rescaleAlpha, keepState.peakRefreshed]).toEqual([
      2,
      2,
      1,
      false,
    ]);
    expect([
      refreshState.m1,
      refreshState.m2,
      Number(refreshState.rescaleAlpha.toFixed(4)),
      refreshState.peakRefreshed,
    ]).toEqual([2, 4, 0.1353, true]);

    for (const sl of [4096, 32768] as const) {
      for (const step of [2, 3, 4] as const) {
        const keepHtml = renderToStaticMarkup(
          createElement(AscendFaTilingInteractive, {
            ...baseProps("ascend-fa-hbm-vs-tiling"),
            initialStep: step,
            initialSeqLen: sl,
            initialScorePreset: "keep-peak",
          }),
        );
        assertSvgClean(`fa-keep-${sl}-s${step}`, keepHtml);
        expect(keepHtml).not.toContain("0.1353");
        expect(keepHtml).not.toContain("e^(2−4)");
        expect(keepHtml).not.toContain("m_new=4");
        expect(keepHtml).not.toContain("35.1961");
        expect(keepHtml).not.toContain("1.2349");
        expect(keepHtml).not.toContain("28.5009");
        if (step === 3) {
          expect(keepHtml).toContain("m₁=2 → m_new=2");
          expect(keepHtml).toContain("e^(2−2) = 1");
          expect(keepHtml).toContain("无需缩小旧账");
        }

        const refreshHtml = renderToStaticMarkup(
          createElement(AscendFaTilingInteractive, {
            ...baseProps("ascend-fa-hbm-vs-tiling"),
            initialStep: step,
            initialSeqLen: sl,
            initialScorePreset: "peak-refresh",
          }),
        );
        assertSvgClean(`fa-refresh-${sl}-s${step}`, refreshHtml);
        expect(refreshHtml).not.toContain("e^(2−2)");
        expect(refreshHtml).not.toContain("无需缩小旧账");
        if (step === 3) {
          expect(refreshHtml).toContain("m₁=2 → m_new=4");
          expect(refreshHtml).toContain("e^(2−4) ≈ 0.1353");
        }
      }
    }

    // Round-2: unrounded p/q threshold comparison (0.3/0.7 = 0.428571... < 0.42859 -> rejected!)
    const tightEval = evaluateRejectionStep(
      { vocab: ["甲", "乙", "丙"], p: [0.3, 0.5, 0.2], q: [0.7, 0.2, 0.1], uAccept: 0.42859, uResidual: 0.5 },
      "甲",
    );
    expect(tightEval.acceptProb).toBe(0.4286);
    expect(tightEval.acceptedInRejection).toBe(false);

    // Round-2: Step 4 expanded details in rejection mode uses actual committed word ("地毯"), not hardcoded "垫子"
    const specStep4Rej = renderToStaticMarkup(
      createElement(SpeculativeDecodingInteractive, {
        ...baseProps("speculative-decoding"),
        initialStep: 4,
        initialK: 3,
        initialBranch: "mismatch-3",
        initialVerifyMode: "rejection",
      }),
    );
    expect(specStep4Rej).toContain("下一轮送入「地毯 + 新草稿」");
    expect(specStep4Rej).not.toContain("下一轮送入「垫子");

    // Round-3: Step 4 all-hit bonus word position equals predTargetPos (9 for K=3), not 8
    const specStep4AllHit = renderToStaticMarkup(
      createElement(SpeculativeDecodingInteractive, {
        ...baseProps("speculative-decoding"),
        initialStep: 4,
        initialK: 3,
        initialBranch: "all-hit",
        initialVerifyMode: "rejection",
      }),
    );
    expect(specStep4AllHit).toContain("位置 9 的奖励词「里」");
    expect(specStep4AllHit).not.toContain("位置 8 的奖励词");
  });
});
