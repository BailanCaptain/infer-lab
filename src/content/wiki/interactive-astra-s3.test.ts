import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { computeEplbState, EPLB_CYCLE_STEPS, EplbCycleInteractive } from "./EplbCycleInteractive";
import {
  computeWorkerLifecycleState,
  WORKER_CLUSTER_PRESETS,
  WORKER_LIFECYCLE_STAGES,
  WorkerLifecycleInteractive,
} from "./WorkerLifecycleInteractive";

function baseProps(id: string) {
  return {
    id,
    caption: `${id}-caption`,
    safeSvg: `<svg viewBox="0 0 120 60"><rect width="120" height="60" fill="#fbfaf6"/></svg>`,
    scrollRef: { current: null },
    scrollable: false,
    onScroll: () => {},
  };
}

function assertSvgTextInvariants(html: string, label: string) {
  const svgMatch = html.match(/<svg[\s\S]*?<\/svg>/);
  expect(svgMatch, `${label}: missing sandbox svg`).not.toBeNull();
  const svg = svgMatch![0];

  const boxes: Array<{ x1: number; y1: number; x2: number; y2: number; text: string }> = [];
  const textRegex = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
  for (const m of svg.matchAll(textRegex)) {
    const attrs = m[1] ?? "";
    const content = (m[2] ?? "").replace(/<[^>]+>/g, "").trim();
    const fsMatch = attrs.match(/font-size="(\d+(?:\.\d+)?)"/);
    expect(fsMatch, `${label}: <text> "${content}" missing font-size`).not.toBeNull();
    const fontSize = Number(fsMatch![1]);
    expect(fontSize, `${label}: <text> "${content}" font-size < 12`).toBeGreaterThanOrEqual(12);

    const x = Number(attrs.match(/\bx="(-?\d+(?:\.\d+)?)"/)?.[1] ?? 0);
    const y = Number(attrs.match(/\by="(-?\d+(?:\.\d+)?)"/)?.[1] ?? 0);
    const anchor = attrs.match(/text-anchor="([^"]+)"/)?.[1] ?? "start";
    let estWidth = 0;
    for (const ch of content) {
      estWidth += ch.charCodeAt(0) > 255 ? fontSize * 0.95 : fontSize * 0.55;
    }
    const x1 = anchor === "middle" ? x - estWidth / 2 : anchor === "end" ? x - estWidth : x;
    const x2 = x1 + estWidth;
    const y1 = y - fontSize * 0.85;
    const y2 = y + fontSize * 0.2;
    boxes.push({ x1, y1, x2, y2, text: content });
  }

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      const overlapX = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
      const overlapY = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
      expect(
        overlapX > 1 && overlapY > 1,
        `${label}: SVG <text> overlap between "${a.text}" and "${b.text}"`,
      ).toBe(false);
    }
  }
}

