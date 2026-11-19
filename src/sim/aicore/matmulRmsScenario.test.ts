import { describe, expect, it } from "vitest";
import { HARDWARE_CLAIMS } from "../hardware/claims";
import { NPU_910B } from "../hardware/spec";
import {
  computeGmByteBreakdown,
  evaluateOutlierQuantization,
  GROUP0_PROBE_VALUES,
  SCENARIO_META,
  SCHEMATIC_TIMING_BADGE,
  simulateAiCoreLab,
} from "./matmulRmsScenario";

describe("matmulRmsScenario — Wave 4A Tool ④ 物理与红线验证", () => {
  it("Redline 1: 单场景聚焦 QuantMatmul + AddRMSNorm（2 个 Tile），且所有硬件部件/路径/证据均来自 NPU_910B 单一真相源", () => {
    const res = simulateAiCoreLab();
    expect(SCENARIO_META.id).toBe("quant-matmul-add-rmsnorm");
    expect(SCENARIO_META.tileCount).toBe(2);
    expect(res.npuSpecId).toBe(NPU_910B.id);

    const validPartIds = new Set(NPU_910B.parts.map((p) => p.id));
    for (const track of res.tracks) {
      for (const pid of track.specPartIds) {
        expect(validPartIds.has(pid)).toBe(true);
      }
      const workTiles = new Set(track.blocks.filter((b) => b.kind === "work").map((b) => b.tile));
      expect(workTiles).toEqual(new Set(["T0", "T1"]));
    }

    for (const step of res.bufferSteps) {
      for (const pid of step.activeParts) {
        expect(validPartIds.has(pid)).toBe(true);
      }
      for (const evId of step.evidenceIds) {
        expect(Object.hasOwn(HARDWARE_CLAIMS, evId)).toBe(true);
      }
      for (const route of step.specRoutes) {
        const exists = NPU_910B.routes.some(
          (r) =>
            r.from === route.from && r.to === route.to && (route.engine ? r.engine === route.engine : true),
        );
        expect(exists).toBe(true);
      }
    }
  });

  it("Redline 2: AIC·MTE2 与 AIV·MTE2 泳道分离；910B 必须经 GM/L2 往返，950 走 L0C→UB 直通免重读 Matmul 输出", () => {
    const r910 = simulateAiCoreLab({ arch: "910b", doubleBuffer: false, fuseAddRmsNorm: true });
    const r950 = simulateAiCoreLab({ arch: "950", doubleBuffer: false, fuseAddRmsNorm: true });

    const ids910 = r910.tracks.map((t) => t.id);
    expect(ids910).toEqual([
      "aic-mte2",
      "aic-mte1",
      "aic-cube",
      "handoff",
      "aiv-mte2",
      "aiv-vector",
      "aiv-mte3",
    ]);

    // 910B: FixPipe writes GM/L2 before AIV·MTE2 reads Matmul output into UB.
    expect(r910.usesExternalGmForMatmulHandoff).toBe(true);
    expect(r910.aivMte2ReadsMatmulFromGm).toBe(true);
    expect(r910.gmBytes.matmulHandoffGmBytes).toBeGreaterThan(0);

    const fixpipeT0 = r910.tracks
      .find((t) => t.id === "handoff")!
      .blocks.find((b) => b.tile === "T0" && b.kind === "work")!;
    const aivMte2T0 = r910.tracks
      .find((t) => t.id === "aiv-mte2")!
      .blocks.find((b) => b.tile === "T0" && b.readsMatmulOutputFromGm === true)!;
    expect(aivMte2T0.startUnit).toBeGreaterThanOrEqual(fixpipeT0.startUnit + fixpipeT0.durationUnit);

    // 950: L0C → UB direct path, AIV·MTE2 does NOT re-read Matmul output from external GM/L2.
    expect(r950.usesExternalGmForMatmulHandoff).toBe(false);
    expect(r950.aivMte2ReadsMatmulFromGm).toBe(false);
    expect(r950.gmBytes.matmulHandoffGmBytes).toBe(0);
    expect(r950.tracks.find((t) => t.id === "handoff")!.label).toContain("L0C → UB");
  });

  it("Redline 3a: 开启 Ping-Pong 双缓冲仅消除流水气泡，Roofline 严格垂直上移（deltaArithmeticIntensity === 0）", () => {
    for (const arch of ["910b", "950"] as const) {
      for (const fuseAddRmsNorm of [false, true]) {
        const off = simulateAiCoreLab({ arch, doubleBuffer: false, fuseAddRmsNorm });
        const on = simulateAiCoreLab({ arch, doubleBuffer: true, fuseAddRmsNorm });

        // Exact zero change in GM/L2 bytes, arithmetic intensity, and Roofline X coordinate.
        expect(on.gmBytes.totalGmBytes).toBe(off.gmBytes.totalGmBytes);
        expect(on.roofline.current.arithmeticIntensity - off.roofline.current.arithmeticIntensity).toBe(0);
        expect(on.roofline.current.svgX).toBe(off.roofline.current.svgX);

        // Strictly vertical upward shift toward the roof (smaller svgY, higher achievedLevel, still below roof).
        expect(on.roofline.current.svgY).toBeLessThan(off.roofline.current.svgY);
        expect(on.roofline.current.achievedLevel).toBeGreaterThan(off.roofline.current.achievedLevel);
        expect(on.roofline.current.achievedLevel).toBeLessThan(on.roofline.current.roofLevel);

        // Pipeline overlap visibly reduces bubbles and contracts total relative span without lane overlaps.
        expect(on.bubbleUnits).toBeLessThan(off.bubbleUnits);
        expect(on.totalRelativeSpanUnits).toBeLessThan(off.totalRelativeSpanUnits);
        expect(on.t1StartUnit).toBeLessThan(off.t1StartUnit);
      }
    }

    const dbOnly = simulateAiCoreLab({ arch: "910b", doubleBuffer: true, fuseAddRmsNorm: false });
    expect(dbOnly.roofline.deltaArithmeticIntensity).toBe(0);
    expect(dbOnly.roofline.deltaSvgX).toBe(0);
    expect(dbOnly.roofline.upwardLiftPx).toBeGreaterThan(0);
    expect(dbOnly.roofline.movementKind).toBe("vertical-lift");
  });

  it("Redline 3b: 开启 AddRMSNorm 融合或切换昇腾 950 (L0C→UB) 真实削减核外 GM/L2 字节，Roofline 严格右移（deltaArithmeticIntensity > 0）", () => {
    const base = simulateAiCoreLab({ arch: "910b", doubleBuffer: false, fuseAddRmsNorm: false });
    const fused910 = simulateAiCoreLab({ arch: "910b", doubleBuffer: false, fuseAddRmsNorm: true });
    const unfused950 = simulateAiCoreLab({ arch: "950", doubleBuffer: false, fuseAddRmsNorm: false });
    const fused950 = simulateAiCoreLab({ arch: "950", doubleBuffer: false, fuseAddRmsNorm: true });

    // Fusion on 910B cuts GM/L2 bytes -> arithmetic intensity & SVG X shift right.
    expect(fused910.gmBytes.totalGmBytes).toBeLessThan(base.gmBytes.totalGmBytes);
    expect(fused910.gmBytes.unfusedAddGmBytes).toBe(0);
    expect(fused910.roofline.deltaArithmeticIntensity).toBeGreaterThan(0);
    expect(fused910.roofline.current.svgX).toBeGreaterThan(base.roofline.current.svgX);

    // Switching to 950 (L0C→UB) cuts GM/L2 bytes -> arithmetic intensity & SVG X shift right.
    expect(unfused950.gmBytes.totalGmBytes).toBeLessThan(base.gmBytes.totalGmBytes);
    expect(unfused950.gmBytes.matmulHandoffGmBytes).toBe(0);
    expect(unfused950.roofline.deltaArithmeticIntensity).toBeGreaterThan(0);
    expect(unfused950.roofline.current.svgX).toBeGreaterThan(base.roofline.current.svgX);

    // Combining 950 + Fusion achieves the lowest external GM bytes and highest arithmetic intensity.
    expect(fused950.gmBytes.totalGmBytes).toBeLessThan(fused910.gmBytes.totalGmBytes);
    expect(fused950.gmBytes.totalGmBytes).toBeLessThan(unfused950.gmBytes.totalGmBytes);
    expect(fused950.gmBytes.arithmeticIntensity).toBeGreaterThan(fused910.gmBytes.arithmeticIntensity);
    expect(fused950.roofline.current.svgX).toBeGreaterThan(fused910.roofline.current.svgX);

    // Byte accounting table stays strictly consistent with direct formula calls.
    for (const row of base.gmComparisonTable) {
      expect(row.bytes).toEqual(computeGmByteBreakdown(row.arch, row.fuseAddRmsNorm));
    }
  });

  it("Redline 4: 跨组离群量化沙箱诚实区分 MXFP8 / W8A8_DYNAMIC / Per-Tensor INT8，并强制携带示意时序徽章、零伪造周期/MFU", () => {
    const mxLow = evaluateOutlierQuantization("mxfp8", 1);
    const mxHigh = evaluateOutlierQuantization("mxfp8", 24);
    const dynLow = evaluateOutlierQuantization("w8a8_dynamic", 1);
    const dynMid = evaluateOutlierQuantization("w8a8_dynamic", 16);
    const ptMid = evaluateOutlierQuantization("per_tensor_int8", 16);

    // Group 0 original probes match specification.
    expect(mxHigh.group0Original).toEqual(GROUP0_PROBE_VALUES);

    // MXFP8 Group 0 [ch0..31] uses independent E8M0 block scale: completely isolated from ch64 in Group 2.
    expect(mxLow.group0Reconstructed).toEqual(mxHigh.group0Reconstructed);
    expect(mxLow.group0MeanRelErrorPct).toBe(mxHigh.group0MeanRelErrorPct);
    expect(mxHigh.group0MeanRelErrorPct).toBeLessThan(4);
    expect(mxHigh.sameBlockNuance).toContain("E4M3");

    // W8A8_DYNAMIC shares ONE scale across the entire token row: ch64=16 crushes Group 0 vs quiet token ch64=1.
    expect(dynMid.group0EffectiveStep).toBeGreaterThan(dynLow.group0EffectiveStep * 10);
    expect(dynMid.group0MeanRelErrorPct).toBeGreaterThan(10);
    expect(dynMid.group0MeanRelErrorPct).toBeGreaterThan(mxHigh.group0MeanRelErrorPct);

    // Per-Tensor INT8 has global shared scale -> coarsest quantization step and worst distortion.
    expect(ptMid.group0EffectiveStep).toBeGreaterThan(dynMid.group0EffectiveStep);
    expect(ptMid.group0MeanRelErrorPct).toBeGreaterThan(dynMid.group0MeanRelErrorPct);

    // Schematic timing badge is mandatory and output contains zero fabricated cycle / MFU strings.
    const sim = simulateAiCoreLab({ arch: "910b", doubleBuffer: true, fuseAddRmsNorm: true });
    expect(sim.schematicBadge).toBe(SCHEMATIC_TIMING_BADGE);
    const serialized = JSON.stringify(sim);
    expect(serialized).not.toMatch(/MFU/i);
    expect(serialized).not.toMatch(/\b\d+\s*(cycles|ns|us|μs|TFLOPS)\b/i);
  });

  it("所有 8 组架构/双缓冲/融合组合中，同一泳道内任务块严格不重叠且不越界", () => {
    for (const arch of ["910b", "950"] as const) {
      for (const doubleBuffer of [false, true]) {
        for (const fuseAddRmsNorm of [false, true]) {
          const res = simulateAiCoreLab({ arch, doubleBuffer, fuseAddRmsNorm });
          expect(res.totalRelativeSpanUnits).toBeLessThanOrEqual(SCENARIO_META.timelineHorizonUnits);
          for (const track of res.tracks) {
            const works = track.blocks
              .filter((b) => b.kind === "work")
              .sort((a, b) => a.startUnit - b.startUnit);
            for (let i = 1; i < works.length; i++) {
              const prev = works[i - 1]!;
              const curr = works[i]!;
              expect(prev.startUnit + prev.durationUnit).toBeLessThanOrEqual(curr.startUnit);
            }
            for (const block of track.blocks) {
              expect(block.leftPct).toBeGreaterThanOrEqual(0);
              expect(block.leftPct + block.widthPct).toBeLessThanOrEqual(100.05);
            }
          }
        }
      }
    }
  });
});