describe("Astra S3 regressions: EplbCycleInteractive (P1-7) & WorkerLifecycleInteractive (P2-2)", () => {
  it("P1-7: EplbCycleInteractive keeps actual NPU load at [16, 4] in steps 1 & 2 before step 3 HBM transfer/table swap", () => {
    const s1 = computeEplbState(1);
    expect(s1.actualPairs).toEqual([16, 4]);
    expect(s1.card0LoadPct).toBe(80);
    expect(s1.card1LoadPct).toBe(20);
    expect(s1.actualImbalance).toBe("1.6");

    const s2 = computeEplbState(2);
    expect(s2.plannedPairs).toEqual([10, 10]);
    expect(s2.plannedImbalance).toBe("1.0");
    expect(s2.actualPairs).toEqual([16, 4]);
    expect(s2.card0LoadPct).toBe(80);
    expect(s2.card1LoadPct).toBe(20);
    expect(s2.actualImbalance).toBe("1.6");

    const htmlStep2 = renderToStaticMarkup(
      createElement(EplbCycleInteractive, { ...baseProps("eplb-s3"), initialStep: 2 }),
    );
    expect(htmlStep2).toContain(`峰均比 ${EPLB_CYCLE_STEPS[1]!.imbalanceRatio}`);
    expect(htmlStep2).toContain("实际卡 0：16 对 (80%)");
    expect(htmlStep2).toContain("实际卡 1：4 对 (20%)");
    expect(htmlStep2).toContain("实际峰均比 1.6");
    expect(htmlStep2).toContain("规划卡 0：10 对 (待第3步切换)");
    expect(htmlStep2).toContain("规划卡 1：10 对 (待第3步切换)");
    expect(htmlStep2).toContain("待第 3 步搬运切换");
    expect(htmlStep2).not.toContain("实际卡 0：10 对");
    expect(htmlStep2).not.toContain("实际卡 1：10 对");
    expect(htmlStep2).not.toContain("实际峰均比 1.0");

    const s3 = computeEplbState(3);
    expect(s3.actualPairs).toEqual([10, 10]);
    expect(s3.card0LoadPct).toBe(50);
    expect(s3.card1LoadPct).toBe(50);
    expect(s3.actualImbalance).toBe("1.0");

    const htmlStep3 = renderToStaticMarkup(
      createElement(EplbCycleInteractive, { ...baseProps("eplb-s3"), initialStep: 3 }),
    );
    expect(htmlStep3).toContain("实际卡 0：10 对 (50%)");
    expect(htmlStep3).toContain("实际卡 1：10 对 (50%)");
    expect(htmlStep3).toContain("实际峰均比 1.0");

    const s5NoRed = computeEplbState(5, 0);
    expect(s5NoRed.plannedPairs).toEqual([14, 6]);
    expect(s5NoRed.actualPairs).toEqual([14, 6]);
    expect(s5NoRed.actualImbalance).toBe("1.4");

    const s5Skew = computeEplbState(5, 2, "skew-8-4");
    expect(s5Skew.plannedPairs).toEqual([10, 10]);
    expect(s5Skew.actualPairs).toEqual([12, 8]);
    expect(s5Skew.actualImbalance).toBe("1.2");

    for (const item of EPLB_CYCLE_STEPS) {
      const html = renderToStaticMarkup(
        createElement(EplbCycleInteractive, { ...baseProps("eplb-svg-check"), initialStep: item.step }),
      );
      assertSvgTextInvariants(html, `eplb-step-${item.step}`);
    }
  });

  it("P2-2: WorkerLifecycleInteractive marks KV alignment/token budget as pending while Rank 1 lags at Stage 4 barrier", () => {
    const lagStage4 = computeWorkerLifecycleState(4, "rank1-lag", false);
    expect(lagStage4.rank1LaggingAtBarrier).toBe(true);
    expect(lagStage4.rank0Reported).toBe(true);
    expect(lagStage4.rank0RawBlocks).toBe(10);
    expect(lagStage4.rank1Reported).toBe(false);
    expect(lagStage4.budgetStatus).toBe("pending-barrier");
    expect(lagStage4.alignedBlocks).toBeNull();
    expect(lagStage4.usableBlocks).toBeNull();
    expect(lagStage4.tokenSlots).toBeNull();

    const htmlLag4 = renderToStaticMarkup(
      createElement(WorkerLifecycleInteractive, {
        ...baseProps("worker-s3"),
        initialStep: 4,
        initialClusterPreset: "rank1-lag",
      }),
    );
    expect(htmlLag4).toContain("候选 10 块");
    expect(htmlLag4).toContain("collective_rpc");
    expect(htmlLag4).not.toContain("all_reduce(MIN)");
    expect(htmlLag4).toContain("未决");
    expect(htmlLag4).not.toContain("两卡已汇合");
    expect(htmlLag4).not.toContain("两卡已汇报");
    expect(htmlLag4).not.toContain("对齐 8");
    expect(htmlLag4).not.toContain("min=8");
    expect(htmlLag4).not.toContain("可用 7");
    expect(htmlLag4).not.toContain("7块池");
    expect(htmlLag4).not.toContain("896");

    const skewedStage4 = computeWorkerLifecycleState(4, "skewed", false);
    expect(skewedStage4.rank1LaggingAtBarrier).toBe(false);
    expect(skewedStage4.budgetStatus).toBe("aligned");
    expect(skewedStage4.alignedBlocks).toBe(8);
    expect(skewedStage4.usableBlocks).toBe(7);
    expect(skewedStage4.tokenSlots).toBe(896);

    const htmlSkewed4 = renderToStaticMarkup(
      createElement(WorkerLifecycleInteractive, {
        ...baseProps("worker-s3"),
        initialStep: 4,
        initialClusterPreset: "skewed",
      }),
    );
    expect(htmlSkewed4).toContain("min(10, 8) = 8 块");
    expect(htmlSkewed4).toContain("null_block");
    expect(htmlSkewed4).toContain("7 可用块");
    expect(htmlSkewed4).toContain("896 词槽");

    const convergedStage5 = computeWorkerLifecycleState(5, "rank1-lag", false);
    expect(convergedStage5.rank1LaggingAtBarrier).toBe(false);
    expect(convergedStage5.budgetStatus).toBe("aligned");
    expect(convergedStage5.alignedBlocks).toBe(8);
    expect(convergedStage5.usableBlocks).toBe(7);
    expect(convergedStage5.tokenSlots).toBe(896);

    const htmlLag5 = renderToStaticMarkup(
      createElement(WorkerLifecycleInteractive, {
        ...baseProps("worker-s3"),
        initialStep: 5,
        initialClusterPreset: "rank1-lag",
      }),
    );
    expect(htmlLag5).toContain("min(10, 8) = 8 块");
    expect(htmlLag5).toContain("null_block");
    expect(htmlLag5).toContain("7 可用块");
    expect(htmlLag5).toContain("896 词槽");

    for (const preset of WORKER_CLUSTER_PRESETS) {
      for (const item of WORKER_LIFECYCLE_STAGES) {
        const html = renderToStaticMarkup(
          createElement(WorkerLifecycleInteractive, {
            ...baseProps("worker-svg-check"),
            initialStep: item.stage,
            initialClusterPreset: preset,
          }),
        );
        assertSvgTextInvariants(html, `worker-${preset}-stage-${item.stage}`);
      }
    }
  });
});
